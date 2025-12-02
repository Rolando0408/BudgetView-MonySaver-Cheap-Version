"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FloatingAlertStack } from "@/components/ui/floating-alert-stack"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { supabase } from "@/lib/supabaseClient"
import { Loader2, ArrowLeft, CircleAlert, CheckCircle2 } from "lucide-react"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [emailError, setEmailError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [oauthLoading, setOauthLoading] = React.useState(false)
  const router = useRouter()

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailRegex.test(trimmedEmail)) {
      setEmailError("Ingresa un correo con formato válido (ejemplo: usuario@dominio.com)")
      return
    }

    setEmailError(null)

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }

    if (/\s/.test(password)) {
      setError("La contraseña no puede contener espacios")
      return
    }

    if (/\s/.test(confirmPassword)) {
      setError("La confirmación no puede contener espacios")
      return
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      setError("Variables de entorno de Supabase no configuradas")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { name: trimmedName },
        },
      })

      if (error) {
        const msg = error.message?.toLowerCase() || ""
        const isDuplicate =
          msg.includes("already registered") ||
          msg.includes("already exists") ||
          msg.includes("ya existe") ||
          msg.includes("existe") ||
          msg.includes("correo") && msg.includes("registr")

        if (isDuplicate) {
          setError(
            "Este correo ya está registrado. Inicia sesión o recupera tu contraseña."
          )
        } else {
          setError(error.message)
        }
        return
      }

      // Supabase puede no lanzar error si la cuenta existe sin identidades nuevas.
      // Patrón recomendado: user.identities.length === 0 => correo ya está registrado.
      const identities = data.user?.identities
      if (Array.isArray(identities) && identities.length === 0) {
        setError(
          "Este correo ya está registrado. Inicia sesión o recupera tu contraseña."
        )
        return
      }

      router.push("/registro-confirmacion")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido al registrar"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = React.useCallback(async () => {
    if (oauthLoading) return
    setError(null)
    setNotice(null)

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      setError("Variables de entorno de Supabase no configuradas")
      return
    }

    setOauthLoading(true)
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: redirectTo ? { redirectTo } : undefined,
      })

      if (error) {
        setError(error.message)
        setOauthLoading(false)
        return
      }

      setNotice("Redirigiéndote a Google para completar el registro...")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido al continuar con Google"
      setError(message)
    } finally {
      setOauthLoading(false)
    }
  }, [oauthLoading])

  return (
    <>
      <FloatingAlertStack position="top-center">
        {error && (
          <Alert variant="destructive">
            <CircleAlert className="size-4" aria-hidden />
            <AlertTitle>No pudimos crear tu cuenta</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert variant="info">
            <CheckCircle2 className="size-4" aria-hidden />
            <AlertTitle>Continuemos con Google</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
      </FloatingAlertStack>
      <form className={cn("flex flex-col gap-6", className)} onSubmit={onSubmit} noValidate {...props}>
      <FieldGroup>
        <Field>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/login")}
            aria-label="Volver al login"
          >
            <ArrowLeft className="size-4" /> Volver al login
          </Button>
        </Field>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Completa los campos para crear tu cuenta.
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="name">Nombre completo</FieldLabel>
          <Input
            id="name"
            type="text"
            placeholder="Juan Pérez"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => {
              const value = e.target.value
              setEmail(value)
              if (emailError) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                if (emailRegex.test(value.trim().toLowerCase())) {
                  setEmailError(null)
                }
              }
            }}
            required
          />
          <FieldError errors={emailError ? [{ message: emailError }] : []} />
          <FieldDescription>
            Usaremos este correo para contactarte. No lo compartiremos con
            nadie más.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <FieldDescription>
            Debe tener al menos 8 caracteres y no puede incluir espacios.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">Confirmar contraseña</FieldLabel>
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
          <FieldDescription>Vuelve a escribir tu contraseña.</FieldDescription>
        </Field>
        <Field>
          <Button type="submit" disabled={loading || oauthLoading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creando cuenta...
              </>
            ) : (
              "Crear cuenta"
            )}
          </Button>
        </Field>
        <FieldSeparator>O continúa con</FieldSeparator>
        <Field>
          <Button variant="outline" type="button" onClick={handleGoogleSignup} disabled={loading || oauthLoading}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
            {oauthLoading ? (
              <>
                <Loader2 className="ml-2 size-4 animate-spin" />
                Redirigiendo...
              </>
            ) : (
              "Registrarte con Google"
            )}
          </Button>
          <FieldDescription className="px-6 text-center">
            ¿Ya tienes una cuenta? <a href="/login">Inicia sesión</a>
          </FieldDescription>
        </Field>
      </FieldGroup>
      </form>
    </>
  )
}
