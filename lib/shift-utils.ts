/**
 * Get default start and end times for a partial replacement based on shift type
 */
export function getDefaultReplacementTimes(shiftType: string): { startTime: string; endTime: string } {
  switch (shiftType) {
    case "day":
      return { startTime: "07:00", endTime: "17:00" }
    case "night":
      return { startTime: "17:00", endTime: "07:00" }
    case "full_24h":
      return { startTime: "07:00", endTime: "07:00" }
    default:
      return { startTime: "07:00", endTime: "17:00" }
  }
}
