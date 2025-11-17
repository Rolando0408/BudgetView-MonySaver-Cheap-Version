"use client"

import * as React from "react"
import {
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Plus,
  MoreVertical,
  Wallet2,
  ShoppingBag,
  UtensilsCrossed,
  Car,
  Flame,
  House,
  CircleDollarSign,
  Briefcase,
  PiggyBank,
  HandCoins,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TotalsState = {
  expenses: number
  income: number
  categories: number
}

type TransactionRow = {
  monto: number | string | null
  tipo: "ingreso" | "gasto" | null
  categorias:
    | {
        id: string
        nombre: string | null
      }
    | Array<{
        id: string
        nombre: string | null
      }>
    | null
}

type CategoryAggregate = {
  id: string
  name: string
  total: number
  count: number
  percentage: number
}

type CategoryGroups = {
  gastos: CategoryAggregate[]
  ingresos: CategoryAggregate[]
}

type CategoryAppearance = {
  card: string
  iconWrapper: string
  badge: string
  valueClass: string
  progress: string
  icon: LucideIcon
}

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "USD",
})

const expensePalettes: readonly CategoryAppearance[] = [
  {
    card: "border border-red-100 bg-red-50",
    iconWrapper: "bg-red-500 text-white",
    badge: "bg-red-500/15 text-red-600",
    valueClass: "text-red-600",
    progress: "bg-red-500",
    icon: Wallet2,
  },
  {
    card: "border border-orange-100 bg-orange-50",
    iconWrapper: "bg-orange-500 text-white",
    badge: "bg-orange-500/15 text-orange-600",
    valueClass: "text-orange-600",
    progress: "bg-orange-500",
    icon: ShoppingBag,
  },
  {
    card: "border border-purple-100 bg-purple-50",
    iconWrapper: "bg-purple-500 text-white",
    badge: "bg-purple-500/15 text-purple-600",
    valueClass: "text-purple-600",
    progress: "bg-purple-500",
    icon: UtensilsCrossed,
  },
  {
    card: "border border-amber-100 bg-amber-50",
    iconWrapper: "bg-amber-500 text-white",
    badge: "bg-amber-500/15 text-amber-600",
    valueClass: "text-amber-600",
    progress: "bg-amber-500",
    icon: Car,
  },
  {
    card: "border border-rose-100 bg-rose-50",
    iconWrapper: "bg-rose-500 text-white",
    badge: "bg-rose-500/15 text-rose-600",
    valueClass: "text-rose-600",
    progress: "bg-rose-500",
    icon: Flame,
  },
  {
    card: "border border-sky-100 bg-sky-50",
    iconWrapper: "bg-sky-500 text-white",
    badge: "bg-sky-500/15 text-sky-600",
    valueClass: "text-sky-600",
    progress: "bg-sky-500",
    icon: House,
  },
]

const incomePalettes: readonly CategoryAppearance[] = [
  {
    card: "border border-emerald-100 bg-emerald-50",
    iconWrapper: "bg-emerald-500 text-white",
    badge: "bg-emerald-500/15 text-emerald-600",
    valueClass: "text-emerald-600",
    progress: "bg-emerald-500",
    icon: CircleDollarSign,
  },
  {
    card: "border border-teal-100 bg-teal-50",
    iconWrapper: "bg-teal-500 text-white",
    badge: "bg-teal-500/15 text-teal-600",
    valueClass: "text-teal-600",
    progress: "bg-teal-500",
    icon: Briefcase,
  },
  {
    card: "border border-lime-100 bg-lime-50",
    iconWrapper: "bg-lime-500 text-white",
    badge: "bg-lime-500/15 text-lime-600",
    valueClass: "text-lime-700",
    progress: "bg-lime-500",
    icon: PiggyBank,
  },
  {
    card: "border border-cyan-100 bg-cyan-50",
    iconWrapper: "bg-cyan-500 text-white",
    badge: "bg-cyan-500/15 text-cyan-600",
    valueClass: "text-cyan-600",
    progress: "bg-cyan-500",
    icon: HandCoins,
  },
]

const hashString = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

const appearanceFor = (name: string, type: "gasto" | "ingreso"): CategoryAppearance => {
  const palettes = type === "gasto" ? expensePalettes : incomePalettes
  const index = hashString(name) % palettes.length
  return palettes[index]
}

