"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Wallet,
  FolderKanban,
  PiggyBank,
  Download,
  ChevronLeft,
  ChevronRight,
  User2,
  LogOut,
  CreditCard,
  Menu,
  CheckCircle2,
  CircleAlert,
  Loader2,
} from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { supabase } from "@/lib/supabaseClient"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FloatingAlertStack } from "@/components/ui/floating-alert-stack"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/transacciones", label: "Transacciones", icon: CreditCard },
  { href: "/dashboard/billeteras", label: "Billeteras", icon: Wallet },
  { href: "/dashboard/categorias", label: "Categorías", icon: FolderKanban },
  { href: "/dashboard/presupuestos", label: "Presupuestos", icon: PiggyBank },
  { href: "/dashboard/exportar", label: "Exportar", icon: Download },
]

type SidebarProps = {
  className?: string
  onNavigate?: (href: string) => void
  navigating?: boolean
}

export function Sidebar({ className, onNavigate, navigating = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = React.useState(false)
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [displayName, setDisplayName] = React.useState("")
  const [signingOut, setSigningOut] = React.useState(false)
  const [signOutError, setSignOutError] = React.useState<string | null>(null)
  const [signOutSuccess, setSignOutSuccess] = React.useState<string | null>(null)
  const [signOutDialogOpen, setSignOutDialogOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const dropdownRef = React.useRef<HTMLDivElement | null>(null)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [isDesktop, setIsDesktop] = React.useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 640px)").matches : false
  )

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
      } catch {
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

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const mediaQuery = window.matchMedia("(min-width: 640px)")
    const update = () => setIsDesktop(mediaQuery.matches)
    update()
    mediaQuery.addEventListener("change", update)
    return () => mediaQuery.removeEventListener("change", update)
  }, [])

  const closeSignOutDialog = React.useCallback(() => {
    setSignOutDialogOpen(false)
  }, [])

  const handleSignOut = React.useCallback(async () => {
    if (signingOut) return

    setSigningOut(true)
    setSignOutError(null)
    setSignOutSuccess(null)
    try {
      await supabase.auth.signOut()
      setProfileOpen(false)
      setSignOutSuccess("Cerraste sesión correctamente.")
      closeSignOutDialog()
      window.setTimeout(() => router.push("/login"), 400)
    } catch (error) {
      console.error("Error al cerrar sesión", error)
      setSignOutError("No pudimos cerrar sesión. Intenta nuevamente.")
    } finally {
      setSigningOut(false)
    }
  }, [router, signingOut, closeSignOutDialog])

  React.useEffect(() => {
    if (!signOutSuccess) return
    const timeoutId = window.setTimeout(() => setSignOutSuccess(null), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [signOutSuccess])

  React.useEffect(() => {
    if (!signOutError) return
    const timeoutId = window.setTimeout(() => setSignOutError(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [signOutError])

  const accountLabel = displayName || "Cuenta"

  const handleNavigate = React.useCallback(
    (href: string) => {
      if (pathname === href) return
      if (onNavigate) {
        onNavigate(href)
        return
      }
      router.push(href)
    },
    [onNavigate, pathname, router]
  )

  const SidebarContent = ({
    className: extraClassName,
    forceExpanded = false,
    showCollapseToggle = true,
  }: {
    className?: string
    forceExpanded?: boolean
    showCollapseToggle?: boolean
  }) => {
    const isCollapsed = forceExpanded ? false : collapsed
    const isMobileView = forceExpanded

    const onNavigateAndClose = (href: string) => {
      handleNavigate(href)
      if (forceExpanded) {
        setMobileOpen(false)
      }
    }

    return (
      <aside
        className={cn(
          "relative z-40 flex h-full min-h-[calc(100svh-5rem)] flex-col gap-3 rounded-xl bg-card p-3 shadow-sm border transition-all duration-300 ease-in-out sm:sticky sm:top-26 sm:self-start",
          isCollapsed && !forceExpanded ? "w-16" : "w-60",
          className,
          extraClassName
        )}
        style={{
          width: forceExpanded ? "12rem" : undefined,
        }}
      >
        <div className="flex items-center md:gap-35 lg:gap-35">
          {!isCollapsed && (
            <span className="text-sm font-semibold tracking-tight">Menú</span>
          )}
          {showCollapseToggle && (
            <div className="flex items-center gap-1 ml-[0.2em] transition-opacity duration-300 ease-in-out">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full border bg-background/60"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
              >
                {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
              </Button>
            </div>
          )}
        </div>
      <div className="h-px bg-border" />
      <div className="flex-1 min-h-0 space-y-1 overflow-auto">
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
                isCollapsed && "px-0 justify-center"
              )}
              onClick={() => onNavigateAndClose(href)}
              disabled={navigating && !active}
            >
              <Icon className="size-4" />
              {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
            </Button>
          )
        })}
      </div>
      <div className="mt-auto pb-1 text-xs text-muted-foreground">
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
            profileOpen ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
            isCollapsed && "justify-center px-0"
          )}
          onClick={() => setProfileOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={profileOpen}
        >
          <User2 className="size-4" />
          {!isCollapsed && <span className="truncate">{accountLabel}</span>}
        </Button>
        {profileOpen && isMobileView && (
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="Opciones de perfil"
            className="mt-2 flex flex-col divide-y divide-border rounded-lg border bg-card text-card-foreground shadow-sm"
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
                onClick={() => {
                  setProfileOpen(false)
                  setSignOutDialogOpen(true)
                }}
              >
                <LogOut className="size-4" />
                <span>Cerrar sesión</span>
              </Button>
            </div>
          </div>
        )}

        {profileOpen && !isMobileView && (
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="Opciones de perfil"
            className={cn(
              "absolute z-50 overflow-hidden rounded-lg border shadow-lg divide-y divide-border",
              "ml-10 w-32 bg-popover text-popover-foreground",
              isCollapsed
                ? "left-full top-2 ml-2 -translate-y-1/2 origin-left"
                : "top-[-105] left-0 mt-2 origin-top"
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
                onClick={() => {
                  setProfileOpen(false)
                  setSignOutDialogOpen(true)
                }}
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

  return (
    <>
      <FloatingAlertStack>
        {signOutError && (
          <Alert variant="destructive">
            <CircleAlert className="size-4" aria-hidden />
            <AlertTitle>No pudimos cerrar sesión</AlertTitle>
            <AlertDescription>{signOutError}</AlertDescription>
          </Alert>
        )}
        {signOutSuccess && (
          <Alert variant="success">
            <CheckCircle2 className="size-4" aria-hidden />
            <AlertTitle>Sesión cerrada</AlertTitle>
            <AlertDescription>{signOutSuccess}</AlertDescription>
          </Alert>
        )}
      </FloatingAlertStack>
      <AlertDialog open={signOutDialogOpen} onOpenChange={(open) => (open ? setSignOutDialogOpen(true) : closeSignOutDialog())}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrará tu sesión actual y volverás a la pantalla de acceso. Puedes iniciar sesión nuevamente cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut} onClick={closeSignOutDialog}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              disabled={signingOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {signingOut ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Saliendo...
                </>
              ) : (
                "Cerrar sesión"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="sm:hidden">
        {!isDesktop && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="fixed bottom-4 left-4 z-40 rounded-full shadow-lg"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </Button>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent className="h-full w-full max-w-48 p-0">
                <div className="flex h-full flex-col overflow-visible bg-card">
                  <SidebarContent
                    className="w-full rounded-none border-0 shadow-none"
                    forceExpanded
                    showCollapseToggle={false}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>

      <div className="hidden sm:block">
        {isDesktop && <SidebarContent />}
      </div>
    </>
  )
}
