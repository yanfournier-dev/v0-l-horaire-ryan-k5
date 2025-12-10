"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { MyExchangesTab } from "@/components/my-exchanges-tab"
import { PendingExchangesTab } from "@/components/pending-exchanges-tab"
import { AllExchangesTab } from "@/components/all-exchanges-tab"
import { RequestExchangeDialog } from "@/components/request-exchange-dialog"
import { CreateExchangeAdminDialog } from "@/components/create-exchange-admin-dialog"

interface ExchangesTabsProps {
  userExchanges: any[]
  pendingExchanges: any[]
  allExchanges?: any[]
  nonPastExchangesCount?: number
  isAdmin: boolean
  userId: number
  exchangeCount: number
  allFirefighters?: any[]
}

export function ExchangesTabs({
  userExchanges,
  pendingExchanges,
  allExchanges = [],
  nonPastExchangesCount = 0,
  isAdmin,
  userId,
  exchangeCount,
  allFirefighters = [],
}: ExchangesTabsProps) {
  const [showRequestDialog, setShowRequestDialog] = useState(false)
  const [activeTab, setActiveTab] = useState(isAdmin ? "all" : "my-exchanges")

  const canRequestExchange = exchangeCount < 8

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <div className="flex justify-end gap-2 mb-4">
        {isAdmin ? (
          <CreateExchangeAdminDialog allFirefighters={allFirefighters} />
        ) : (
          <Button onClick={() => setShowRequestDialog(true)} className="gap-2" disabled={!canRequestExchange}>
            <Plus className="h-4 w-4" />
            Demander un échange
          </Button>
        )}
      </div>

      {!canRequestExchange && !isAdmin && (
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardContent className="py-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Vous avez atteint la limite de 8 échanges par année. Vous ne pouvez plus demander d'échange pour cette
              année.
            </p>
          </CardContent>
        </Card>
      )}

      <TabsList>
        {isAdmin && (
          <>
            <TabsTrigger value="all">Tous les échanges ({nonPastExchangesCount})</TabsTrigger>
            <TabsTrigger value="my-exchanges">Mes échanges ({userExchanges.length})</TabsTrigger>
            <TabsTrigger
              value="pending"
              className={
                pendingExchanges.length > 0
                  ? "data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=inactive]:text-red-600 data-[state=inactive]:font-semibold"
                  : ""
              }
            >
              En attente ({pendingExchanges.length})
            </TabsTrigger>
          </>
        )}
        {!isAdmin && <TabsTrigger value="my-exchanges">Mes échanges ({userExchanges.length})</TabsTrigger>}
      </TabsList>

      {isAdmin && (
        <>
          <TabsContent value="all">
            <AllExchangesTab exchanges={allExchanges} isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="my-exchanges">
            <MyExchangesTab exchanges={userExchanges} userId={userId} />
          </TabsContent>
          <TabsContent value="pending">
            <PendingExchangesTab exchanges={pendingExchanges} />
          </TabsContent>
        </>
      )}

      {!isAdmin && (
        <TabsContent value="my-exchanges">
          <MyExchangesTab exchanges={userExchanges} userId={userId} />
        </TabsContent>
      )}

      <RequestExchangeDialog open={showRequestDialog} onOpenChange={setShowRequestDialog} userId={userId} />
    </Tabs>
  )
}
