export function getTeamColor(teamName: string, color?: string) {
  // Use database color if available
  if (color) {
    return getColorClasses(color)
  }

  if (!teamName) {
    return getColorClasses("gray")
  }

  // Fallback to name-based colors
  if (teamName.includes("1")) return getColorClasses("custom-green") // Yellow-green, distinct from blue
  if (teamName.includes("2")) return getColorClasses("blue") // Pure blue
  if (teamName.includes("3")) return getColorClasses("custom-yellow") // Custom yellow #fec52e
  if (teamName.includes("4")) return getColorClasses("custom-red")
  return getColorClasses("gray")
}

export function getColorClasses(color: string) {
  const colorMap: Record<string, string> = {
    green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300",
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    teal: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
    lime: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
    forest: "bg-green-700 text-green-50 dark:bg-green-800 dark:text-green-100",
    "custom-green": "bg-[#3aaf4a]/10 text-[#3aaf4a] dark:bg-[#3aaf4a]/20 dark:text-[#3aaf4a] border-[#3aaf4a]/30",
    "custom-yellow": "bg-[#fec52e]/10 text-[#fec52e] dark:bg-[#fec52e]/20 dark:text-[#fec52e] border-[#fec52e]/30",
    "custom-forest": "bg-[#004641]/10 text-[#004641] dark:bg-[#004641]/20 dark:text-[#004641] border-[#004641]/30",
    "custom-red": "bg-[#E30613]/10 text-[#E30613] dark:bg-[#E30613]/20 dark:text-[#E30613] border-[#E30613]/30",
  }
  return colorMap[color] || colorMap.gray
}

// Shift type colors according to specifications
// Day = sky, Night = bright red (rose), 24h = forest green (#004641)
export function getShiftTypeColor(type: string) {
  switch (type) {
    case "day":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200"
    case "night":
      return "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200"
    case "full_24h":
      return "bg-[#004641]/10 text-[#004641] dark:bg-[#004641]/20 dark:text-[#004641]"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export function getShiftTypeLabel(type: string) {
  switch (type) {
    case "day":
      return "Jour (7h-17h)"
    case "night":
      return "Nuit (17h-7h)"
    case "full_24h":
      return "24h (7h-7h)"
    default:
      return type
  }
}
