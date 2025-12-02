"use client"

import * as React from "react"
import {
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { formatCurrency, useBcvRate } from "@/lib/currency"

type CategorySection = "gasto" | "ingreso"

type TransactionRow = {
  monto: number | string | null
  tipo: CategorySection | null
  categorias:
    | {
        id: string
        nombre: string | null
        tipo: CategorySection | null
      }
    | Array<{
        id: string
        nombre: string | null
        tipo: CategorySection | null
      }>
    | null
}

type CategoryRow = {
  id: string
  nombre: string | null
  tipo: CategorySection | null
}

type CategoryStat = {
  id: string
  name: string
  expenseTotal: number
  expenseCount: number
  incomeTotal: number
  incomeCount: number
  lastKnownType: CategorySection | null
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

type TotalsState = {
  expenses: number
  income: number
  categories: number
}

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "USD",
})

const NAME_MAX_LENGTH = 13

const categoryCardStyles: Record<CategorySection, { card: string; value: string; badge: string; bar: string }> = {
  gasto: {
    card: "from-red-100/80 to-white text-red-700 border-red-200 dark:from-red-500/10 dark:to-slate-950 dark:text-red-200 dark:border-red-500/40",
    value: "text-red-700 dark:text-red-200",
    badge: "bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-200",
    bar: "bg-red-500 dark:bg-red-400",
  },
  ingreso: {
    card: "from-emerald-100/80 to-white text-emerald-700 border-emerald-200 dark:from-emerald-500/10 dark:to-slate-950 dark:text-emerald-200 dark:border-emerald-500/40",
    value: "text-emerald-700 dark:text-emerald-200",
    badge: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
    bar: "bg-emerald-500 dark:bg-emerald-400",
  },
}

