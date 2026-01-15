// Script pour générer le hash PBKDF2 du mot de passe SSIV2026
// Ce script aide à créer le hash pour le script SQL 021

export async function generateSSIVHash() {
  const password = "SSIV2026"

  const encoder = new TextEncoder()
  const data = encoder.encode(password)

  // Generate a fixed salt for consistency (normally random, but we need reproducible hash)
  const salt = new Uint8Array([
    0x7a, 0x3d, 0x8f, 0x2e, 0x4c, 0x1b, 0x9a, 0x6e, 0x5f, 0x2c, 0x8d, 0x3a, 0x7e, 0x1b, 0x9c, 0x4a,
  ])

  // Import key
  const key = await crypto.subtle.importKey("raw", data, { name: "PBKDF2" }, false, ["deriveBits"])

  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256, // 32 bytes
  )

  const hashArray = Array.from(new Uint8Array(derivedBits))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  const finalHash = `pbkdf2:sha256:100000:${saltHex}:${hashHex}`

  console.log("Hash PBKDF2 pour SSIV2026:")
  console.log(finalHash)

  return finalHash
}

// Pour exécuter: node --eval "import('./scripts/generate-ssiv2026-hash.ts').then(m => m.generateSSIVHash())"
