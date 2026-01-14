"use client"

import { useState } from "react"
import { useRouter } from "next/navigation" // Added for smooth refresh
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { getRoleLabel } from "@/lib/role-labels"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { toggleTelegramRequirement } from "@/app/actions/telegram-status"
import { toast } from "sonner"

type User = {
  id: number
  first_name: string
  last_name: string
  email: string
  role: string
  is_owner: boolean
  telegram_required: boolean
  telegram_chat_id: string | null
  telegram_username: string | null
  user_created_at: string
  telegram_connected_at: string | null
}

export function TelegramStatusTable({
  users,
  currentUserId,
  currentUserIsOwner,
}: {
  users: User[]
  currentUserId: number
  currentUserIsOwner: boolean
}) {
  const router = useRouter() // Added router for refresh
  const [filter, setFilter] = useState<"all" | "connected" | "notConnected">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null)

  const filteredUsers = users.filter((user) => {
    // Filter by connection status
    if (filter === "connected" && !user.telegram_chat_id) return false
    if (filter === "notConnected" && user.telegram_chat_id) return false

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        user.first_name.toLowerCase().includes(query) ||
        user.last_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      )
    }

    return true
  })

  const handleToggleRequirement = async (userId: number, currentValue: boolean) => {
    setTogglingUserId(userId)
    try {
      const result = await toggleTelegramRequirement(userId, !currentValue)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Obligation Telegram modifiée")
        router.refresh() // Use router.refresh() instead of window.location.reload() to keep scroll position
      }
    } catch (error) {
      toast.error("Erreur lors de la modification")
    } finally {
      setTogglingUserId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            Tous ({users.length})
          </Button>
          <Button
            variant={filter === "connected" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("connected")}
          >
            Connectés ({users.filter((u) => u.telegram_chat_id).length})
          </Button>
          <Button
            variant={filter === "notConnected" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("notConnected")}
          >
            Non connectés ({users.filter((u) => !u.telegram_chat_id).length})
          </Button>
        </div>
        <Input
          placeholder="Rechercher par nom ou email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telegram obligatoire</TableHead>
              <TableHead>Statut Telegram</TableHead>
              <TableHead>Date de connexion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucun utilisateur trouvé
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.last_name}, {user.first_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getRoleLabel(user.role)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {currentUserIsOwner ? (
                      <Switch
                        checked={user.telegram_required}
                        onCheckedChange={() => handleToggleRequirement(user.id, user.telegram_required)}
                        disabled={togglingUserId === user.id}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">{user.telegram_required ? "Oui" : "Non"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.telegram_chat_id ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Connecté
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Non connecté</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.telegram_connected_at
                      ? formatDistanceToNow(new Date(user.telegram_connected_at), {
                          addSuffix: true,
                          locale: fr,
                        })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
