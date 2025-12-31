"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const LEAVE_BANKS = [
  { value: "fete_chomee", label: "Fête chômée" },
  { value: "vacances", label: "Vacances" },
  { value: "maladie", label: "Maladie" },
  { value: "reconnaissance", label: "Reconnaissance" },
  { value: "modulation", label: "Modulation" },
  { value: "arret_travail", label: "Arrêt de travail" },
  { value: "formation", label: "Formation" },
  { value: "conge_social", label: "Congé social" },
]

const HOURS_OPTIONS = [
  { value: "0.5", label: "0.5h" },
  { value: "1.0", label: "1h" },
  { value: "1.5", label: "1.5h" },
  { value: "2.0", label: "2h" },
  { value: "2.5", label: "2.5h" },
  { value: "3.0", label: "3h" },
  { value: "3.5", label: "3.5h" },
  { value: "4.0", label: "4h" },
  { value: "4.5", label: "4.5h" },
  { value: "5.0", label: "5h" },
  { value: "5.5", label: "5.5h" },
  { value: "6.0", label: "6h" },
  { value: "6.5", label: "6.5h" },
  { value: "7.0", label: "7h" },
  { value: "7.5", label: "7.5h" },
  { value: "8.0", label: "8h" },
  { value: "8.5", label: "8.5h" },
  { value: "9.0", label: "9h" },
  { value: "9.5", label: "9.5h" },
  { value: "10.0", label: "10h" },
  { value: "10.5", label: "10.5h" },
  { value: "11.0", label: "11h" },
  { value: "11.5", label: "11.5h" },
  { value: "12.0", label: "12h" },
  { value: "12.5", label: "12.5h" },
  { value: "13.0", label: "13h" },
  { value: "13.5", label: "13.5h" },
  { value: "14.0", label: "14h" },
]

interface LeaveBankSelectorProps {
  bank1: string
  hours1: string
  bank2: string
  hours2: string
  onBank1Change: (value: string) => void
  onHours1Change: (value: string) => void
  onBank2Change: (value: string) => void
  onHours2Change: (value: string) => void
}

export function LeaveBankSelector({
  bank1,
  hours1,
  bank2,
  hours2,
  onBank1Change,
  onHours1Change,
  onBank2Change,
  onHours2Change,
}: LeaveBankSelectorProps) {
  console.log("[v0] LeaveBankSelector rendering with:", { bank1, hours1, bank2, hours2 })

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-sm font-medium">Banque de congé 1 *</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Select value={bank1} onValueChange={onBank1Change}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une banque" />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_BANKS.map((bank) => (
                  <SelectItem key={bank.value} value={bank.value}>
                    {bank.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={hours1} onValueChange={onHours1Change}>
              <SelectTrigger>
                <SelectValue placeholder="Heures (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {HOURS_OPTIONS.map((hour) => (
                  <SelectItem key={hour.value} value={hour.value}>
                    {hour.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium text-muted-foreground">Banque de congé 2 (optionnel)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Select value={bank2} onValueChange={onBank2Change}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une banque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {LEAVE_BANKS.map((bank) => (
                  <SelectItem key={bank.value} value={bank.value}>
                    {bank.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={hours2} onValueChange={onHours2Change} disabled={!bank2}>
              <SelectTrigger>
                <SelectValue placeholder="Heures (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {HOURS_OPTIONS.map((hour) => (
                  <SelectItem key={hour.value} value={hour.value}>
                    {hour.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}
