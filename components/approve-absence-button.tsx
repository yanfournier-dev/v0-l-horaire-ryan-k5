"use client"

import { Button } from "@/components/ui/button"
import { approveLeave } from "@/app/actions/leaves"
import { toast } from "sonner"
import { useState } from "react"

interface ApproveAbsenceButtonProps {
  leaveId: number
}

export function ApproveAbsenceButton({ leaveId }: ApproveAbsenceButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    const result = await approveLeave(leaveId)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Absence approuvée")
    }

    setLoading(false)
  }

  return (
    <Button size="sm" onClick={handleApprove} disabled={loading} className="bg-green-600 hover:bg-green-700">
      {loading ? "Approbation..." : "Approuver"}
    </Button>
  )
}