export default function CategoriasPage() {
  const [totals, setTotals] = React.useState<TotalsState>({ expenses: 0, income: 0, categories: 0 })
  const [categoryGroups, setCategoryGroups] = React.useState<CategoryGroups>({ gastos: [], ingresos: [] })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [transactionsResult, categoriesResult] = await Promise.all([
          supabase.from("transacciones").select("monto,tipo,categorias(id,nombre)"),
          supabase.from("categorias").select("id", { count: "exact", head: true }),
        ])

        if (!active) return

        if (transactionsResult.error) {
          throw transactionsResult.error
        }
        if (categoriesResult.error) {
          throw categoriesResult.error
        }

        const data = (transactionsResult.data ?? []) as TransactionRow[]

        let expensesTotal = 0
        let incomeTotal = 0

        const aggregates = {
          gasto: new Map<string, { id: string; name: string; total: number; count: number }>(),
          ingreso: new Map<string, { id: string; name: string; total: number; count: number }>(),
        }

        data.forEach((tx) => {
          if (!tx.tipo) {
            return
          }
          const numericAmount = Number(tx.monto ?? 0)
          if (Number.isNaN(numericAmount)) {
            return
          }

          if (tx.tipo === "gasto") {
            expensesTotal += numericAmount
          }
          if (tx.tipo === "ingreso") {
            incomeTotal += numericAmount
          }

          const categoryRecord = Array.isArray(tx.categorias) ? tx.categorias[0] : tx.categorias
          const categoryId = categoryRecord?.id ?? `sin-${tx.tipo}`
          const categoryName = categoryRecord?.nombre?.trim() || "Sin categoría"
          const bucket = aggregates[tx.tipo]

          if (!bucket.has(categoryId)) {
            bucket.set(categoryId, {
              id: categoryId,
              name: categoryName,
              total: 0,
              count: 0,
            })
          }

          const entry = bucket.get(categoryId)
          if (!entry) {
            return
          }
          entry.total += numericAmount
          entry.count += 1
        })

        const gastoArray: CategoryAggregate[] = Array.from(aggregates.gasto.values()).map((item) => ({
          ...item,
          percentage: expensesTotal === 0 ? 0 : (item.total / expensesTotal) * 100,
        }))

        const ingresoArray: CategoryAggregate[] = Array.from(aggregates.ingreso.values()).map((item) => ({
          ...item,
          percentage: incomeTotal === 0 ? 0 : (item.total / incomeTotal) * 100,
        }))

        gastoArray.sort((a, b) => b.total - a.total)
        ingresoArray.sort((a, b) => b.total - a.total)

        setTotals({
          expenses: expensesTotal,
          income: incomeTotal,
          categories: categoriesResult.count ?? 0,
        })

        setCategoryGroups({ gastos: gastoArray, ingresos: ingresoArray })
      } catch (fetchError) {
        if (!active) return
        console.error("Error al cargar datos de categorías", fetchError)
        setError("No pudimos cargar la información. Intenta nuevamente.")
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      active = false
    }
  }, [])

  const summaryCards = [
    {
      title: "Total Gastos",
      value: currencyFormatter.format(totals.expenses),
      icon: ArrowDownCircle,
      accent: "bg-red-50 border border-red-100 text-red-600",
      iconStyles: "bg-red-500 text-white",
    },
    {
      title: "Total Ingresos",
      value: currencyFormatter.format(totals.income),
      icon: ArrowUpCircle,
      accent: "bg-emerald-50 border border-emerald-100 text-emerald-600",
      iconStyles: "bg-emerald-500 text-white",
    },
    {
      title: "Categorías Activas",
      value: totals.categories.toString(),
      icon: BarChart3,
      accent: "bg-blue-50 border border-blue-100 text-blue-600",
      iconStyles: "bg-blue-500 text-white",
    },
  ]

  const sections: Array<{
    title: string
    description: string
    data: CategoryAggregate[]
    type: "gasto" | "ingreso"
  }> = [
    {
      title: "Categorías de Gastos",
      description: "Distribución de tus gastos por categoría.",
      data: categoryGroups.gastos,
      type: "gasto",
    },
    {
      title: "Categorías de Ingresos",
      description: "Resumen de dónde provienen tus ingresos.",
      data: categoryGroups.ingresos,
      type: "ingreso",
    },
  ]

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Categorías</h1>
          <p className="text-muted-foreground text-sm">
            Revisa el comportamiento de tus categorías y crea nuevas según lo necesites.
          </p>
        </div>
        <Button type="button" className="w-full gap-2 md:w-auto" size="lg">
          <Plus className="size-4" />
          Nueva Categoría
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map(({ title, value, icon: Icon, accent, iconStyles }) => (
          <Card key={title} className={accent}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <span className={cn("flex size-12 items-center justify-center rounded-full", iconStyles)}>
                <Icon className="size-6" />
              </span>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-16 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <p className="text-3xl font-semibold tracking-tight">{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {sections.map(({ title, description, data, type }) => (
        <section key={title} className="space-y-4">
          <div>
            <h2
              className={cn(
                "text-xl font-semibold",
                type === "gasto" ? "text-red-600" : "text-emerald-600"
              )}
            >
              {title}
            </h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Aún no registras transacciones en estas categorías.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.map((category) => {
                const appearance = appearanceFor(category.name, type)
                const Icon = appearance.icon
                const percentageLabel = `${category.percentage.toFixed(1)}%`
                const transactionLabel = `${category.count} ${category.count === 1 ? "transacción" : "transacciones"}`

                return (
                  <Card key={`${type}-${category.id}`} className={cn("relative overflow-hidden", appearance.card)}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                      <div className="flex items-start gap-3">
                        <span className={cn("flex size-12 items-center justify-center rounded-full", appearance.iconWrapper)}>
                          <Icon className="size-6" />
                        </span>
                        <div>
                          <CardTitle className={cn("text-lg font-semibold text-black", "dark:text-black")}>
                            {category.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">{transactionLabel}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        aria-label={`Acciones para ${category.name}`}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className={cn("text-3xl font-semibold tracking-tight", appearance.valueClass)}>
                          {currencyFormatter.format(category.total)}
                        </p>
                        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", appearance.badge)}>
                          {percentageLabel}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Del total de {type === "gasto" ? "gastos" : "ingresos"}
                      </div>
                      <div className="h-2 rounded-full bg-muted/70">
                        <div
                          className={cn("h-full rounded-full", appearance.progress)}
                          style={{ width: `${Math.min(category.percentage, 100)}%` }}
                          aria-hidden
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
