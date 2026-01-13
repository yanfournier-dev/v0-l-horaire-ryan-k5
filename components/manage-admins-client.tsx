"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { toggleUserAdminStatus } from "@/app/actions/admin"
import { useRouter } from "next/navigation"
import { User, Shield, ShieldCheck } from "lucide-react"

interface UserWithAdminStatus {
  id: number
  first_name: string
  last_name: string
  email: string
  role: string
  is_admin: boolean
  isAdmin: boolean
  canModifyAdmin: boolean
  created_at: string
}

interface ManageAdminsClientProps {
  users: UserWithAdminStatus[]
}

const roleLabels: Record<string, string> = {
  captain: "Capitaine",
  lieutenant: "Lieutenant",
  firefighter: "Pompier",
}

const roleColors: Record<string, string> = {
  captain: "bg-blue-100 text-blue-800",
  lieutenant: "bg-green-100 text-green-800",
  firefighter: "bg-gray-100 text-gray-800",
}

export function ManageAdminsClient({ users }: ManageAdminsClientProps) {
  const router = useRouter()
  const [loadingUserId, setLoadingUserId] = useState<number | null>(null)

  const captains = users.filter((u) => u.role === "captain")
  const otherUsers = users.filter((u) => u.role !== "captain")

  const handleToggleAdmin = async (userId: number, currentIsAdmin: boolean) => {
    setLoadingUserId(userId)

    try {
      const result = await toggleUserAdminStatus(userId, !currentIsAdmin)

      if (result.success) {
        router.refresh()
      } else {
        alert(result.error)
      }
    } catch (error) {
      alert("Erreur lors de la modification")
    } finally {
      setLoadingUserId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Captains Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Capitaines
          </CardTitle>
          <CardDescription>Les capitaines ont toujours les privilèges administrateurs (non modifiable)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {captains.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={roleColors[user.role]}>{roleLabels[user.role] || user.role}</Badge>
                  <Badge className="bg-green-100 text-green-800">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Other Users Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Autres utilisateurs
          </CardTitle>
          <CardDescription>Activez ou désactivez les privilèges administrateurs pour ces utilisateurs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {otherUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className={roleColors[user.role]}>{roleLabels[user.role] || user.role}</Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{user.isAdmin ? "Admin" : "Non admin"}</span>
                    <Switch
                      checked={user.isAdmin}
                      onCheckedChange={() => handleToggleAdmin(user.id, user.isAdmin)}
                      disabled={loadingUserId === user.id}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
