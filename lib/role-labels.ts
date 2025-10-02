// Helper function to get French labels for roles
export function getRoleLabel(role: string): string {
  const roleLabels: Record<string, string> = {
    captain: "Capitaine",
    lieutenant: "Lieutenant",
    firefighter: "Pompier",
    pp1: "PP1",
    pp2: "PP2",
    pp3: "PP3",
    pp4: "PP4",
    pp5: "PP5",
    pp6: "PP6",
  }
  return roleLabels[role] || role
}

// Get all available roles for dropdowns
export const availableRoles = [
  { value: "captain", label: "Capitaine" },
  { value: "lieutenant", label: "Lieutenant" },
  { value: "firefighter", label: "Pompier" },
  { value: "pp1", label: "PP1" },
  { value: "pp2", label: "PP2" },
  { value: "pp3", label: "PP3" },
  { value: "pp4", label: "PP4" },
  { value: "pp5", label: "PP5" },
  { value: "pp6", label: "PP6" },
] as const
