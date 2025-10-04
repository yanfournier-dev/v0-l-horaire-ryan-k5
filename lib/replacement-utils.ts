export function formatReplacementTime(isPartial: boolean, startTime?: string | null, endTime?: string | null): string {
  if (!isPartial || !startTime || !endTime) {
    return ""
  }
  return ` (${startTime} à ${endTime})`
}

export function getReplacementTypeLabel(isPartial: boolean): string {
  return isPartial ? "Remplacement partiel" : "Remplacement complet"
}
