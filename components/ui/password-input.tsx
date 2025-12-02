"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

type PasswordInputProps = React.ComponentProps<typeof Input>

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false)
    const disabled = props.disabled ?? false

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={isVisible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:text-muted-foreground/50"
          onClick={() => setIsVisible((prev) => !prev)}
          aria-label={isVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={isVisible}
          disabled={disabled}
        >
          {isVisible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    )
  }
)

PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
