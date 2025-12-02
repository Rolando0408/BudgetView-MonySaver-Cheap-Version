"use client"

import * as React from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import { FloatingAlertStack } from "@/components/ui/floating-alert-stack"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, CircleAlert, Loader2, LockKeyhole } from "lucide-react"

const MIN_PASSWORD_LENGTH = 8

export default function ResetPasswordPage() {
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [initializing, setInitializing] = React.useState(true)
  const [sessionReady, setSessionReady] = React.useState(false)
  const [sessionError, setSessionError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const initSession = async () => {
      setInitializing(true)
      setSessionError(null)

      try {
        const currentUrl = new URL(window.location.href)
        const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""))
        const searchParams = currentUrl.searchParams
        const codeFromQuery = searchParams.get("code")
        const accessToken = hashParams.get("access_token")
        const refreshToken = hashParams.get("refresh_token")

        if (codeFromQuery) {
          const { error } = await supabase.auth.exchangeCodeForSession(codeFromQuery)
          if (error) throw error
          setSessionReady(true)
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
          setSessionReady(true)
        } else {
          setSessionError("El enlace no es válido o ya expiró. Solicita uno nuevo desde la página de recuperación.")
        }

        if (window.location.hash || window.location.search) {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      } catch (initError) {
        const message = initError instanceof Error ? initError.message : "No pudimos validar tu enlace."
        setSessionError(message)
      } finally {
        setInitializing(false)
      }
    }

    initSession()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!sessionReady) {
      setError("Necesitamos validar tu enlace antes de continuar. Recarga la página o solicita uno nuevo.")
      return
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        throw error
      }

      setSuccess("Tu contraseña se actualizó. Puedes iniciar sesión con tus nuevas credenciales.")
      setPassword("")
      setConfirmPassword("")
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Ocurrió un error inesperado."
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <FloatingAlertStack position="top-center">
        {error && (
          <Alert variant="destructive">
            <CircleAlert className="size-4" aria-hidden />
            <AlertTitle>No pudimos actualizar tu contraseña</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert variant="success">
            <CheckCircle2 className="size-4" aria-hidden />
            <AlertTitle>Listo</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </FloatingAlertStack>

      <Card className="w-full max-w-md">
        {initializing ? (
          <>
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <Loader2 className="size-6 animate-spin" aria-hidden />
              </div>
              <CardTitle className="text-2xl font-semibold">Validando enlace...</CardTitle>
              <p className="text-sm text-muted-foreground">
                Estamos preparando todo para que puedas definir una nueva contraseña.
              </p>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground">
              Esto suele tardar solo unos segundos.
            </CardContent>
          </>
        ) : sessionError ? (
          <>
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <CircleAlert className="size-6" aria-hidden />
              </div>
              <CardTitle className="text-2xl font-semibold">El enlace no es válido</CardTitle>
              <p className="text-sm text-muted-foreground">
                Es posible que haya expirado o ya haya sido utilizado. Pide un nuevo correo de recuperación.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <Button asChild className="w-full">
                <Link href="/recuperar-contrasena">Solicitar nuevo enlace</Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                Si crees que se trata de un error, intenta abrir el enlace desde el mismo dispositivo en el que lo solicitaste.
              </p>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <LockKeyhole className="size-6" aria-hidden />
              </div>
              <CardTitle className="text-2xl font-semibold">Define tu nueva contraseña</CardTitle>
              <p className="text-sm text-muted-foreground">
                Elige una contraseña segura y no la compartas con nadie.
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nueva contraseña</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••••"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Guardando cambios...
                    </span>
                  ) : (
                    "Guardar contraseña"
                  )}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  ¿Ya recuerdas tus credenciales? {" "}
                  <Link href="/login" className="font-semibold text-emerald-600 underline-offset-4 hover:underline">
                    Inicia sesión
                  </Link>
                </p>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
