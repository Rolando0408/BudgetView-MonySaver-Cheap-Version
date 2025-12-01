"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  CircleDollarSign,
  PiggyBank,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "USD",
})

const monthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
})

const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

type CategoryRow = {
  id: string
  nombre: string | null
  tipo: "gasto" | "ingreso" | null
}

type BudgetRow = {
  id: string
  monto: number
  periodo: string
  categoria_id: string
  categorias:
    | { id: string; nombre: string | null }
    | Array<{ id: string; nombre: string | null }>
    | null
}

type TransactionRow = {
  categoria_id: string | null
  monto: number | string | null
}

type BudgetWithStats = {
  id: string
  categoriaId: string
  categoriaNombre: string
  limit: number
  spent: number
  available: number
  percentage: number
  exceeded: boolean
  nearLimit: boolean
  periodISO: string
}

type MonthYearPickerProps = {
  selected?: Date
  onSelect: (date: Date) => void
  fromYear?: number
  toYear?: number
  minMonth?: string
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  selected,
  onSelect,
  fromYear = 2018,
  toYear = 2035,
  minMonth,
}) => {
  const minYear = Math.min(fromYear, toYear)
  const maxYear = Math.max(fromYear, toYear)
  const baseYear = selected?.getFullYear() ?? new Date().getFullYear()
  const initialYear = Math.min(Math.max(baseYear, minYear), maxYear)
  const [year, setYear] = React.useState(initialYear)

  const years = React.useMemo(() => {
    const result: number[] = []
    for (let current = minYear; current <= maxYear; current += 1) {
      result.push(current)
    }
    return result
  }, [minYear, maxYear])

  React.useEffect(() => {
    if (!selected) return
    const nextYear = Math.min(Math.max(selected.getFullYear(), minYear), maxYear)
    setYear(nextYear)
  }, [selected, minYear, maxYear])

  const handleYearChange = React.useCallback(
    (value: string) => {
      const numeric = Number(value)
      if (Number.isNaN(numeric)) return
      setYear(numeric)
      if (selected) {
        onSelect(new Date(numeric, selected.getMonth(), 1))
      }
    },
    [onSelect, selected]
  )

  const handleMonthSelect = React.useCallback(
    (monthIndex: number) => {
      onSelect(new Date(year, monthIndex, 1))
    },
    [onSelect, year]
  )

  const selectedMonthIndex = selected?.getMonth()
  const selectedYear = selected?.getFullYear()

  return (
    <div className="w-72 space-y-4 p-4">
      <Select value={String(year)} onValueChange={handleYearChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecciona un año" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {years.map((yearOption) => (
            <SelectItem key={yearOption} value={String(yearOption)}>
              {yearOption}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-3 gap-2">
        {MONTH_LABELS.map((monthName, index) => {
          const isActive = selectedMonthIndex === index && selectedYear === year
          const candidateDate = new Date(year, index, 1)
          const candidateValue = format(candidateDate, "yyyy-MM")
          const disabled = Boolean(minMonth && candidateValue < minMonth && !isActive)
          return (
            <Button
              key={monthName}
              type="button"
              variant={isActive ? "default" : "outline"}
              className="h-10 justify-center text-sm"
              onClick={() => handleMonthSelect(index)}
              disabled={disabled}
            >
              {monthName.slice(0, 3)}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

const getCurrentMonthValue = () => format(new Date(), "yyyy-MM")
const toDateOnly = (value: string) => {
  if (!value) return null
  return `${value}-01`
}

const parsePeriodLabel = (value: string) => {
  if (!value) {
    return ""
  }
  const date = new Date(value)
  return monthFormatter.format(date)
}

const monthStringToDate = (value?: string) => {
  if (!value) return undefined
  const [year, month] = value.split("-").map(Number)
  if (!year || !month) return undefined
  return new Date(year, month - 1, 1)
}

const extractMonthValue = (periodISO?: string | null) => {
  if (!periodISO) return ""
  return periodISO.slice(0, 7)
}

const normalizeToCurrentOrFutureMonth = (value: string) => {
  const current = getCurrentMonthValue()
  if (!value) return current
  return value < current ? current : value
}

const isPastMonthValue = (value: string) => {
  if (!value) return false
  return value < getCurrentMonthValue()
}

export default function PresupuestosPage() {
  const [selectedMonth, setSelectedMonth] = React.useState<string>(getCurrentMonthValue())
  const [budgets, setBudgets] = React.useState<BudgetWithStats[]>([])
  const [categories, setCategories] = React.useState<CategoryRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingBudget, setEditingBudget] = React.useState<BudgetWithStats | null>(null)
  const [formCategoryId, setFormCategoryId] = React.useState("")
  const [formAmount, setFormAmount] = React.useState("")
  const [formPeriod, setFormPeriod] = React.useState(getCurrentMonthValue())
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const minSelectableMonth = getCurrentMonthValue()

  const selectedMonthDate = React.useMemo(() => monthStringToDate(selectedMonth), [selectedMonth])
  const formPeriodDate = React.useMemo(() => monthStringToDate(formPeriod), [formPeriod])

  const loadCategories = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.from("categorias").select("id,nombre,tipo")
      if (error) throw error
      setCategories((data ?? []) as CategoryRow[])
    } catch (catError) {
      console.error("Error al cargar categorías", catError)
    }
  }, [])

  const loadBudgets = React.useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) {
        return
      }

      setLoading(true)
      setError(null)
      try {
        const periodDateOnly = toDateOnly(selectedMonth)
        if (!periodDateOnly) {
          throw new Error("Periodo inválido")
        }

        const { data: budgetsData, error: budgetsError } = await supabase
          .from("presupuestos")
          .select("id,monto,periodo,categoria_id,categorias(id,nombre)")
          .eq("periodo", periodDateOnly)

        if (budgetsError) {
          throw budgetsError
        }

        const parsedBudgets = (budgetsData ?? []) as BudgetRow[]

        const categoryIds = parsedBudgets.map((item) => item.categoria_id).filter(Boolean)
        const spendMap = new Map<string, number>()

        if (categoryIds.length > 0) {
          const start = new Date(`${selectedMonth}-01T00:00:00.000Z`)
          const end = new Date(start)
          end.setMonth(end.getMonth() + 1)

          const { data: expensesData, error: expensesError } = await supabase
            .from("transacciones")
            .select("categoria_id,monto,tipo,fecha_transaccion")
            .in("categoria_id", categoryIds)
            .eq("tipo", "gasto")
            .gte("fecha_transaccion", start.toISOString())
            .lt("fecha_transaccion", end.toISOString())

          if (expensesError) {
            throw expensesError
          }

          (expensesData ?? []).forEach((row) => {
            const dataRow = row as TransactionRow
            if (!dataRow.categoria_id) return
            const amount = Number(dataRow.monto ?? 0)
            if (Number.isNaN(amount)) return
            spendMap.set(
              dataRow.categoria_id,
              (spendMap.get(dataRow.categoria_id) ?? 0) + amount
            )
          })
        }

        const enriched = parsedBudgets.map<BudgetWithStats>((budget) => {
          const categoryRecord = Array.isArray(budget.categorias)
            ? budget.categorias[0]
            : budget.categorias
          const spent = spendMap.get(budget.categoria_id) ?? 0
          const limit = Number(budget.monto ?? 0)
          const available = limit - spent
          const percentage = limit === 0 ? 0 : Math.min(100, (spent / limit) * 100)
          const exceeded = available < 0
          const nearLimit = !exceeded && percentage >= 90
          return {
            id: budget.id,
            categoriaId: budget.categoria_id,
            categoriaNombre: categoryRecord?.nombre?.trim() || "Sin categoría",
            limit,
            spent,
            available,
            percentage,
            exceeded,
            nearLimit,
            periodISO: budget.periodo,
          }
        })

        setBudgets(enriched)
      } catch (loadError) {
        console.error("Error al cargar presupuestos", loadError)
        setError("No pudimos cargar tus presupuestos. Intenta nuevamente.")
        setBudgets([])
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [selectedMonth]
  )

  React.useEffect(() => {
    loadCategories()
  }, [loadCategories])

  React.useEffect(() => {
    const controller = new AbortController()
    loadBudgets(controller.signal)
    return () => {
      controller.abort()
    }
  }, [loadBudgets])

  React.useEffect(() => {
    const handleTransactionsChange = () => {
      loadBudgets()
    }
    window.addEventListener("transactions:updated", handleTransactionsChange as EventListener)
    return () => {
      window.removeEventListener("transactions:updated", handleTransactionsChange as EventListener)
    }
  }, [loadBudgets])

  const gastoCategories = React.useMemo(
    () => categories.filter((cat) => cat.tipo === "gasto"),
    [categories]
  )

  const summary = React.useMemo(() => {
    const totalBudget = budgets.reduce((acc, budget) => acc + budget.limit, 0)
    const totalSpent = budgets.reduce((acc, budget) => acc + budget.spent, 0)
    const available = totalBudget - totalSpent
    const controlCount = budgets.filter((budget) => !budget.exceeded).length
    const exceededCount = budgets.length - controlCount
    return {
      totalBudget,
      totalSpent,
      available,
      controlCount,
      exceededCount,
    }
  }, [budgets])

  const resetForm = React.useCallback(() => {
    setEditingBudget(null)
    setFormCategoryId("")
    setFormAmount("")
    setFormPeriod(normalizeToCurrentOrFutureMonth(selectedMonth))
    setFormError(null)
  }, [selectedMonth])

  const handleOpenDialog = React.useCallback(() => {
    resetForm()
    setDialogOpen(true)
  }, [resetForm])

  const handleEditBudget = React.useCallback((budget: BudgetWithStats) => {
    setEditingBudget(budget)
    setFormCategoryId(budget.categoriaId)
    setFormAmount(String(budget.limit))
    setFormPeriod(extractMonthValue(budget.periodISO))
    setFormError(null)
    setDialogOpen(true)
  }, [])

  const handleSubmitBudget = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmedAmount = formAmount.trim()
      const amountValue = Number(trimmedAmount)
      const originalPeriod = editingBudget ? extractMonthValue(editingBudget.periodISO) : null

      if (!formCategoryId) {
        setFormError("Selecciona una categoría.")
        return
      }

      if (Number.isNaN(amountValue) || amountValue <= 0) {
        setFormError("Ingresa un monto válido mayor a 0.")
        return
      }

      if (!formPeriod) {
        setFormError("Selecciona un periodo válido.")
        return
      }

      if (isPastMonthValue(formPeriod) && (!editingBudget || formPeriod !== originalPeriod)) {
        setFormError(
          editingBudget
            ? "Solo puedes mover el presupuesto a meses actuales o futuros."
            : "Solo puedes crear presupuestos desde el mes actual en adelante."
        )
        return
      }

      const normalizedPeriod = toDateOnly(formPeriod)
      if (!normalizedPeriod) {
        setFormError("Periodo inválido.")
        return
      }

      const duplicateQuery = supabase
        .from("presupuestos")
        .select("id")
        .eq("categoria_id", formCategoryId)
        .eq("periodo", normalizedPeriod)
        .limit(1)

      const { data: duplicateRows, error: duplicateError } = await (editingBudget
        ? duplicateQuery.neq("id", editingBudget.id)
        : duplicateQuery)

      if (duplicateError) {
        throw duplicateError
      }

      if (duplicateRows && duplicateRows.length > 0) {
        setFormError("Ya tienes un presupuesto para esa categoría en el periodo seleccionado.")
        return
      }

      const existingBudget = budgets.find(
        (budget) =>
          budget.categoriaId === formCategoryId &&
          extractMonthValue(budget.periodISO) === formPeriod &&
          budget.id !== editingBudget?.id
      )

      if (existingBudget) {
        setFormError("Ya tienes un presupuesto para esa categoría en el periodo seleccionado.")
        return
      }

      setSaving(true)
      setFormError(null)

      try {
        const payload = {
          categoria_id: formCategoryId,
          monto: amountValue,
          periodo: normalizedPeriod,
        }

        if (editingBudget) {
          const { error: updateError } = await supabase
            .from("presupuestos")
            .update(payload)
            .eq("id", editingBudget.id)
          if (updateError) throw updateError
        } else {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser()
          if (userError) throw userError
          if (!user) {
            setFormError("Debes iniciar sesión nuevamente.")
            return
          }
          const { error: insertError } = await supabase
            .from("presupuestos")
            .insert({ ...payload, usuario_id: user.id })
          if (insertError) throw insertError
        }

        setDialogOpen(false)
        resetForm()
        await loadBudgets()
      } catch (saveError) {
        console.error("Error al guardar presupuesto", saveError)
        setFormError("No pudimos guardar el presupuesto. Intenta nuevamente.")
      } finally {
        setSaving(false)
      }
    },
    [budgets, editingBudget, formAmount, formCategoryId, formPeriod, loadBudgets, resetForm]
  )

  const handleDeleteBudget = React.useCallback(
    async (budgetId: string) => {
      const confirmed = window.confirm("¿Eliminar este presupuesto? Esta acción no se puede deshacer.")
      if (!confirmed) {
        return
      }

      setDeletingId(budgetId)
      try {
        const { error: deleteError } = await supabase.from("presupuestos").delete().eq("id", budgetId)
        if (deleteError) throw deleteError
        await loadBudgets()
      } catch (deleteError) {
        console.error("Error al eliminar presupuesto", deleteError)
        setError("No pudimos eliminar el presupuesto. Intenta nuevamente.")
      } finally {
        setDeletingId(null)
      }
    },
    [loadBudgets]
  )

  const summaryCards = [
    {
      title: "Presupuesto Total",
      value: currencyFormatter.format(summary.totalBudget),
      icon: PiggyBank,
      accent:
        "from-blue-100/80 to-white text-blue-700 border-blue-200 dark:from-blue-500/10 dark:to-slate-950 dark:text-blue-200 dark:border-blue-500/40",
      iconStyles: "bg-blue-500 text-white dark:bg-blue-500/60",
    },
    {
      title: "Gastado",
      value: currencyFormatter.format(summary.totalSpent),
      icon: TrendingDown,
      accent:
        "from-red-100/80 to-white text-red-600 border-red-200 dark:from-red-500/10 dark:to-slate-950 dark:text-red-200 dark:border-red-500/40",
      iconStyles: "bg-red-500 text-white dark:bg-red-500/60",
    },
    {
      title: "Disponible",
      value: currencyFormatter.format(summary.available),
      icon: CircleDollarSign,
      accent: summary.available >= 0
        ? "from-emerald-100/80 to-white text-emerald-600 border-emerald-200 dark:from-emerald-500/10 dark:to-slate-950 dark:text-emerald-200 dark:border-emerald-500/40"
        : "from-red-100/80 to-white text-red-600 border-red-200 dark:from-red-500/10 dark:to-slate-950 dark:text-red-200 dark:border-red-500/40",
      iconStyles: summary.available >= 0
        ? "bg-emerald-500 text-white dark:bg-emerald-500/60"
        : "bg-red-500 text-white dark:bg-red-500/60",
    },
    {
      title: "Estado",
      value: `${summary.controlCount} en control · ${summary.exceededCount} excedidos`,
      icon: summary.exceededCount > 0 ? AlertTriangle : CheckCircle2,
      accent: summary.exceededCount > 0
        ? "from-purple-100/80 to-white text-purple-600 border-purple-200 dark:from-purple-500/10 dark:to-slate-950 dark:text-purple-200 dark:border-purple-500/40"
        : "from-emerald-100/80 to-white text-emerald-600 border-emerald-200 dark:from-emerald-500/10 dark:to-slate-950 dark:text-emerald-200 dark:border-emerald-500/40",
      iconStyles: summary.exceededCount > 0
        ? "bg-purple-500 text-white dark:bg-purple-500/60"
        : "bg-emerald-500 text-white dark:bg-emerald-500/60",
      valueClassName: "text-xl",
    },
  ]

  const periodLabel = parsePeriodLabel(`${selectedMonth}-01`)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">
            Administra tus límites de gasto mensuales por categoría. Periodo seleccionado: {periodLabel}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-col">
            <Label htmlFor="period-filter" className="text-xs uppercase tracking-wide text-muted-foreground">
              Periodo
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="period-filter"
                  variant="outline"
                  className="mt-1 h-11 justify-start gap-2 bg-background text-left font-normal"
                >
                  <CalendarIcon className="size-4" />
                  <span>
                    {selectedMonthDate
                      ? parsePeriodLabel(selectedMonthDate.toISOString())
                      : "Selecciona un periodo"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <MonthYearPicker
                  selected={selectedMonthDate}
                  onSelect={(date) => setSelectedMonth(format(date, "yyyy-MM"))}
                  fromYear={2018}
                  toYear={2035}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button type="button" onClick={handleOpenDialog} className="h-11 gap-2 mt-4.5">
            <Plus className="size-4" />
            Nuevo Presupuesto
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <Card
              key={card.title}
              className={cn(
                "h-35.5 border bg-linear-to-br shadow-sm transition-shadow hover:shadow-md",
                card.accent
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <span className={cn("flex size-12 items-center justify-center rounded-full", card.iconStyles)}>
                  <Icon className="size-5" />
                </span>
              </CardHeader>
              <CardContent>
                <p className={cn("font-semibold tracking-tight", card.valueClassName ?? "text-3xl")}>{card.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Mis Presupuestos</h2>
            <p className="text-sm text-muted-foreground">
              Administra tus límites de gasto por categoría.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed">
            <TrendingUp className="size-5 animate-pulse text-muted-foreground" />
          </div>
        ) : budgets.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No tienes presupuestos registrados para este periodo. Crea uno nuevo para comenzar.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {budgets.map((budget) => {
              const statusLabel = budget.exceeded
                ? "Excedido"
                : budget.nearLimit
                ? "90% del límite"
                : "Disponible"
              const statusColor = budget.exceeded
                ? "bg-red-100 text-red-700"
                : budget.nearLimit
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
              return (
                <Card
                  key={budget.id}
                  className={cn(
                    "border-2",
                    budget.exceeded
                      ? "border-red-200"
                      : budget.nearLimit
                      ? "border-amber-200"
                      : "border-emerald-200"
                  )}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                        <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-base font-bold text-foreground">
                          {budget.categoriaNombre.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <p>{budget.categoriaNombre}</p>
                          <p className="text-xs text-muted-foreground">Periodo: mensual</p>
                        </div>
                      </CardTitle>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusColor)}>
                      {statusLabel}
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm">
                        <p className="text-muted-foreground">
                          {currencyFormatter.format(budget.spent)} gastado
                        </p>
                        <p className="font-semibold">
                          de {currencyFormatter.format(budget.limit)}
                        </p>
                      </div>
                      <div className="mt-2 h-3 rounded-full bg-muted/60">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            budget.exceeded
                              ? "bg-red-500"
                              : budget.nearLimit
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(100, budget.percentage)}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border px-4 py-3">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        {budget.exceeded ? "Excedido" : "Disponible"}
                      </p>
                      <p
                        className={cn(
                          "text-xl font-semibold",
                          budget.exceeded ? "text-red-600" : "text-emerald-600"
                        )}
                      >
                        {currencyFormatter.format(Math.abs(budget.available))}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleEditBudget(budget)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDeleteBudget(budget.id)}
                        disabled={deletingId === budget.id}
                      >
                        {deletingId === budget.id ? "Eliminando..." : "Eliminar"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBudget ? "Editar presupuesto" : "Nuevo presupuesto"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmitBudget}>
            <div className="space-y-2">
              <Label htmlFor="category-select">Categoría</Label>
              <Select
                value={formCategoryId || undefined}
                onValueChange={setFormCategoryId}
                disabled={gastoCategories.length === 0 || saving}
              >
                <SelectTrigger id="category-select" className="w-full">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {gastoCategories.length === 0 ? (
                    <SelectItem value="placeholder" disabled>
                      No tienes categorías de gasto disponibles.
                    </SelectItem>
                  ) : (
                    gastoCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.nombre || "Sin categoría"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-amount">Monto límite</Label>
              <Input
                id="budget-amount"
                type="number"
                min="0"
                step="0.01"
                value={formAmount}
                onChange={(event) => setFormAmount(event.target.value)}
                disabled={saving}
                placeholder="500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-period">Periodo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="budget-period"
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-start gap-2 bg-background text-left font-normal"
                    disabled={saving}
                  >
                    <CalendarIcon className="size-4" />
                    <span>
                      {formPeriodDate
                        ? parsePeriodLabel(formPeriodDate.toISOString())
                        : "Selecciona un periodo"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <MonthYearPicker
                    selected={formPeriodDate}
                    onSelect={(date) => setFormPeriod(format(date, "yyyy-MM"))}
                    fromYear={2018}
                    toYear={2035}
                    minMonth={minSelectableMonth}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : editingBudget ? "Guardar cambios" : "Crear presupuesto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
