import "server-only"
import { neon } from "@neondatabase/serverless"

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error("Database connection string not found. Please set DATABASE_URL or POSTGRES_URL environment variable.")
}

const sqlClient = neon(connectionString)

interface CacheEntry {
  data: any
  timestamp: number
}

const queryCache = new Map<string, CacheEntry>()
const CACHE_TTL = 10000 // 10 seconds

function getCacheKey(query: string, params: any[]): string {
  return JSON.stringify({ query, params })
}

function isRateLimitError(error: any): boolean {
  const errorMessage = error?.message || String(error)
  return errorMessage.includes("Too Many R") || errorMessage.includes("rate limit")
}

export function invalidateCache(pattern?: string) {
  if (!pattern) {
    // Clear entire cache
    queryCache.clear()
    console.log("[v0] Cache cleared completely")
    return
  }

  // Clear cache entries matching pattern
  let cleared = 0
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key)
      cleared++
    }
  }
  console.log(`[v0] Cache cleared: ${cleared} entries matching "${pattern}"`)
}

export async function sql(query: TemplateStringsArray | string, ...params: any[]) {
  const queryString = typeof query === "string" ? query : query.join("?")
  const cacheKey = getCacheKey(queryString, params)
  const now = Date.now()

  // Check cache first
  const cached = queryCache.get(cacheKey)
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  try {
    // Execute query
    const result = typeof query === "string" ? await sqlClient(query, params) : await sqlClient(query, ...params)

    // Store in cache
    queryCache.set(cacheKey, { data: result, timestamp: now })

    // Clean up old cache entries (keep cache size manageable)
    if (queryCache.size > 100) {
      const entries = Array.from(queryCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      // Remove oldest 20 entries
      for (let i = 0; i < 20; i++) {
        queryCache.delete(entries[i][0])
      }
    }

    return result
  } catch (error) {
    // If rate limited and we have stale cache, return it
    if (isRateLimitError(error) && cached) {
      console.log("[v0] Rate limit hit, returning stale cache for query")
      return cached.data
    }
    throw error
  }
}
