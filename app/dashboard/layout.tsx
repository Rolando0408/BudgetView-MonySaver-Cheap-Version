"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { supabase } from "@/lib/supabaseClient"
import { Header } from "@/components/header"


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = React.useState(false)
  const [checking, setChecking] = React.useState(true)
  const [navigating, startTransition] = React.useTransition()

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

  const handleNavigate = React.useCallback(
    (href: string) => {
      if (href === pathname) return
      startTransition(() => {
        router.push(href)
      })
    },
    [pathname, router]
  )

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
    <div>
      <Header />
      <div className="flex min-h-svh bg-background gap-6 pr-6 pb-6 pl-6 pt-40 md:pt-30">
        <Sidebar onNavigate={handleNavigate} navigating={navigating} />
        <main className="relative flex-1 rounded-xl border bg-card p-6 shadow-sm" aria-busy={navigating}>
          {navigating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/75 backdrop-blur-sm">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className={`transition-opacity ${navigating ? "opacity-50" : "opacity-100"}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
