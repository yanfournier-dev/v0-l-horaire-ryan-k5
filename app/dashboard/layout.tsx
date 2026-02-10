import type React from "react"
import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { logout } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ReplacementsBadge } from "@/components/replacements-badge"
import { ExchangesBadge } from "@/components/exchanges-badge"
import { AbsencesBadge } from "@/components/absences-badge"
import { NotificationErrorsBadge } from "@/components/notification-errors-badge"
import { MobileNav } from "@/components/mobile-nav"
import { Suspense } from "react"
import { TelegramConnectionBanner } from "@/components/telegram-connection-banner"
import { TelegramConnectionModal } from "@/components/telegram-connection-modal"
import { checkUserTelegramStatus } from "@/app/actions/telegram-status"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()

  if (!user) {
    redirect("/login")
  }

  const { getReplacementsAdminActionCount } = await import("@/app/actions/replacements")
  const { getPendingExchangesCount } = await import("@/app/actions/exchanges")
  const { getPendingLeavesCount } = await import("@/app/actions/leaves")
  const { getNotificationErrorsCount } = await import("@/app/actions/get-notification-history")

  const replacementsBadgeCount = user.is_admin ? await getReplacementsAdminActionCount() : 0
  const exchangesBadgeCount = user.is_admin ? await getPendingExchangesCount() : 0
  const absencesBadgeCount = user.is_admin ? await getPendingLeavesCount() : 0
  const notificationErrorsCount = user.is_admin ? await getNotificationErrorsCount() : 0

  const telegramStatus = user.is_admin ? { isConnected: true } : await checkUserTelegramStatus(user.id)

  return (
    <div className="min-h-screen bg-background">
      {!user.is_admin && <TelegramConnectionBanner isConnected={telegramStatus.isConnected} />}

      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="flex items-center gap-3">
              <MobileNav
                userName={`${user.first_name} ${user.last_name}`}
                isAdmin={user.isAdmin}
                replacementsBadgeCount={replacementsBadgeCount}
                exchangesBadgeCount={exchangesBadgeCount}
                absencesBadgeCount={absencesBadgeCount}
                notificationErrorsCount={notificationErrorsCount}
              />

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
              <h1 className="text-lg md:text-xl font-bold text-foreground">Horaire SSIV</h1>
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
            <Link href="/dashboard" scroll={false}>
              <Button variant="ghost" size="sm">
                Tableau de bord
              </Button>
            </Link>
            <Link href="/dashboard/calendar?scrollToToday=true" scroll={false}>
              <Button variant="ghost" size="sm">
                Calendrier
              </Button>
            </Link>
            <Link href="/dashboard/replacements" scroll={false}>
              <Button variant="ghost" size="sm" className="relative">
                Remplacements
                <Suspense fallback={null}>
                  <ReplacementsBadge />
                </Suspense>
              </Button>
            </Link>
            <Link href="/dashboard/exchanges" scroll={false}>
              <Button variant="ghost" size="sm" className="relative">
                Échanges
                <Suspense fallback={null}>
                  <ExchangesBadge />
                </Suspense>
              </Button>
            </Link>
            <Link href="/dashboard/absences" scroll={false}>
              <Button variant="ghost" size="sm" className="relative">
                Absences
                <Suspense fallback={null}>
                  <AbsencesBadge />
                </Suspense>
              </Button>
            </Link>
            <Link href="/dashboard/notifications" scroll={false}>
              <Button variant="ghost" size="sm">
                Notifications
              </Button>
            </Link>
            <Link href="/dashboard/settings" scroll={false}>
              <Button variant="ghost" size="sm" className="relative">
                Paramètres
                <Suspense fallback={null}>
                  <NotificationErrorsBadge />
                </Suspense>
              </Button>
            </Link>
            {user.isAdmin && (
              <>
                <Link href="/dashboard/admin/audit-logs" scroll={false}>
                  <Button variant="ghost" size="sm">
                    Journal d'activités
                  </Button>
                </Link>
                <Link href="/dashboard/admin/run-scripts" scroll={false}>
                  <Button variant="ghost" size="sm">
                    Scripts SQL
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto">{children}</main>

      {!user.is_admin && <TelegramConnectionModal isConnected={telegramStatus.isConnected} />}
    </div>
  )
}
