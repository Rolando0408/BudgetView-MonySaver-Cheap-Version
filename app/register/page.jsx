import { GalleryVerticalEnd } from "lucide-react"
import Image from "next/image"

import { SignupForm } from "@/components/signup-form"
import { ThemeToggle } from "@/components/ui/theme-toggle"

export default function SignupPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2 relative">
      <div className="absolute right-4 top-4 z-50">
        <ThemeToggle className="rounded-full shadow-sm" />
      </div>
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/login" aria-label="Volver al login" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Budgetview Monysaver Cheap Version
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block overflow-hidden">
        <Image
          src="/next.svg"
          alt="Logo de Next.js"
          width={400}
          height={400}
          priority
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 dark:invert"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src="/next.svg"
            alt="Logo Next.js grande"
            width={160}
            height={160}
            className="dark:invert"
          />
        </div>
      </div>
    </div>
  )
}
