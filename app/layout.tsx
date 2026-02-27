import type React from "react"
import type { Metadata } from "next"
import { Inter, Roboto_Mono } from "next/font/google"
import "./globals.css"
import { Suspense } from "react"
import { Toaster } from "@/components/ui/toaster"

const geistSans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Horaire SSIV - Gestion des horaires de pompiers",
  description: "Application de gestion des horaires pour les pompiers",
  generator: "v0.app",
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <head>
        <script suppressHydrationWarning>
          {`if ('scrollRestoration' in window.history) { window.history.scrollRestoration = 'manual'; }`}
        </script>
      </head>
      <body className={`font-sans ${geistSans.variable} ${geistMono.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Toaster />
      </body>
    </html>
  )
}
