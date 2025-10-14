"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface MobileNavProps {
  userName: string
  isAdmin?: boolean
}

export function MobileNav({ userName, isAdmin }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { href: "/dashboard", label: "Tableau de bord" },
    { href: "/dashboard/calendar", label: "Calendrier" },
    { href: "/dashboard/replacements", label: "Remplacements" },
    { href: "/dashboard/exchanges", label: "Échanges" },
    { href: "/dashboard/notifications", label: "Notifications" },
    { href: "/dashboard/teams", label: "Équipes" },
    { href: "/dashboard/firefighters", label: "Pompiers" },
    { href: "/dashboard/settings", label: "Paramètres" },
    ...(isAdmin ? [{ href: "/dashboard/admin/run-scripts", label: "Scripts SQL" }] : []),
  ]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                />
              </svg>
            </div>
            L'horaire Ryan
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-2">
          <div className="px-3 py-2 text-sm text-muted-foreground border-b border-border mb-2">{userName}</div>

          {navItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
