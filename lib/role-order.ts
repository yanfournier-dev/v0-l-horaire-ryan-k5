export function getRoleOrder(role: string): number {
  switch (role) {
    case "captain":
      return 1
    case "lieutenant":
      return 2
    case "pp1":
      return 3
    case "pp2":
      return 4
    case "pp3":
      return 5
    case "pp4":
      return 6
    case "pp5":
      return 7
    case "pp6":
      return 8
    case "firefighter":
      return 9
    default:
      return 10
  }
}

export function getTeamOrder(teamName: string, teamType: string): number {
  // Order: Temps partiel 1-4, Temporaire, Permanente 1-4
  if (teamType === "part_time") {
    if (teamName.includes("1")) return 1
    if (teamName.includes("2")) return 2
    if (teamName.includes("3")) return 3
    if (teamName.includes("4")) return 4
    return 5
  } else if (teamType === "temporary") {
    return 6
  } else if (teamType === "permanent") {
    if (teamName.includes("1")) return 7
    if (teamName.includes("2")) return 8
    if (teamName.includes("3")) return 9
    if (teamName.includes("4")) return 10
    return 11
  }
  return 12
}
