import Image from "next/image"
import { LoginForm } from "@/components/login-form"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Logo } from "@/components/logo";


export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2 relative">
      <div className="absolute right-4 top-4 z-50">
        <ThemeToggle className="rounded-full shadow-sm" />
      </div>
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <Logo className="justify-center mb-6 -ml-15" />
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block overflow-hidden">
        <Image
          src="/images/login-bg.png"
          alt="fondo de login"
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  )
}
