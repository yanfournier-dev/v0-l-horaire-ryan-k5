import { getSession } from "@/lib/auth"
import { getCycleConfig, getAllShiftsWithAssignments } from "@/app/actions/calendar"
import { parseLocalDate } from "@/lib/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function DiagnosticPage() {
  const results: { step: string; success: boolean; data?: any; error?: string }[] = []

  // Test 1: Get session
  try {
    const user = await getSession()
    results.push({
      step: "1. Get Session",
      success: true,
      data: { userId: user?.id, isAdmin: user?.is_admin },
    })
  } catch (error) {
    results.push({
      step: "1. Get Session",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Test 2: Get cycle config
  try {
    const cycleConfig = await getCycleConfig()
    results.push({
      step: "2. Get Cycle Config",
      success: true,
      data: { hasConfig: !!cycleConfig, startDate: cycleConfig?.start_date },
    })
  } catch (error) {
    results.push({
      step: "2. Get Cycle Config",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Test 3: Parse date
  try {
    const cycleConfig = await getCycleConfig()
    if (cycleConfig) {
      const cycleStartDate = parseLocalDate(cycleConfig.start_date)
      results.push({
        step: "3. Parse Date",
        success: true,
        data: { parsedDate: cycleStartDate.toISOString() },
      })
    }
  } catch (error) {
    results.push({
      step: "3. Parse Date",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Test 4: Get all shifts
  try {
    const allShifts = await getAllShiftsWithAssignments()
    results.push({
      step: "4. Get All Shifts",
      success: true,
      data: { shiftsCount: allShifts.length, firstShift: allShifts[0] },
    })
  } catch (error) {
    results.push({
      step: "4. Get All Shifts",
      success: false,
      error: error instanceof Error ? `${error.message}\n\nStack: ${error.stack}` : String(error),
    })
  }

  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Diagnostic de la page du calendrier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
              >
                <h3 className={`font-semibold ${result.success ? "text-green-900" : "text-red-900"}`}>
                  {result.step} - {result.success ? "✓ Succès" : "✗ Échec"}
                </h3>
                {result.success && result.data && (
                  <pre className="mt-2 text-sm text-green-800 overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
                {!result.success && result.error && (
                  <pre className="mt-2 text-sm text-red-800 overflow-auto whitespace-pre-wrap">{result.error}</pre>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
