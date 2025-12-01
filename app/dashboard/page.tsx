"use client"

import * as React from "react"
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar as CalendarIcon,
  Loader2,
  PiggyBank,
  TrendingUp,
} from "lucide-react"
import { format, subDays, eachDayOfInterval } from "date-fns"
import { es } from "date-fns/locale"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
} from "recharts"
import type { PieLabelRenderProps } from "recharts"

type TransactionType = "gasto" | "ingreso"

type TransactionRow = {
  id: string
  monto: number | string | null
  tipo: TransactionType | null
  fecha_transaccion: string | null
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

type Transaction = {
  id: string
  amount: number
  type: TransactionType
  date: string
  categoryId: string | null
  categoryName: string
}

type PeriodFilter = "7days" | "thisMonth" | "lastMonth" | "custom"

type BudgetConfig = {
  id: string
  label: string
  limit: number
  categoryId: string | null
  period: string | null
  periodKey: string | null
}

type BudgetRow = {
  id: string
  categoria_id: string | null
  monto: number | string | null
  periodo: string | null
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

type BudgetAlert = BudgetConfig & {
  spent: number
  percentage: number
  status: "ok" | "warn" | "danger"
}

const PERIOD_BUTTONS: Array<{ label: string; value: PeriodFilter }> = [
  { label: "Últimos 7 días", value: "7days" },
  { label: "Este mes", value: "thisMonth" },
  { label: "Mes pasado", value: "lastMonth" },
  { label: "Personalizado", value: "custom" },
]

const PIE_COLORS = ["#F97316", "#6366F1", "#EC4899", "#0EA5E9", "#22C55E", "#FACC15", "#8B5CF6"]

const RADIAN = Math.PI / 180

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "USD",
})

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function getRangeForFilter(filter: PeriodFilter, customStart?: Date, customEnd?: Date) {
  const now = new Date()

  switch (filter) {
    case "7days": {
      const start = startOfDay(subDays(now, 6))
      const end = endOfDay(now)
      return { start, end }
    }
    case "thisMonth": {
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
      const end = endOfDay(now)
      return { start, end }
    }
    case "lastMonth": {
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))
      return { start, end }
    }
    case "custom": {
      const start = customStart ? startOfDay(customStart) : undefined
      const end = customEnd ? endOfDay(customEnd) : undefined
      return { start, end }
    }
    default:
      return { start: undefined, end: undefined }
  }
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 999)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`
}

function getMonthKeyFromISO(value: string | null) {
  if (!value) return null
  const [year, month] = value.split("-")
  const yearNum = Number(year)
  const monthIndex = Number(month) - 1
  if (!Number.isFinite(yearNum) || !Number.isFinite(monthIndex)) {
    return null
  }
  return `${yearNum}-${monthIndex}`
}

function renderPieLabel(props: PieLabelRenderProps) {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    outerRadius = 0,
    percent = 0,
  } = props

  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null
  const radius = outerRadius + 18
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  const displayPercent = `${(percent * 100).toFixed(1)}%`

  return (
    <text
      x={x}
      y={y}
      fill="var(--foreground)"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      style={{ fontSize: "0.75rem", fontWeight: 600 }}
    >
      {displayPercent}
    </text>
  )
}

export default function DashboardPage() {
  const [walletId, setWalletId] = React.useState<string | null>(null)
  const [walletLoading, setWalletLoading] = React.useState(true)
  const [walletError, setWalletError] = React.useState<string | null>(null)
  const [transactions, setTransactions] = React.useState<Transaction[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [periodFilter, setPeriodFilter] = React.useState<PeriodFilter>("thisMonth")
  const [customStartDate, setCustomStartDate] = React.useState<Date | undefined>(undefined)
  const [customEndDate, setCustomEndDate] = React.useState<Date | undefined>(undefined)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [budgets, setBudgets] = React.useState<BudgetConfig[]>([])
  const [budgetsLoading, setBudgetsLoading] = React.useState(false)
  const [budgetsError, setBudgetsError] = React.useState<string | null>(null)

  const loadTransactions = React.useCallback(async (activeWallet: string) => {
    const query = supabase
      .from("transacciones")
      .select("id,monto,tipo,fecha_transaccion,categorias(id,nombre)")
      .eq("billetera_id", activeWallet)
      .order("fecha_transaccion", { ascending: false })

    const { data, error } = await query
    if (error) {
      throw error
    }

    const rows = (data ?? []) as TransactionRow[]

    return rows
      .map((row) => {
        const amount = Number(row.monto ?? 0)
        if (!row.tipo || !row.fecha_transaccion || Number.isNaN(amount)) {
          return null
        }
        const categoryRecord = Array.isArray(row.categorias) ? row.categorias[0] : row.categorias
        return {
          id: row.id,
          amount,
          type: row.tipo,
          date: row.fecha_transaccion,
          categoryId: categoryRecord?.id ?? null,
          categoryName: categoryRecord?.nombre?.trim() || "Sin categoría",
        }
      })
      .filter((row): row is Transaction => row !== null)
  }, [])

  const loadBudgets = React.useCallback(async (activeUserId: string) => {
    const { data, error } = await supabase
      .from("presupuestos")
      .select("id,categoria_id,monto,periodo,categorias:categoria_id (id,nombre)")
      .eq("usuario_id", activeUserId)

    if (error) {
      throw error
    }

    const rows = (data ?? []) as BudgetRow[]

    return rows
      .map((row) => {
        const limit = Number(row.monto ?? 0)
        if (Number.isNaN(limit)) {
          return null
        }

        const categoryRecord = Array.isArray(row.categorias) ? row.categorias[0] : row.categorias
        const periodKey = getMonthKeyFromISO(row.periodo)

        return {
          id: row.id,
          label: categoryRecord?.nombre?.trim() || "Sin categoría",
          limit,
          categoryId: categoryRecord?.id ?? row.categoria_id ?? null,
          period: row.periodo,
          periodKey,
        }
      })
      .filter((config): config is BudgetConfig => config !== null)
  }, [])

  React.useEffect(() => {
    let active = true

    const loadWallet = async () => {
      setWalletLoading(true)
      setWalletError(null)
      try {
        const { data, error } = await supabase
          .from("billeteras")
          .select("id")
          .order("nombre", { ascending: true })

        if (!active) return

        if (error) {
          throw error
        }

        const rows = (data ?? []) as Array<{ id: string }>
        if (rows.length === 0) {
          setWalletId(null)
          return
        }

        const stored = typeof window !== "undefined" ? window.localStorage.getItem("dashboard.activeWalletId") : null
        const resolved = stored && rows.some((wallet) => wallet.id === stored) ? stored : rows[0].id
        setWalletId(resolved)
      } catch (walletErr) {
        if (!active) return
        console.error("Error al cargar billeteras", walletErr)
        setWalletError("No pudimos cargar tus billeteras.")
        setWalletId(null)
      } finally {
        if (active) {
          setWalletLoading(false)
        }
      }
    }

    loadWallet()

    const handleWalletChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ walletId?: string }>).detail
      if (!detail?.walletId) return
      setWalletId(detail.walletId)
    }

    window.addEventListener("wallet:changed", handleWalletChanged as EventListener)

    return () => {
      active = false
      window.removeEventListener("wallet:changed", handleWalletChanged as EventListener)
    }
  }, [])

  React.useEffect(() => {
    let active = true

    const resolveUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (!active) return

        if (error) {
          throw error
        }

        setUserId(user?.id ?? null)
      } catch (userError) {
        if (!active) return
        console.error("Error al obtener el usuario actual", userError)
        setUserId(null)
        setBudgetsError("No pudimos cargar tus presupuestos.")
      }
    }

    resolveUser()

    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    if (!walletId) {
      setTransactions([])
      setLoading(false)
      return
    }

    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await loadTransactions(walletId)
        if (cancelled) return
        setTransactions(data)
      } catch (fetchError) {
        if (cancelled) return
        console.error("Error al cargar transacciones", fetchError)
        setError("No pudimos cargar la información. Intenta nuevamente.")
        setTransactions([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [walletId, loadTransactions])

  React.useEffect(() => {
    if (!userId) {
      setBudgets([])
      setBudgetsLoading(false)
      return
    }

    let cancelled = false
    setBudgetsLoading(true)
    setBudgetsError(null)

    loadBudgets(userId)
      .then((data) => {
        if (cancelled) return
        setBudgets(data)
      })
      .catch((fetchError) => {
        if (cancelled) return
        console.error("Error al cargar presupuestos", fetchError)
        setBudgetsError("No pudimos cargar tus presupuestos.")
        setBudgets([])
      })
      .finally(() => {
        if (!cancelled) {
          setBudgetsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [userId, loadBudgets])

  React.useEffect(() => {
    if (!walletId) return

    let cancelled = false
    const handleTransactionsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ walletId?: string }>).detail
      if (detail?.walletId && detail.walletId !== walletId) {
        return
      }

      loadTransactions(walletId)
        .then((data) => {
          if (cancelled) return
          setTransactions(data)
        })
        .catch((fetchError) => {
          if (cancelled) return
          console.error("Error al actualizar transacciones", fetchError)
        })
    }

    window.addEventListener("transactions:updated", handleTransactionsUpdated as EventListener)

    return () => {
      cancelled = true
      window.removeEventListener("transactions:updated", handleTransactionsUpdated as EventListener)
    }
  }, [walletId, loadTransactions])

  const filteredTransactions = React.useMemo(() => {
    const { start, end } = getRangeForFilter(periodFilter, customStartDate, customEndDate)
    return transactions.filter((tx) => {
      const txDate = new Date(tx.date)
      if (Number.isNaN(txDate.getTime())) {
        return false
      }
      if (start && txDate < start) {
        return false
      }
      if (end && txDate > end) {
        return false
      }
      return true
    })
  }, [transactions, periodFilter, customStartDate, customEndDate])

  const summary = React.useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => {
        if (tx.type === "ingreso") {
          acc.income += tx.amount
        } else {
          acc.expense += tx.amount
        }
        acc.count += 1
        return acc
      },
      { income: 0, expense: 0, count: 0 }
    )
  }, [filteredTransactions])

  const net = summary.income - summary.expense

  const expenseBreakdown = React.useMemo(() => {
    const totals = new Map<string, { label: string; value: number }>()

    filteredTransactions.forEach((tx) => {
      if (tx.type !== "gasto") return
      const key = tx.categoryName.toLowerCase()
      const current = totals.get(key)
      const nextValue = (current?.value ?? 0) + tx.amount
      totals.set(key, { label: tx.categoryName, value: nextValue })
    })

    const totalExpense = Array.from(totals.values()).reduce((acc, entry) => acc + entry.value, 0)

    return Array.from(totals.values()).map((entry) => ({
      name: entry.label,
      value: entry.value,
      percentage: totalExpense === 0 ? 0 : (entry.value / totalExpense) * 100,
    }))
  }, [filteredTransactions])

  const expenseChartConfig = React.useMemo<ChartConfig>(() => {
    const config: ChartConfig = {}
    expenseBreakdown.forEach((entry, index) => {
      const key = slugify(entry.name || `slice-${index}`) || `slice-${index}`
      config[key] = {
        label: `${entry.name} (${entry.percentage.toFixed(1)}%)`,
        color: PIE_COLORS[index % PIE_COLORS.length],
      }
    })
    return config
  }, [expenseBreakdown])

  const expenseChartData = React.useMemo(() => {
    return expenseBreakdown.map((entry, index) => {
      const key = slugify(entry.name || `slice-${index}`) || `slice-${index}`
      return {
        ...entry,
        slice: key,
        fill: `var(--color-${key})`,
      }
    })
  }, [expenseBreakdown])

  const topExpenseCategory = expenseBreakdown[0]

  const lineChartData = React.useMemo(() => {
    const { start: rangeStart, end: rangeEnd } = getRangeForFilter(periodFilter, customStartDate, customEndDate)
    const end = rangeEnd ?? endOfDay(new Date())
    const start = rangeStart ?? startOfDay(subDays(end, 29))

    const days = eachDayOfInterval({ start, end })
    const buckets = days.map((day) => ({
      dateLabel: format(day, "dd/MM", { locale: es }),
      gastos: 0,
      ingresos: 0,
    }))

    const bucketMap = new Map<string, { dateLabel: string; gastos: number; ingresos: number }>()
    buckets.forEach((bucket) => bucketMap.set(bucket.dateLabel, bucket))

    filteredTransactions.forEach((tx) => {
      const txDate = new Date(tx.date)
      if (txDate < start || txDate > end) {
        return
      }
      const label = format(txDate, "dd/MM", { locale: es })
      const bucket = bucketMap.get(label)
      if (!bucket) return
      if (tx.type === "gasto") {
        bucket.gastos += tx.amount
      } else {
        bucket.ingresos += tx.amount
      }
    })

    return buckets
  }, [filteredTransactions, periodFilter, customStartDate, customEndDate])

  const selectedMonthKey = React.useMemo(() => {
    const { start } = getRangeForFilter(periodFilter, customStartDate, customEndDate)
    const reference = start ?? customStartDate ?? customEndDate ?? new Date()
    return getMonthKey(reference)
  }, [periodFilter, customStartDate, customEndDate])

  const monthlyBudgets = React.useMemo(() => {
    if (budgets.length === 0) {
      return []
    }

    const scoped = budgets.filter((budget) => budget.periodKey === selectedMonthKey)
    if (scoped.length > 0) {
      return scoped
    }

    return budgets.filter((budget) => !budget.periodKey)
  }, [budgets, selectedMonthKey])

  const consolidatedBudgets = React.useMemo(() => {
    if (monthlyBudgets.length === 0) {
      return []
    }

    const grouped = new Map<string, BudgetConfig>()

    monthlyBudgets.forEach((budget) => {
      const key = budget.categoryId ?? budget.label.toLowerCase()
      const existing = grouped.get(key)
      if (!existing) {
        grouped.set(key, budget)
        return
      }

      const existingTime = existing.period ? new Date(existing.period).getTime() : Number.NEGATIVE_INFINITY
      const candidateTime = budget.period ? new Date(budget.period).getTime() : Number.NEGATIVE_INFINITY

      if (candidateTime >= existingTime) {
        grouped.set(key, budget)
      }
    })

    return Array.from(grouped.values())
  }, [monthlyBudgets])

  const budgetAlerts = React.useMemo<BudgetAlert[]>(() => {
    if (consolidatedBudgets.length === 0) {
      return []
    }

    const expenseTotalsById = new Map<string, number>()
    const expenseTotalsByLabel = new Map<string, number>()

    filteredTransactions.forEach((tx) => {
      if (tx.type !== "gasto") return
      if (tx.categoryId) {
        expenseTotalsById.set(tx.categoryId, (expenseTotalsById.get(tx.categoryId) ?? 0) + tx.amount)
      }

      const labelKey = tx.categoryName.toLowerCase()
      expenseTotalsByLabel.set(labelKey, (expenseTotalsByLabel.get(labelKey) ?? 0) + tx.amount)
    })

    return consolidatedBudgets.map((config) => {
      const spentById = config.categoryId ? expenseTotalsById.get(config.categoryId) : undefined
      const spentByLabel = expenseTotalsByLabel.get(config.label.toLowerCase())
      const spent = spentById ?? spentByLabel ?? 0
      const percentage = config.limit === 0 ? 0 : (spent / config.limit) * 100
      let status: BudgetAlert["status"] = "ok"
      if (percentage >= 100) {
        status = "danger"
      } else if (percentage >= 80) {
        status = "warn"
      }

      return {
        ...config,
        spent,
        percentage: clampPercentage(percentage),
        status,
      }
    })
  }, [filteredTransactions, consolidatedBudgets])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resumen general</h1>
        <p className="text-muted-foreground text-sm">
          Visualiza tus ingresos, gastos y el desempeño de tus presupuestos.
        </p>
      </div>

      {walletError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {walletError}
        </div>
      )}

      {!walletError && !walletLoading && !walletId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          Crea una billetera para comenzar a visualizar tus métricas.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="size-4" />
            <span className="font-medium">Periodo</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIOD_BUTTONS.map((button) => (
              <Button
                key={button.value}
                type="button"
                size="sm"
                variant={periodFilter === button.value ? "default" : "outline"}
                onClick={() => setPeriodFilter(button.value)}
                className={cn(
                  periodFilter === button.value &&
                  "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
                )}
              >
                {button.label}
              </Button>
            ))}
          </div>
        </div>

        {periodFilter === "custom" && (
          <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-500/10">
            <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center">
              <div className="flex flex-1 flex-col gap-2">
                <Label className="text-sm font-semibold">Fecha inicio</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {customStartDate ? format(customStartDate, "PPP", { locale: es }) : "Selecciona una fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      disabled={customEndDate ? { after: customEndDate } : undefined}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <Label className="text-sm font-semibold">Fecha fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {customEndDate ? format(customEndDate, "PPP", { locale: es }) : "Selecciona una fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      disabled={customStartDate ? { before: customStartDate } : undefined}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <ArrowUpCircle className="size-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(summary.income)}</div>
            <p className="text-xs text-muted-foreground">Total de ingresos en el periodo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos</CardTitle>
            <ArrowDownCircle className="size-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(summary.expense)}</div>
            <p className="text-xs text-muted-foreground">Total de gastos en el periodo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <TrendingUp className={cn("size-5", net >= 0 ? "text-emerald-500" : "text-red-500")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(net)}</div>
            <p className="text-xs text-muted-foreground">Ingresos - Gastos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
            <Activity className="size-5 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.count}</div>
            <p className="text-xs text-muted-foreground">Movimientos en el periodo</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="relative">
          <CardHeader>
            <CardTitle>Gastos por categoría</CardTitle>
            <CardDescription>Distribución de tus gastos en el periodo seleccionado.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-[280px] items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : expenseChartData.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No hay datos de gastos para este periodo.
              </p>
            ) : (
              <>
                <ChartContainer config={expenseChartConfig} className="mx-auto h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            hideLabel
                            valueFormatter={(value) => currencyFormatter.format(Number(value) || 0)}
                          />
                        }
                      />
                      <Pie
                        data={expenseChartData}
                        dataKey="value"
                        nameKey="slice"
                        innerRadius={0}
                        outerRadius={110}
                        paddingAngle={2}
                        stroke="var(--card)"
                        strokeWidth={1}
                        label={renderPieLabel}
                        labelLine={false}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  {expenseBreakdown.slice(0, 5).map((entry, index) => (
                    <div key={`${entry.name}-${index}`} className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <span className="font-medium text-foreground/90">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
          {topExpenseCategory && (
            <CardFooter className="flex-col gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <TrendingUp className="size-4 text-emerald-500" />
                {topExpenseCategory.name} concentra {topExpenseCategory.percentage.toFixed(1)}% del gasto.
              </div>
              <p>Revisa tus hábitos para equilibrar mejor tu presupuesto.</p>
            </CardFooter>
          )}
        </Card>

        <Card className="relative">
          <CardHeader>
            <CardTitle>Tendencia de gastos e ingresos</CardTitle>
            <CardDescription>Comparativo diario de los últimos días en el rango seleccionado.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : lineChartData.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">Sin movimientos para graficar.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => currencyFormatter.format(value)} tick={{ fontSize: 12 }} width={90} />
                  <Tooltip formatter={(value: number) => currencyFormatter.format(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <PiggyBank className="size-4 text-amber-500" />
              <CardTitle>Alertas de presupuesto</CardTitle>
            </div>
            <CardDescription>
              Controla el avance de tus categorías críticas. Gestiona tus límites desde la sección
              <span className="font-medium"> Presupuestos</span> para mantenerlos actualizados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgetsError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {budgetsError}
              </div>
            )}
            {budgetsLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Cargando presupuestos...
              </div>
            ) : budgetAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay presupuestos configurados para mostrar.</p>
            ) : (
              budgetAlerts.map((alert: BudgetAlert) => {
                const statusColors: Record<BudgetAlert["status"], string> = {
                  ok: "bg-emerald-500",
                  warn: "bg-amber-500",
                  danger: "bg-red-500",
                }

                const badgeColors: Record<BudgetAlert["status"], string> = {
                  ok: "text-emerald-600 bg-emerald-500/15 dark:text-emerald-300 dark:bg-emerald-500/20",
                  warn: "text-amber-600 bg-amber-500/15 dark:text-amber-200 dark:bg-amber-500/20",
                  danger: "text-red-600 bg-red-500/15 dark:text-red-200 dark:bg-red-500/20",
                }

                const progress = Math.min(alert.percentage, 100)

                return (
                  <div key={alert.id} className="space-y-2 rounded-xl border p-4">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{alert.label}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", badgeColors[alert.status])}>
                        {Math.round(alert.percentage)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{currencyFormatter.format(alert.spent)}</span>
                      <span>
                        {currencyFormatter.format(alert.limit)}
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted">
                      <div
                        className={cn("h-3 rounded-full", statusColors[alert.status])}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {alert.status === "danger" && (
                      <div className="flex items-center gap-2 text-xs font-medium text-red-600">
                        <AlertTriangle className="size-3" />
                        Presupuesto superado
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
