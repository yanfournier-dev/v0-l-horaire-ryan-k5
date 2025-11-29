"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { EditFirefighterDialog } from "@/components/edit-firefighter-dialog"
import { DeleteFirefighterButton } from "@/components/delete-firefighter-button"
import { ResetPasswordDialog } from "@/components/reset-password-dialog"

interface FirefightersListProps {
  firefighters: any[]
  teams: any[]
  isAdmin: boolean
}

export function FirefightersList({ firefighters, teams, isAdmin }: FirefightersListProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "captain":
        return "Capitaine"
      case "lieutenant":
        return "Lieutenant"
      case "firefighter":
        return "Pompier"
      default:
        return role
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "captain":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "lieutenant":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  const filteredFirefighters = firefighters.filter((firefighter) => {
    const fullName = `${firefighter.first_name} ${firefighter.last_name}`.toLowerCase()
    const email = firefighter.email.toLowerCase()
    const query = searchQuery.toLowerCase()
    return fullName.includes(query) || email.includes(query)
  })

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Rechercher un pompier par nom ou email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-col gap-2">
        {filteredFirefighters.map((firefighter: any) => (
          <Card key={firefighter.id} className="border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-4">
                {/* Left: Name, email, role, teams */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm truncate">
                      {firefighter.first_name} {firefighter.last_name}
                    </h3>
                    <Badge className={`${getRoleBadgeColor(firefighter.role)} text-xs py-0 h-5`}>
                      {getRoleLabel(firefighter.role)}
                    </Badge>
                    {firefighter.is_admin && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs py-0 h-5">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mb-1">{firefighter.email}</p>
                  {firefighter.teams && firefighter.teams.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {firefighter.teams.map((team: any) => (
                        <Badge key={team.id} variant="outline" className="text-xs py-0 h-4">
                          {team.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Action buttons */}
                {isAdmin && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <EditFirefighterDialog firefighter={firefighter} availableTeams={teams} />
                    <ResetPasswordDialog
                      userId={firefighter.id}
                      userName={`${firefighter.first_name} ${firefighter.last_name}`}
                    />
                    <DeleteFirefighterButton userId={firefighter.id} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredFirefighters.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Aucun pompier trouvé pour "{searchQuery}"</div>
        )}
      </div>
    </div>
  )
}