export default function CategoriasPage() {
  const [totals, setTotals] = React.useState<TotalsState>({ expenses: 0, income: 0, categories: 0 })
  const [categoryGroups, setCategoryGroups] = React.useState<CategoryGroups>({ gastos: [], ingresos: [] })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [categoryName, setCategoryName] = React.useState("")
  const [categoryType, setCategoryType] = React.useState<CategorySection>("gasto")
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [categoriesList, setCategoriesList] = React.useState<CategoryRow[]>([])
  const [optionsOpenId, setOptionsOpenId] = React.useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null)
  const [actionPendingId, setActionPendingId] = React.useState<string | null>(null)
  const { rate: bcvRate, loading: bcvLoading, error: bcvError } = useBcvRate()
  const formatBcvAmount = React.useCallback(
    (usdAmount: number) => {
      if (!bcvRate || usdAmount === 0) {
        return null
      }
      return formatCurrency(usdAmount * bcvRate, "VES")
    },
    [bcvRate]
  )
  const broadcastCategoriesUpdated = React.useCallback(() => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("categories:updated"))
  }, [])

  const loadData = React.useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) {
        return
      }

      setLoading(true)
      setError(null)
      try {
        const [transactionsResult, categoriesResult] = await Promise.all([
          supabase.from("transacciones").select("monto,tipo,categorias(id,nombre,tipo)"),
          supabase.from("categorias").select("id,nombre,tipo"),
        ])

        if (signal?.aborted) {
          return
        }

        const missingTypeMessage =
          'La tabla "categorias" debe tener la columna "tipo" con valores "gasto" o "ingreso".'

        if (transactionsResult.error) {
          if (transactionsResult.error.message?.toLowerCase().includes("tipo")) {
            setError(missingTypeMessage)
            setCategoryGroups({ gastos: [], ingresos: [] })
            setTotals({ expenses: 0, income: 0, categories: 0 })
            setCategoriesList([])
            return
          }
          throw transactionsResult.error
        }

        if (categoriesResult.error) {
          if (categoriesResult.error.message?.toLowerCase().includes("tipo")) {
            setError(missingTypeMessage)
            setCategoryGroups({ gastos: [], ingresos: [] })
            setTotals({ expenses: 0, income: 0, categories: 0 })
            setCategoriesList([])
            return
          }
          throw categoriesResult.error
        }

        const transactions = (transactionsResult.data ?? []) as TransactionRow[]
        const categories = (categoriesResult.data ?? []) as CategoryRow[]
        setCategoriesList(categories)

        let expensesTotal = 0
        let incomeTotal = 0
        const stats = new Map<string, CategoryStat>()

        const registerStat = (id: string, name: string) => {
          let stat = stats.get(id)
          if (!stat) {
            stat = {
              id,
              name,
              expenseTotal: 0,
              expenseCount: 0,
              incomeTotal: 0,
              incomeCount: 0,
              lastKnownType: null,
            }
            stats.set(id, stat)
          }
          return stat
        }

        transactions.forEach((tx) => {
          if (signal?.aborted) {
            return
          }

          if (!tx.tipo) {
            return
          }

          const numericAmount = Number(tx.monto ?? 0)
          if (Number.isNaN(numericAmount)) {
            return
          }

          if (tx.tipo === "gasto") {
            expensesTotal += numericAmount
          } else if (tx.tipo === "ingreso") {
            incomeTotal += numericAmount
          }

          const categoryRecord = Array.isArray(tx.categorias) ? tx.categorias[0] : tx.categorias
          const categoryId = categoryRecord?.id ?? `sin-${tx.tipo}`
          const categoryName = categoryRecord?.nombre?.trim() || "Sin categoría"
          const stat = registerStat(categoryId, categoryName)

          if (tx.tipo === "gasto") {
            stat.expenseTotal += numericAmount
            stat.expenseCount += 1
          } else {
            stat.incomeTotal += numericAmount
            stat.incomeCount += 1
          }

          if (categoryRecord?.tipo) {
            stat.lastKnownType = categoryRecord.tipo
          } else if (!stat.lastKnownType) {
            stat.lastKnownType = tx.tipo
          }
        })

        const gastoArray: CategoryAggregate[] = []
        const ingresoArray: CategoryAggregate[] = []
        const totalCategories = new Set<string>()

        const pushEntry = (
          section: CategorySection,
          id: string,
          name: string,
          stat: CategoryStat | undefined
        ) => {
          const total = section === "gasto" ? stat?.expenseTotal ?? 0 : stat?.incomeTotal ?? 0
          const count = section === "gasto" ? stat?.expenseCount ?? 0 : stat?.incomeCount ?? 0
          const base = section === "gasto" ? expensesTotal : incomeTotal
          const percentage = base === 0 ? 0 : (total / base) * 100

          const entry: CategoryAggregate = {
            id,
            name,
            total,
            count,
            percentage,
          }

          if (section === "gasto") {
            gastoArray.push(entry)
          } else {
            ingresoArray.push(entry)
          }
        }

        categories.forEach((category) => {
          if (signal?.aborted) {
            return
          }

          const stat = stats.get(category.id)
          const name = category.nombre?.trim() || "Sin categoría"
          totalCategories.add(category.id)

          let resolvedType: CategorySection = "gasto"
          if (category.tipo === "ingreso") {
            resolvedType = "ingreso"
          } else if (category.tipo === "gasto") {
            resolvedType = "gasto"
          } else if (stat?.lastKnownType) {
            resolvedType = stat.lastKnownType
          } else if (stat && stat.incomeTotal > stat.expenseTotal) {
            resolvedType = "ingreso"
          }

          pushEntry(resolvedType, category.id, name, stat)
          if (stat) {
            stats.delete(category.id)
          }
        })

        stats.forEach((stat) => {
          if (signal?.aborted) {
            return
          }

          totalCategories.add(stat.id)
          const resolvedType: CategorySection = stat.incomeTotal > stat.expenseTotal ? "ingreso" : "gasto"
          pushEntry(resolvedType, stat.id, stat.name, stat)
        })

        gastoArray.sort((a, b) => b.total - a.total)
        ingresoArray.sort((a, b) => b.total - a.total)

        setTotals({
          expenses: expensesTotal,
          income: incomeTotal,
          categories: totalCategories.size,
        })

        setCategoryGroups({ gastos: gastoArray, ingresos: ingresoArray })
      } catch (fetchError) {
        if (signal?.aborted) {
          return
        }
        console.error("Error al cargar datos de categorías", fetchError)
        setError("No pudimos cargar la información. Intenta nuevamente.")
        setCategoryGroups({ gastos: [], ingresos: [] })
        setTotals({ expenses: 0, income: 0, categories: 0 })
        setCategoriesList([])
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    []
  )

  React.useEffect(() => {
    const controller = new AbortController()

    loadData(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadData])

  const resetFormState = React.useCallback(() => {
    setCategoryName("")
    setCategoryType("gasto")
    setFormError(null)
    setEditingCategoryId(null)
  }, [])

  const handleDialogChange = React.useCallback(
    (open: boolean) => {
      setDialogOpen(open)
      if (!open) {
        resetFormState()
      }
    },
    [resetFormState]
  )

  React.useEffect(() => {
    if (!optionsOpenId) {
      return
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest("[data-category-options]")) {
        setOptionsOpenId(null)
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
    }
  }, [optionsOpenId])

  const handleSubmitCategory = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmed = categoryName.trim()
      if (!trimmed) {
        setFormError("El nombre es obligatorio.")
        return
      }
      if (trimmed.length > NAME_MAX_LENGTH) {
        setFormError(`El nombre no puede tener más de ${NAME_MAX_LENGTH} caracteres.`)
        return
      }

      setSaving(true)
      setFormError(null)
      try {
        if (editingCategoryId) {
          const { error: updateError } = await supabase
            .from("categorias")
            .update({ nombre: trimmed, tipo: categoryType })
            .eq("id", editingCategoryId)
          if (updateError) {
            throw updateError
          }
        } else {
          const { error: insertError } = await supabase.from("categorias").insert({
            nombre: trimmed,
            tipo: categoryType,
          })
          if (insertError) {
            throw insertError
          }
        }

        resetFormState()
        setDialogOpen(false)
        setOptionsOpenId(null)
        await loadData()
        broadcastCategoriesUpdated()
      } catch (submitError) {
        console.error(
          editingCategoryId ? "Error al actualizar categoría" : "Error al crear categoría",
          submitError
        )
        setFormError(
          editingCategoryId
            ? "No pudimos actualizar la categoría. Intenta nuevamente."
            : "No pudimos crear la categoría. Intenta nuevamente."
        )
      } finally {
        setSaving(false)
      }
    },
    [broadcastCategoriesUpdated, categoryName, categoryType, editingCategoryId, loadData, resetFormState]
  )

  const handleOpenEdit = React.useCallback(
    (categoryId: string, fallbackName: string, fallbackType: CategorySection) => {
      const record = categoriesList.find((item) => item.id === categoryId)
      const resolvedName = record?.nombre?.trim() ?? fallbackName.trim()
      const resolvedType: CategorySection =
        record?.tipo === "ingreso"
          ? "ingreso"
          : record?.tipo === "gasto"
          ? "gasto"
          : fallbackType

      setCategoryName(resolvedName)
      setCategoryType(resolvedType)
      setEditingCategoryId(categoryId)
      setFormError(null)
      setDialogOpen(true)
      setOptionsOpenId(null)
    },
    [categoriesList]
  )

  const handleDeleteCategory = React.useCallback(
    async (categoryId: string, displayName: string) => {
      const confirmed = window.confirm(
        `¿Eliminar la categoría "${displayName}"? Esta acción no se puede deshacer.`
      )
      if (!confirmed) {
        return
      }

      setActionPendingId(categoryId)
      try {
        const { count: linkedTransactions, error: linkError } = await supabase
          .from("transacciones")
          .select("id", { count: "exact", head: true })
          .eq("categoria_id", categoryId)
        if (linkError) {
          throw linkError
        }

        if ((linkedTransactions ?? 0) > 0) {
          setError("Primero elimina o reasigna las transacciones asociadas a esta categoría.")
          return
        }

        const { error: deleteError } = await supabase
          .from("categorias")
          .delete()
          .eq("id", categoryId)
        if (deleteError) {
          throw deleteError
        }

        setOptionsOpenId(null)
        if (dialogOpen && editingCategoryId === categoryId) {
          setDialogOpen(false)
          resetFormState()
        }

        await loadData()
        broadcastCategoriesUpdated()
      } catch (deleteError) {
        console.error("Error al eliminar categoría", deleteError)
        setError("No pudimos eliminar la categoría. Intenta nuevamente.")
      } finally {
        setActionPendingId(null)
      }
    },
    [broadcastCategoriesUpdated, dialogOpen, editingCategoryId, loadData, resetFormState]
  )

  const categoryIdSet = React.useMemo(() => new Set(categoriesList.map((item) => item.id)), [
    categoriesList,
  ])
  const isEditing = Boolean(editingCategoryId)

  const summaryCards = React.useMemo(
    () => [
      {
        title: "Total Gastos",
        value: currencyFormatter.format(totals.expenses),
        bcvValue: formatBcvAmount(totals.expenses),
        icon: ArrowDownCircle,
        accent:
          "from-red-100/80 to-white text-red-700 border-red-200 dark:from-red-500/10 dark:to-slate-950 dark:text-red-200 dark:border-red-500/40",
        iconStyles: "bg-red-500 text-white dark:bg-red-500/60",
      },
      {
        title: "Total Ingresos",
        value: currencyFormatter.format(totals.income),
        bcvValue: formatBcvAmount(totals.income),
        icon: ArrowUpCircle,
        accent:
          "from-emerald-100/80 to-white text-emerald-700 border-emerald-200 dark:from-emerald-500/10 dark:to-slate-950 dark:text-emerald-200 dark:border-emerald-500/40",
        iconStyles: "bg-emerald-500 text-white dark:bg-emerald-500/60",
      },
      {
        title: "Categorías Activas",
        value: totals.categories.toString(),
        icon: BarChart3,
        accent:
          "from-blue-100/80 to-white text-blue-700 border-blue-200 dark:from-blue-500/10 dark:to-slate-950 dark:text-blue-200 dark:border-blue-500/40",
        iconStyles: "bg-blue-500 text-white dark:bg-blue-500/60",
      },
    ],
    [totals, formatBcvAmount]
  )

  const sections: Array<{
    title: string
    description: string
    data: CategoryAggregate[]
    type: CategorySection
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
          <p className="text-xs text-muted-foreground mt-1">
            {bcvLoading
              ? "Cargando tasa BCV..."
              : bcvRate
              ? `1 US$ = ${formatCurrency(bcvRate, "VES")} (BCV)`
              : "La tasa BCV no está disponible en este momento."}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              className="w-full gap-2 md:w-auto"
              size="lg"
              onClick={resetFormState}
              disabled={saving}
            >
              <Plus className="size-4" />
              Nueva Categoría
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Actualiza el nombre o el tipo de la categoría seleccionada."
                  : "Define un nombre y el tipo para organizar tus transacciones."}
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmitCategory}>
              <div className="space-y-2">
                <Label htmlFor="category-name">Nombre</Label>
                <Input
                  id="category-name"
                  placeholder="Ej. Servicios"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  disabled={saving}
                  autoFocus
                  required
                  maxLength={NAME_MAX_LENGTH}
                />
                <p className="text-xs text-muted-foreground">Máximo {NAME_MAX_LENGTH} caracteres.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-type">Tipo</Label>
                <select
                  id="category-type"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={categoryType}
                  onChange={(event) => setCategoryType(event.target.value as CategorySection)}
                  disabled={saving}
                >
                  <option value="gasto">Gasto</option>
                  <option value="ingreso">Ingreso</option>
                </select>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <DialogFooter className="sm:justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="ghost" disabled={saving}>
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {isEditing ? "Guardar cambios" : "Crear categoría"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {bcvError && !bcvLoading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50">
          {bcvError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map(({ title, value, bcvValue, icon: Icon, accent, iconStyles }) => (
          <Card key={title} className={cn("border bg-linear-to-br shadow-sm", accent)}>
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
                <>
                  <p className="text-3xl font-semibold tracking-tight">{value}</p>
                  {bcvValue && (
                    <p className="text-xs text-muted-foreground">≈ {bcvValue} BCV</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {sections.map(({ title, description, data, type }) => {
        const styles = categoryCardStyles[type]
        return (
          <section key={title} className="space-y-4">
            <div>
              <h2 className={cn("text-xl font-semibold", type === "gasto" ? "text-red-600" : "text-emerald-600")}>
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
                  const percentageLabel = `${category.percentage.toFixed(1)}%`
                  const transactionLabel = `${category.count} ${category.count === 1 ? "transacción" : "transacciones"}`
                  const displayName = category.name || "Sin categoría"
                  const canManageCategory =
                    categoryIdSet.has(category.id) && !category.id.startsWith("sin-")
                  const isOptionOpen = optionsOpenId === category.id
                  const isDeleting = actionPendingId === category.id
                  const categoryBcv = formatBcvAmount(category.total)

                  return (
                    <Card
                      key={`${type}-${category.id}`}
                      className={cn(
                        "border bg-linear-to-br shadow-sm transition-shadow hover:shadow-md",
                        styles.card
                      )}
                    >
                      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                        <div className="space-y-1">
                          <CardTitle
                            className={cn("text-lg font-semibold text-slate-900", "dark:text-slate-100")}
                          >
                            {displayName}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">{transactionLabel}</p>
                        </div>
                        {canManageCategory && (
                          <div className="relative" data-category-options>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                              aria-haspopup="menu"
                              aria-expanded={isOptionOpen}
                              aria-label={`Opciones para ${displayName}`}
                              onClick={() =>
                                setOptionsOpenId((current) =>
                                  current === category.id ? null : category.id
                                )
                              }
                              disabled={isDeleting}
                            >
                              {isDeleting ? (
                                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                              ) : (
                                <MoreVertical className="size-4" />
                              )}
                              <span className="sr-only">Abrir opciones</span>
                            </Button>
                            {isOptionOpen && (
                              <div
                                className="absolute right-0 top-9 z-10 w-44 rounded-md border bg-popover p-1 text-sm shadow-md"
                                role="menu"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(category.id, displayName, type)}
                                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  role="menuitem"
                                >
                                  <Pencil className="size-4" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(category.id, displayName)}
                                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-50"
                                  role="menuitem"
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-4" />
                                  )}
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className={cn("text-3xl font-semibold tracking-tight", styles.value)}>
                            {currencyFormatter.format(category.total)}
                          </p>
                          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", styles.badge)}>
                            {percentageLabel}
                          </span>
                        </div>
                        {categoryBcv && (
                          <p className="text-xs text-muted-foreground">≈ {categoryBcv} BCV</p>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Del total de {type === "gasto" ? "gastos" : "ingresos"}
                        </div>
                        <div className="h-2 rounded-full bg-muted/70">
                          <div
                            className={cn("h-full rounded-full", styles.bar)}
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
        )
      })}
    </div>
  )
}
