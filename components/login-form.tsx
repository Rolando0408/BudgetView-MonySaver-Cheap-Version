"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FloatingAlertStack } from "@/components/ui/floating-alert-stack"
import {
  Field,
  FieldError,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabaseClient"
import { Loader2, CheckCircle2, CircleAlert } from "lucide-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [errors, setErrors] = React.useState<{ email?: string; password?: string }>({})
  const [authError, setAuthError] = React.useState<string | null>(null)
  const [authSuccess, setAuthSuccess] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [oauthLoading, setOauthLoading] = React.useState(false)
  const redirectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  React.useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  function validate(values: { email: string; password: string }) {
    const next: { email?: string; password?: string } = {}
    if (!values.email) {
      next.email = "El correo es obligatorio"
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(values.email)) {
        next.email = "Correo inválido"
      }
    }
    if (!values.password) {
      next.password = "La contraseña es obligatoria"
    } else if (values.password.length < 6) {
      next.password = "La contraseña debe tener al menos 6 caracteres"
    }
    return next
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setAuthError(null)
    setAuthSuccess(null)
    const next = validate({ email, password })
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setLoading(true)
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        throw new Error("Variables de entorno de Supabase no configuradas")
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setAuthError(error.message)
      } else {
        setAuthSuccess("Inicio de sesión exitoso. Redirigiéndote al panel principal...")
        if (redirectTimeoutRef.current) {
          clearTimeout(redirectTimeoutRef.current)
        }
        redirectTimeoutRef.current = setTimeout(() => {
          router.push("/dashboard")
        }, 750)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido al iniciar sesión"
      setAuthError(message)
      setAuthSuccess(null)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = React.useCallback(async () => {
    if (oauthLoading) return
    setAuthError(null)
    setAuthSuccess(null)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      setAuthError("Variables de entorno de Supabase no configuradas")
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
        setAuthError(error.message)
        setOauthLoading(false)
        return
      }

      setAuthSuccess("Redirigiéndote a Google para continuar...")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido al iniciar sesión con Google"
      setAuthError(message)
    } finally {
      // En la mayoría de los casos Supabase redirige antes de este punto, pero reseteamos el estado por seguridad.
      setOauthLoading(false)
    }
  }, [oauthLoading])

  return (
    <>
      <FloatingAlertStack position="top-center">
        {authError && (
          <Alert variant="destructive">
            <CircleAlert className="size-4" aria-hidden />
            <AlertTitle>Error al iniciar sesión</AlertTitle>
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}
        {authSuccess && (
          <Alert variant="success">
            <CheckCircle2 className="size-4" aria-hidden />
            <AlertTitle>Sesión iniciada</AlertTitle>
            <AlertDescription>{authSuccess}</AlertDescription>
          </Alert>
        )}
      </FloatingAlertStack>
      <form className={cn("flex flex-col gap-6", className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Inicia sesión en tu cuenta</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Ingresa tus credenciales para acceder a tu cuenta.
          </p>
        </div>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Correo</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            required
          />
          <FieldError errors={errors.email ? [{ message: errors.email }] : []} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <a href="/recuperar-contrasena" className="ml-auto text-sm underline-offset-4 hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            required
          />
          <FieldError errors={errors.password ? [{ message: errors.password }] : []} />
        </Field>
        <Field>
          <Button type="submit" disabled={loading || oauthLoading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Iniciando...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </Field>
        <FieldSeparator>O continúa con</FieldSeparator>
        <Field>
          <Button variant="outline" type="button" onClick={handleGoogleSignIn} disabled={loading || oauthLoading}>
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
              "Continúa con Google"
            )}
          </Button>
          <FieldDescription className="text-center">
            ¿No tienes cuenta?{" "}
            <a href="/register" className="underline underline-offset-4">
              Regístrate
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
      </form>
    </>
  )
}
