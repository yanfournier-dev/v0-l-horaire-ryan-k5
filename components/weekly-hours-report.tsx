"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, AlertTriangle, CheckCircle2 } from "lucide-react"
import { getAllFirefightersWeeklyHours } from "@/app/actions/weekly-hours"
import { format, addDays, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"

type SortField = "name" | "hours"
type SortDirection = "asc" | "desc"

interface FirefighterHours {
  userId: number
  firstName: string
  lastName: string
  email: string
  hours: number
  shifts: Array<{
    shiftDate: string
    shiftType: string
    hours: number
    isPartial: boolean
    startTime: string | null
    endTime: string | null
  }>
}

export function WeeklyHoursReport() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [firefighters, setFirefighters] = useState<FirefighterHours[]>([])
  const [filteredFirefighters, setFilteredFirefighters] = useState<FirefighterHours[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [selectedFirefighter, setSelectedFirefighter] = useState<FirefighterHours | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Get week bounds (Sunday to Saturday)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }) // 0 = Sunday
  const weekEnd = addDays(weekStart, 6) // Saturday

  useEffect(() => {
    loadData()
  }, [currentDate])

  useEffect(() => {
    // Filter and sort
    let result = [...firefighters]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (ff) =>
          ff.firstName.toLowerCase().includes(query) ||
          ff.lastName.toLowerCase().includes(query) ||
          ff.email.toLowerCase().includes(query),
      )
    }

    // Sort
    result.sort((a, b) => {
      if (sortField === "name") {
        const nameA = `${a.lastName} ${a.firstName}`.toLowerCase()
        const nameB = `${b.lastName} ${b.firstName}`.toLowerCase()
        return sortDirection === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
      } else {
        return sortDirection === "asc" ? a.hours - b.hours : b.hours - a.hours
      }
    })

    setFilteredFirefighters(result)
  }, [firefighters, searchQuery, sortField, sortDirection])

  async function loadData() {
    setIsLoading(true)
    try {
      const data = await getAllFirefightersWeeklyHours(weekStart.toISOString())
      setFirefighters(data)
    } catch (error) {
      console.error("Error loading weekly hours:", error)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  function goToPreviousWeek() {
    setCurrentDate(addDays(currentDate, -7))
  }

  function goToNextWeek() {
    setCurrentDate(addDays(currentDate, 7))
  }

  function goToCurrentWeek() {
    setCurrentDate(new Date())
  }

  return (
    <div className="space-y-4">
      {/* Week selector and navigation */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[200px]">
              <div className="font-semibold">
                {format(weekStart, "d MMM", { locale: fr })} - {format(weekEnd, "d MMM yyyy", { locale: fr })}
              </div>
              <div className="text-sm text-muted-foreground">Semaine du dimanche au samedi</div>
            </div>
            <Button variant="outline" size="icon" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" onClick={goToCurrentWeek}>
            Semaine courante
          </Button>
        </div>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un pompier par nom..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("name")} className="font-semibold">
                  Pompier
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("hours")} className="font-semibold">
                  Heures
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredFirefighters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  Aucun pompier trouvé
                </TableCell>
              </TableRow>
            ) : (
              filteredFirefighters.map((ff) => {
                const isOvertime = ff.hours > 42
                const overtimeHours = isOvertime ? ff.hours - 42 : 0

                return (
                  <TableRow
                    key={ff.userId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedFirefighter(ff)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {ff.lastName}, {ff.firstName}
                        </div>
                        <div className="text-sm text-muted-foreground">{ff.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-lg">{ff.hours}h</TableCell>
                    <TableCell>
                      {isOvertime ? (
                        <div className="flex items-center gap-2 text-orange-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">+{overtimeHours}h</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Conforme</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Summary */}
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{filteredFirefighters.length}</div>
            <div className="text-sm text-muted-foreground">Pompiers</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {filteredFirefighters.filter((ff) => ff.hours <= 42).length}
            </div>
            <div className="text-sm text-muted-foreground">Conformes (≤ 42h)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {filteredFirefighters.filter((ff) => ff.hours > 42).length}
            </div>
            <div className="text-sm text-muted-foreground">Dépassements (&gt; 42h)</div>
          </div>
        </div>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedFirefighter} onOpenChange={() => setSelectedFirefighter(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Détail des quarts - {selectedFirefighter?.lastName}, {selectedFirefighter?.firstName}
            </DialogTitle>
            <DialogDescription>
              Semaine du {format(weekStart, "d MMM", { locale: fr })} au {format(weekEnd, "d MMM yyyy", { locale: fr })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Total des heures</div>
                <div className="text-2xl font-bold">{selectedFirefighter?.hours}h</div>
              </div>
              {selectedFirefighter && selectedFirefighter.hours > 42 && (
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Dépassement</div>
                  <div className="text-2xl font-bold text-orange-600">+{selectedFirefighter.hours - 42}h</div>
                </div>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type de quart</TableHead>
                  <TableHead>Heures</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedFirefighter?.shifts.map((shift, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(new Date(shift.shiftDate), "EEE d MMM", { locale: fr })}</TableCell>
                    <TableCell className="capitalize">{shift.shiftType}</TableCell>
                    <TableCell className="font-semibold">{shift.hours}h</TableCell>
                    <TableCell>
                      {shift.isPartial && shift.startTime && shift.endTime ? (
                        <span className="text-sm text-muted-foreground">
                          {shift.startTime.slice(0, 5)} - {shift.endTime.slice(0, 5)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Quart complet</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
