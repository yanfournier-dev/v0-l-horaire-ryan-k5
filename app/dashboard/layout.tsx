import type React from "react"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { logout } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { NotificationBadge } from "@/components/notification-badge"
import { MobileNav } from "@/components/mobile-nav"
import { Suspense } from "react"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="flex items-center gap-3">
              <MobileNav userName={`${user.first_name} ${user.last_name}`} />

              <div className="w-8 h-8 md:w-10 md:h-10 bg-red-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                  />
                </svg>
              </div>
              <h1 className="text-lg md:text-xl font-bold text-foreground">L'horaire Ryan</h1>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline">
                {user.first_name} {user.last_name}
              </span>
              <form action={logout}>
                <Button variant="outline" size="sm" type="submit" className="text-xs md:text-sm bg-transparent">
                  Déconnexion
                </Button>
              </form>
            </div>
          </div>

          <nav className="hidden md:flex gap-2 overflow-x-auto">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Tableau de bord
              </Button>
            </Link>
            <Link href="/dashboard/calendar">
              <Button variant="ghost" size="sm">
                Calendrier
              </Button>
            </Link>
            <Link href="/dashboard/leaves">
              <Button variant="ghost" size="sm">
                Absences
              </Button>
            </Link>
            <Link href="/dashboard/replacements">
              <Button variant="ghost" size="sm">
                Remplacements
              </Button>
            </Link>
            <Link href="/dashboard/notifications">
              <Button variant="ghost" size="sm" className="relative">
                Notifications
                <Suspense fallback={null}>
                  <NotificationBadge />
                </Suspense>
              </Button>
            </Link>
            <Link href="/dashboard/teams">
              <Button variant="ghost" size="sm">
                Équipes
              </Button>
            </Link>
            <Link href="/dashboard/firefighters">
              <Button variant="ghost" size="sm">
                Pompiers
              </Button>
            </Link>
            <Link href="/dashboard/settings/password">
              <Button variant="ghost" size="sm">
                Mot de passe
              </Button>
            </Link>
            <Link href="/dashboard/settings/notifications">
              <Button variant="ghost" size="sm">
                Paramètres
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto">{children}</main>
    </div>
  )
}
