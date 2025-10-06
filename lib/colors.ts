export function getTeamColor(teamName: string, color?: string) {
  // Use database color if available
  if (color) {
    return getColorClasses(color)
  }

  // Fallback to name-based colors
  if (teamName.includes("1")) return getColorClasses("green")
  if (teamName.includes("2")) return getColorClasses("blue")
  if (teamName.includes("3")) return getColorClasses("yellow")
  if (teamName.includes("4")) return getColorClasses("red")
  return getColorClasses("gray")
}

export function getColorClasses(color: string) {
  const colorMap: Record<string, string> = {
    green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300",
    red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300",
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    teal: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  }
  return colorMap[color] || colorMap.gray
}

// Shift type colors according to specifications
// Day = sky, Night = orange, 24h = teal
export function getShiftTypeColor(type: string) {
  switch (type) {
    case "day":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200"
    case "night":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
    case "full_24h":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200"
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
