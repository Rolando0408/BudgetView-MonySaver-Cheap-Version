"use client"

import * as React from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import { FloatingAlertStack } from "@/components/ui/floating-alert-stack"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { CheckCircle2, CircleAlert, Mail } from "lucide-react"

export default function PasswordRecoveryPage() {
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError("Ingresa el correo asociado a tu cuenta.")
      return
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      setError("Variables de entorno de Supabase no configuradas.")
      return
    }

    setLoading(true)
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/restablecer-contrasena` : undefined
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
      })

      if (error) {
        setError(error.message)
        return
      }

      setSuccess("Te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.")
      setEmail("")
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
            <AlertTitle>No pudimos enviar el enlace</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert variant="success">
            <CheckCircle2 className="size-4" aria-hidden />
            <AlertTitle>Solicitud enviada</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </FloatingAlertStack>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <Mail className="size-6" />
          </div>
          <CardTitle className="text-2xl font-semibold">¿Olvidaste tu contraseña?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ingresa el correo que usaste para registrarte y te enviaremos instrucciones para restablecer tu contraseña.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Correo electrónico</Label>
              <Input
                id="recovery-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tucorreo@ejemplo.com"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando enlace..." : "Enviar instrucciones"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿Recordaste tu contraseña?{" "}
              <Link href="/login" className="font-semibold text-emerald-600 underline-offset-4 hover:underline">
                Volver al inicio de sesión
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
