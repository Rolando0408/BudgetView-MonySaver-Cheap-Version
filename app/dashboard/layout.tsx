"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { supabase } from "@/lib/supabaseClient"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authorized, setAuthorized] = React.useState(false)
  const [checking, setChecking] = React.useState(true)

  React.useEffect(() => {
    let active = true

    const checkSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        if (!active) return
        if (error || !session) {
          router.replace("/login")
          return
        }
        setAuthorized(true)
      } catch (_error) {
        if (!active) return
        router.replace("/login")
      } finally {
        if (active) {
          setChecking(false)
        }
      }
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (!session) {
        setAuthorized(false)
        setChecking(true)
        router.replace("/login")
        return
      }
      setAuthorized(true)
      setChecking(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [router])

  if (checking) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!authorized) {
    return null
  }

  return (
    <div className="flex min-h-svh bg-background p-6 gap-6">
      <Sidebar />
      <main className="flex-1 rounded-xl border bg-card p-6 shadow-sm">
        {children}
      </main>
    </div>
  )
}
