"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Wallet, FolderKanban, PiggyBank, Download, ChevronLeft, ChevronRight, User2, LogOut } from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { supabase } from "@/lib/supabaseClient"

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/transacciones", label: "Transacciones", icon: Wallet },
  { href: "/dashboard/categorias", label: "Categorías", icon: FolderKanban },
  { href: "/dashboard/presupuestos", label: "Presupuestos", icon: PiggyBank },
  { href: "/dashboard/exportar", label: "Exportar", icon: Download },
]

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = React.useState(false)
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [displayName, setDisplayName] = React.useState("")
  const [signingOut, setSigningOut] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const dropdownRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    let active = true

    const resolveName = (name?: string | null, email?: string | null) => {
      const trimmed = name?.trim()
      setDisplayName(trimmed || email || "")
    }

    const loadUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()
        if (!active) return
        if (error) {
          setDisplayName("")
          return
        }
        resolveName(user?.user_metadata?.name, user?.email)
      } catch (_error) {
        if (!active) return
        setDisplayName("")
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      resolveName(session?.user?.user_metadata?.name, session?.user?.email)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  React.useEffect(() => {
    if (!profileOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setProfileOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [profileOpen])

  const handleSignOut = React.useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
      setProfileOpen(false)
      router.push("/login")
    } catch (error) {
      console.error("Error al cerrar sesión", error)
    } finally {
      setSigningOut(false)
    }
  }, [router, signingOut])

  const accountLabel = displayName || "Cuenta"

  return (
    <aside
      className={cn(
        "flex h-full flex-col gap-3 rounded-xl bg-card p-3 shadow-sm border transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
        className
      )}
    >
      <div className="flex items-center gap-25">
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight">Budgetview</span>
        )}
        <div className="flex items-center gap-1 ml-[0.2em]">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full border bg-background/60"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>
      </div>
      <div className="h-px bg-border" />
      <div className="flex-1 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Button
              key={href}
              type="button"
              variant={active ? "default" : "ghost"}
              className={cn(
                      "w-full justify-start gap-2 rounded-lg",
                active && "bg-primary text-primary-foreground hover:bg-primary/90",
                collapsed && "px-0 justify-center"
              )}
              onClick={() => router.push(href)}
            >
              <Icon className="size-4" />
              {!collapsed && <span className="text-sm font-medium">{label}</span>}
            </Button>
          )
        })}
      </div>
      <div className="relative mt-3 text-xs text-muted-foreground">
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
            profileOpen ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
            collapsed && "justify-center px-0"
          )}
          onClick={() => setProfileOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={profileOpen}
        >
          <User2 className="size-4" />
          {!collapsed && <span className="truncate">{accountLabel}</span>}
        </Button>
        {profileOpen && (
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="Opciones de perfil"
            className={cn(
              "ml-10 absolute z-20 w-32 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg divide-y divide-border",
              collapsed
                ? "left-full top-1/2 ml-2 -translate-y-1/2 origin-left"
                : "top-full left-0 mt-2 origin-top"
            )}
          >
            <div className="flex flex-col gap-0.5 p-1">
              <ThemeToggle
                className="h-9 w-full justify-center gap-0.5 rounded-md border-0 bg-transparent px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              />
            </div>
            <div className="p-1">
              <Button
                type="button"
                variant="ghost"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                <LogOut className="size-4" />
                <span>Cerrar sesión</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
