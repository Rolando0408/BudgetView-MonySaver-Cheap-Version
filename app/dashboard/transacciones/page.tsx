"use client"

import * as React from "react"
import {
  Loader2,
  Plus,
  Calendar as CalendarIcon,
  ArrowUpCircle,
  ArrowDownCircle,
  History,
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type TransactionType = "gasto" | "ingreso"

type Category = {
  id: string
  nombre: string | null
  tipo: TransactionType | null
}

type Transaction = {
  id: string
  monto: number
  tipo: TransactionType
  descripcion: string | null
  fecha_transaccion: string
  categoria_id: string | null
  categorias?: Category | null
}

type PeriodFilter = "7days" | "thisMonth" | "lastMonth" | "custom"

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "USD",
})

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

export default function TransaccionesPage() {
  const [transactions, setTransactions] = React.useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = React.useState<Transaction[]>([])
  const [categories, setCategories] = React.useState<Category[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [periodFilter, setPeriodFilter] = React.useState<PeriodFilter>("thisMonth")
  const [billeteraId, setBilleteraId] = React.useState<string | null>(null)
  
  // Custom date range state
  const [customStartDate, setCustomStartDate] = React.useState<Date | undefined>(undefined)
  const [customEndDate, setCustomEndDate] = React.useState<Date | undefined>(undefined)

  // Form state
  const [formMonto, setFormMonto] = React.useState("")
  const [formTipo, setFormTipo] = React.useState<TransactionType>("gasto")
  const [formCategoriaId, setFormCategoriaId] = React.useState("")

  // Load user's first wallet
  React.useEffect(() => {
    let active = true

    const loadWallet = async () => {
      try {
        const { data, error } = await supabase
          .from("billeteras")
          .select("id")
          .order("nombre", { ascending: true })
          .limit(1)
          .single()

        if (!active) return
        if (error) throw error
        if (data) {
          setBilleteraId(data.id)
        }
      } catch (err) {
        if (!active) return
        console.error("Error al cargar billetera", err)
      }
    }

    loadWallet()

    return () => {
      active = false
    }
  }, [])

  const loadData = React.useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return

    setLoading(true)
    setError(null)
    try {
      const [transactionsResult, categoriesResult] = await Promise.all([
        supabase
          .from("transacciones")
          .select("id, monto, tipo, descripcion, fecha_transaccion, categoria_id, categorias(id, nombre, tipo)")
          .order("fecha_transaccion", { ascending: false }),
        supabase.from("categorias").select("id, nombre, tipo"),
      ])

      if (signal?.aborted) return

      if (transactionsResult.error) throw transactionsResult.error
      if (categoriesResult.error) throw categoriesResult.error

      // Transform the data to match our Transaction type
      const transformedTransactions = (transactionsResult.data ?? []).map((tx: any) => ({
        ...tx,
        categorias: Array.isArray(tx.categorias) ? tx.categorias[0] : tx.categorias,
      })) as Transaction[]

      setTransactions(transformedTransactions)
      setCategories((categoriesResult.data ?? []) as Category[])
    } catch (fetchError) {
      if (signal?.aborted) return
      console.error("Error al cargar datos de transacciones", fetchError)
      setError("No pudimos cargar la información. Intenta nuevamente.")
      setTransactions([])
      setCategories([])
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    loadData(controller.signal)
    return () => {
      controller.abort()
    }
  }, [loadData])

  // Filter transactions by period
  React.useEffect(() => {
    const now = new Date()
    let filtered = [...transactions]

    switch (periodFilter) {
      case "7days": {
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(now.getDate() - 7)
        filtered = transactions.filter((t) => new Date(t.fecha_transaccion) >= sevenDaysAgo)
        break
      }
      case "thisMonth": {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        filtered = transactions.filter((t) => new Date(t.fecha_transaccion) >= startOfMonth)
        break
      }
      case "lastMonth": {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        filtered = transactions.filter((t) => {
          const date = new Date(t.fecha_transaccion)
          return date >= startOfLastMonth && date <= endOfLastMonth
        })
        break
      }
      case "custom": {
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate)
          start.setHours(0, 0, 0, 0)
          const end = new Date(customEndDate)
          end.setHours(23, 59, 59, 999)
          
          filtered = transactions.filter((t) => {
            const date = new Date(t.fecha_transaccion)
            return date >= start && date <= end
          })
        } else if (customStartDate) {
          const start = new Date(customStartDate)
          start.setHours(0, 0, 0, 0)
          filtered = transactions.filter((t) => new Date(t.fecha_transaccion) >= start)
        } else if (customEndDate) {
          const end = new Date(customEndDate)
          end.setHours(23, 59, 59, 999)
          filtered = transactions.filter((t) => new Date(t.fecha_transaccion) <= end)
        }
        break
      }
    }

    setFilteredTransactions(filtered)
  }, [transactions, periodFilter, customStartDate, customEndDate])

  const resetFormState = React.useCallback(() => {
    setFormMonto("")
    setFormTipo("gasto")
    setFormCategoriaId("")
    setFormError(null)
  }, [])

  const handleSubmitTransaction = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const monto = parseFloat(formMonto)
      if (isNaN(monto) || monto <= 0) {
        setFormError("El monto debe ser un número mayor a 0.")
        return
      }

      if (!formCategoriaId) {
        setFormError("Debes seleccionar una categoría.")
        return
      }

      if (!billeteraId) {
        setFormError("No tienes una billetera configurada. Crea una billetera primero.")
        return
      }

      setSaving(true)
      setFormError(null)
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setFormError("Debes iniciar sesión para crear transacciones.")
          return
        }

        const transactionData = {
          monto,
          tipo: formTipo,
          descripcion: null,
          categoria_id: formCategoriaId,
          usuario_id: user.id,
          billetera_id: billeteraId,
          fecha_transaccion: new Date().toISOString(),
        }

        const { error: insertError } = await supabase.from("transacciones").insert(transactionData)
        if (insertError) throw insertError

        resetFormState()
        await loadData()
      } catch (submitError) {
        console.error("Error al crear transacción", submitError)
        setFormError("No pudimos crear la transacción. Intenta nuevamente.")
      } finally {
        setSaving(false)
      }
    },
    [formMonto, formTipo, formCategoriaId, billeteraId, loadData, resetFormState]
  )

  // Filter categories by type
  const filteredCategories = React.useMemo(() => {
    return categories.filter((cat) => cat.tipo === formTipo)
  }, [categories, formTipo])

  const periodButtons: Array<{ label: string; value: PeriodFilter }> = [
    { label: "Últimos 7 Días", value: "7days" },
    { label: "Este Mes", value: "thisMonth" },
    { label: "Mes Pasado", value: "lastMonth" },
    { label: "Personalizado", value: "custom" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold mb-1">Transacciones</h1>
        <p className="text-muted-foreground text-sm">
          Registra y administra tus ingresos y gastos.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Period Filter */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="size-4" />
            <span className="font-medium">Periodo:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {periodButtons.map((btn) => (
              <Button
                key={btn.value}
                type="button"
                variant={periodFilter === btn.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodFilter(btn.value)}
                className={cn(
                  periodFilter === btn.value &&
                    "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
                )}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {periodFilter === "custom" && (
          <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Start Date Picker */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold whitespace-nowrap">
                    Fecha inicio:
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[240px] justify-start text-left font-normal bg-background",
                          !customStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? (
                          format(customStartDate, "PPP", { locale: es })
                        ) : (
                          <span>Seleccionar fecha</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date Picker */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold whitespace-nowrap">
                    Fecha fin:
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[240px] justify-start text-left font-normal bg-background",
                          !customEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? (
                          format(customEndDate, "PPP", { locale: es })
                        ) : (
                          <span>Seleccionar fecha</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Clear Button */}
                {(customStartDate || customEndDate) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomStartDate(undefined)
                      setCustomEndDate(undefined)
                    }}
                    className="ml-auto"
                  >
                    Limpiar fechas
                  </Button>
                )}
              </div>

              {/* Date Range Summary */}
              {customStartDate && customEndDate && (
                <p className="text-xs text-muted-foreground mt-3">
                  Mostrando transacciones desde el{" "}
                  <span className="font-semibold text-foreground">
                    {format(customStartDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </span>{" "}
                  hasta el{" "}
                  <span className="font-semibold text-foreground">
                    {format(customEndDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-5" />
              Registro de Transacciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmitTransaction}>
              {/* Tipo */}
              <div className="space-y-2">
                <Label htmlFor="transaction-tipo" className="text-base font-semibold">
                  Tipo
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={formTipo === "gasto" ? "default" : "outline"}
                    className={cn(
                      "h-12 text-base font-semibold",
                      formTipo === "gasto" &&
                        "bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700"
                    )}
                    onClick={() => {
                      setFormTipo("gasto")
                      setFormCategoriaId("")
                    }}
                    disabled={saving}
                  >
                    Gasto
                  </Button>
                  <Button
                    type="button"
                    variant={formTipo === "ingreso" ? "default" : "outline"}
                    className={cn(
                      "h-12 text-base font-medium",
                      formTipo === "ingreso" && "bg-background text-foreground hover:bg-accent"
                    )}
                    onClick={() => {
                      setFormTipo("ingreso")
                      setFormCategoriaId("")
                    }}
                    disabled={saving}
                  >
                    Ingreso
                  </Button>
                </div>
              </div>

              {/* Monto */}
              <div className="space-y-2">
                <Label htmlFor="transaction-monto" className="text-base font-semibold">
                  Monto
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="transaction-monto"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formMonto}
                    onChange={(event) => setFormMonto(event.target.value)}
                    disabled={saving}
                    required
                    className="pl-7 h-12 text-base bg-muted/50"
                  />
                </div>
              </div>

              {/* Categoría */}
              <div className="space-y-2">
                <Label htmlFor="transaction-categoria" className="text-base font-semibold">
                  Categoría
                </Label>
                <select
                  id="transaction-categoria"
                  className="h-12 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-base ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formCategoriaId}
                  onChange={(event) => setFormCategoriaId(event.target.value)}
                  disabled={saving}
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre || "Sin nombre"}
                    </option>
                  ))}
                </select>
              </div>

              {formError && <p className="text-sm text-destructive">{formError}</p>}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={saving}
                className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 size-4" />
                    Guardar Transacción
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right Column - Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-5" />
              Historial de Movimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed">
                <p className="text-sm text-muted-foreground text-center px-4">
                  No hay transacciones en este período.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {filteredTransactions.map((transaction) => {
                  const isGasto = transaction.tipo === "gasto"
                  const categoryName = transaction.categorias?.nombre || "Sin categoría"

                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={cn(
                            "flex size-10 items-center justify-center rounded-full shrink-0",
                            isGasto
                              ? "bg-red-500 text-white dark:bg-red-500/80"
                              : "bg-emerald-500 text-white dark:bg-emerald-500/80"
                          )}
                        >
                          {isGasto ? (
                            <ArrowDownCircle className="size-5" />
                          ) : (
                            <ArrowUpCircle className="size-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{categoryName}</p>
                          <p className="text-xs text-muted-foreground">
                            {dateFormatter.format(new Date(transaction.fecha_transaccion))}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            isGasto
                              ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                          )}
                        >
                          {isGasto ? "Gasto" : "Ingreso"}
                        </span>
                        <p
                          className={cn(
                            "text-base font-bold",
                            isGasto
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {isGasto ? "-" : "+"}
                          {currencyFormatter.format(transaction.monto)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
