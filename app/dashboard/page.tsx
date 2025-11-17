import { Sidebar } from "@/components/sidebar"

export default function DashboardPage() {
  return (
    <div className="flex min-h-svh bg-background p-6 gap-6">
      <Sidebar />
      <main className="flex-1 rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-2">Iniciaste sesión</h1>
        <p className="text-muted-foreground text-sm">
          Aquí podrás ver el resumen de tus transacciones, categorías y presupuestos.
        </p>
      </main>
    </div>
  )
}
