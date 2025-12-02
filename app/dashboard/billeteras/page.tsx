"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  CircleAlert,
  DollarSign,
  Edit3,
  Loader2,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { supabase } from "@/lib/supabaseClient"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatCurrency, useBcvRate } from "@/lib/currency"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FloatingAlertStack } from "@/components/ui/floating-alert-stack"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const PERIOD_OPTIONS = [
  { label: "Últimos 7 días", value: "7days" },
  { label: "Este mes", value: "thisMonth" },
  { label: "Mes pasado", value: "lastMonth" },
  { label: "Personalizado", value: "custom" },
] as const

const NAME_MAX_LENGTH = 13

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "USD",
})

type PeriodFilter = (typeof PERIOD_OPTIONS)[number]["value"]

type WalletRow = {
  id: string
  nombre: string | null
}

type TransactionRow = {
  id: string
  billetera_id: string | null
  monto: number | string | null
  tipo: "ingreso" | "gasto" | null
  fecha_transaccion: string | null
}

type WalletSummary = {
  id: string
  name: string
  balance: number
  income: number
  expense: number
  transactionCount: number
  positiveCount: number
  negativeCount: number
  status: "Activa" | "Sin movimientos"
}

type WalletDialogMode = "create" | "edit"

const getRangeForFilter = (
  filter: PeriodFilter,
  customStart?: Date,
  customEnd?: Date
) => {
  const now = new Date()
  const startOfDay = (date: Date) => {
    const next = new Date(date)
    next.setHours(0, 0, 0, 0)
    return next
  }
  const endOfDay = (date: Date) => {
    const next = new Date(date)
    next.setHours(23, 59, 59, 999)
    return next
  }

  switch (filter) {
    case "7days": {
      const start = new Date(now)
      start.setDate(now.getDate() - 6)
      return { start: startOfDay(start), end: endOfDay(now) }
    }
    case "thisMonth": {
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
      return { start, end: endOfDay(now) }
    }
    case "lastMonth": {
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))
      return { start, end }
    }
    case "custom": {
      return {
        start: customStart ? startOfDay(customStart) : undefined,
        end: customEnd ? endOfDay(customEnd) : undefined,
      }
    }
    default:
      return { start: undefined, end: undefined }
  }
}

export default function BilleterasPage() {
  const [wallets, setWallets] = React.useState<WalletSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [periodFilter, setPeriodFilter] = React.useState<PeriodFilter>("thisMonth")
  const [customStartDate, setCustomStartDate] = React.useState<Date | undefined>(undefined)
  const [customEndDate, setCustomEndDate] = React.useState<Date | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogMode, setDialogMode] = React.useState<WalletDialogMode>("create")
  const [editingWalletId, setEditingWalletId] = React.useState<string | null>(null)
  const [walletName, setWalletName] = React.useState("")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [actionPendingId, setActionPendingId] = React.useState<string | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = React.useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [walletPendingDelete, setWalletPendingDelete] = React.useState<WalletSummary | null>(null)
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
  const broadcastWalletsUpdated = React.useCallback(() => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("wallets:updated"))
  }, [])

  const loadWallets = React.useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return
      setLoading(true)
      setError(null)
      try {
        const { data: walletRows, error: walletError } = await supabase
          .from("billeteras")
          .select("id,nombre")
          .order("nombre", { ascending: true })

        if (walletError) throw walletError

        const walletsData = (walletRows ?? []) as WalletRow[]
        const walletIds = walletsData.map((wallet) => wallet.id)

        let transactions: TransactionRow[] = []
        if (walletIds.length > 0) {
          const range = getRangeForFilter(periodFilter, customStartDate, customEndDate)
          let query = supabase
            .from("transacciones")
            .select("id,billetera_id,monto,tipo,fecha_transaccion")
            .in("billetera_id", walletIds)

          if (range.start) {
            query = query.gte("fecha_transaccion", range.start.toISOString())
          }
          if (range.end) {
            query = query.lte("fecha_transaccion", range.end.toISOString())
          }

          const { data: txRows, error: txError } = await query
          if (txError) throw txError
          transactions = (txRows ?? []) as TransactionRow[]
        }

        const aggregates = new Map<string, WalletSummary>()

        for (const wallet of walletsData) {
          aggregates.set(wallet.id, {
            id: wallet.id,
            name: wallet.nombre?.trim() || "Sin nombre",
            balance: 0,
            income: 0,
            expense: 0,
            transactionCount: 0,
            positiveCount: 0,
            negativeCount: 0,
            status: "Sin movimientos",
          })
        }

        for (const tx of transactions) {
          if (!tx.billetera_id || !tx.tipo || !tx.fecha_transaccion) continue
          const amount = Number(tx.monto ?? 0)
          if (Number.isNaN(amount)) continue
          const record = aggregates.get(tx.billetera_id)
          if (!record) continue

          if (tx.tipo === "ingreso") {
            record.income += amount
            record.balance += amount
            record.positiveCount += 1
          } else if (tx.tipo === "gasto") {
            record.expense += amount
            record.balance -= amount
            record.negativeCount += 1
          }
          record.transactionCount += 1
          record.status = "Activa"
        }

        const summaries = Array.from(aggregates.values()).sort((a, b) => b.balance - a.balance)
        setWallets(summaries)
      } catch (loadError) {
        console.error("Error al cargar billeteras", loadError)
        setError("No pudimos cargar tus billeteras. Intenta nuevamente.")
        setWallets([])
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [periodFilter, customStartDate, customEndDate]
  )

  React.useEffect(() => {
    const controller = new AbortController()
    loadWallets(controller.signal)
    return () => controller.abort()
  }, [loadWallets])

  const summary = React.useMemo(() => {
    return wallets.reduce(
      (acc, wallet) => {
        acc.totalBalance += wallet.balance
        acc.positive += wallet.positiveCount
        acc.negative += wallet.negativeCount
        return acc
      },
      { totalBalance: 0, positive: 0, negative: 0 }
    )
  }, [wallets])

  const summaryCards = React.useMemo(
    () => [
      {
        title: "Balance Total",
        value: currencyFormatter.format(summary.totalBalance),
        bcvValue: formatBcvAmount(summary.totalBalance),
        icon: DollarSign,
        accent:
          "from-emerald-100/80 to-white text-emerald-700 border-emerald-200 dark:from-emerald-500/10 dark:to-slate-950 dark:text-emerald-200 dark:border-emerald-500/40",
        iconStyles: "bg-emerald-500 text-white dark:bg-emerald-500/60",
      },
      {
        title: "Total Billeteras",
        value: wallets.length.toString(),
        icon: Wallet,
        accent:
          "from-blue-100/80 to-white text-blue-700 border-blue-200 dark:from-blue-500/10 dark:to-slate-950 dark:text-blue-200 dark:border-blue-500/40",
        iconStyles: "bg-blue-500 text-white dark:bg-blue-500/60",
      },
      {
        title: "Movimientos",
        value: `${summary.positive} positivas · ${summary.negative} negativas`,
        icon: TrendingUp,
        accent:
          "from-purple-100/80 to-white text-purple-700 border-purple-200 dark:from-purple-500/10 dark:to-slate-950 dark:text-purple-200 dark:border-purple-500/40",
        iconStyles: "bg-purple-500 text-white dark:bg-purple-500/60",
        valueClassName: "text-2xl",
      },
    ],
    [summary, wallets.length, formatBcvAmount]
  )

  const handleOpenDialog = (mode: WalletDialogMode, wallet?: WalletSummary) => {
    setDialogMode(mode)
    if (mode === "edit" && wallet) {
      setEditingWalletId(wallet.id)
      setWalletName(wallet.name)
    } else {
      setEditingWalletId(null)
      setWalletName("")
    }
    setFormError(null)
    setDialogOpen(true)
  }

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setWalletName("")
      setEditingWalletId(null)
      setFormError(null)
    }
  }

  const handleSubmitWallet = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = walletName.trim()
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
      if (dialogMode === "edit" && editingWalletId) {
        const { error: updateError } = await supabase
          .from("billeteras")
          .update({ nombre: trimmed })
          .eq("id", editingWalletId)
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
          .from("billeteras")
          .insert({ nombre: trimmed, usuario_id: user.id })
        if (insertError) throw insertError
      }

      setDialogOpen(false)
      setWalletName("")
      setEditingWalletId(null)
      await loadWallets()
      broadcastWalletsUpdated()
    } catch (submitError) {
      console.error("Error al guardar billetera", submitError)
      setFormError("No pudimos guardar la billetera. Intenta nuevamente.")
    } finally {
      setSaving(false)
    }
  }

  const promptDeleteWallet = React.useCallback((wallet: WalletSummary) => {
    setWalletPendingDelete(wallet)
    setDeleteDialogOpen(true)
    setDeleteError(null)
  }, [])

  const closeDeleteDialog = React.useCallback(() => {
    setDeleteDialogOpen(false)
    setWalletPendingDelete(null)
  }, [])

  const handleDeleteWallet = React.useCallback(async () => {
    if (!walletPendingDelete) return

    setActionPendingId(walletPendingDelete.id)
    setDeleteError(null)
    setDeleteSuccess(null)
    try {
      const { count, error: countError } = await supabase
        .from("transacciones")
        .select("id", { count: "exact", head: true })
        .eq("billetera_id", walletPendingDelete.id)
      if (countError) throw countError

      if ((count ?? 0) > 0) {
        setDeleteError("No puedes eliminar una billetera con transacciones asociadas.")
        return
      }

      const { error: deleteError } = await supabase
        .from("billeteras")
        .delete()
        .eq("id", walletPendingDelete.id)
      if (deleteError) throw deleteError

      await loadWallets()
      broadcastWalletsUpdated()
      setDeleteSuccess(`La billetera "${walletPendingDelete.name}" se eliminó correctamente.`)
      closeDeleteDialog()
    } catch (deleteError) {
      console.error("Error al eliminar billetera", deleteError)
      setDeleteError("No pudimos eliminar la billetera. Intenta nuevamente.")
    } finally {
      setActionPendingId(null)
    }
  }, [walletPendingDelete, loadWallets, broadcastWalletsUpdated, closeDeleteDialog])

  React.useEffect(() => {
    if (!deleteSuccess) return
    const timeoutId = window.setTimeout(() => setDeleteSuccess(null), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [deleteSuccess])

  React.useEffect(() => {
    if (!deleteError) return
    const timeoutId = window.setTimeout(() => setDeleteError(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [deleteError])

  return (
    <>
      <FloatingAlertStack>
        {deleteError && (
          <Alert variant="destructive">
            <CircleAlert className="size-4" aria-hidden />
            <AlertTitle>No pudimos completar la acción</AlertTitle>
            <AlertDescription>{deleteError}</AlertDescription>
          </Alert>
        )}
        {deleteSuccess && (
          <Alert variant="success">
            <CheckCircle2 className="size-4" aria-hidden />
            <AlertTitle>Billetera eliminada</AlertTitle>
            <AlertDescription>{deleteSuccess}</AlertDescription>
          </Alert>
        )}
      </FloatingAlertStack>
      <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Billeteras</p>
          <h1 className="text-3xl font-semibold">Gestiona tus cuentas</h1>
          <p className="text-sm text-muted-foreground">
            Controla tus saldos, movimientos y organiza tus billeteras de manera centralizada.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {bcvLoading
              ? "Cargando tasa BCV..."
              : bcvRate
              ? `1 US$ = ${formatCurrency(bcvRate, "VES")} (BCV)`
              : "La tasa BCV no está disponible por ahora."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard" className="inline-flex items-center gap-2">
              <Wallet className="size-4" />
              Volver al dashboard
            </Link>
          </Button>
          <Button type="button" className="gap-2" onClick={() => handleOpenDialog("create")}>            <Plus className="size-4" />
            Nueva billetera
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="size-4" />
            <span className="font-medium">Periodo</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={periodFilter === option.value ? "default" : "outline"}
                onClick={() => setPeriodFilter(option.value)}
                className={cn(
                  periodFilter === option.value &&
                    "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:text-white"
                )}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {periodFilter === "custom" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fecha inicio
              </Label>
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
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fecha fin
              </Label>
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
          </div>
        )}
      </section>

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
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <Card
              key={card.title}
              className={cn("border bg-linear-to-br shadow-sm", card.accent)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <span className={cn("flex size-12 items-center justify-center rounded-full", card.iconStyles)}>
                  <Icon className="size-6" />
                </span>
              </CardHeader>
              <CardContent>
                <p className={cn("font-semibold tracking-tight", card.valueClassName ?? "text-3xl")}>{card.value}</p>
                {card.bcvValue && (
                  <p className="text-xs text-muted-foreground">≈ {card.bcvValue} BCV</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Mis billeteras</h2>
          <p className="text-sm text-muted-foreground">
            Todas tus cuentas en un solo lugar. Edita o elimina según lo necesites.
          </p>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed">
            <TrendingUp className="size-6 animate-pulse text-muted-foreground" />
          </div>
        ) : wallets.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aún no tienes billeteras. Crea la primera para comenzar.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {wallets.map((wallet) => {
              const balanceBcv = formatBcvAmount(wallet.balance)
              const incomeBcv = formatBcvAmount(wallet.income)
              const expenseBcv = formatBcvAmount(wallet.expense)

              return (
              <Card
                key={wallet.id}
                className="border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                        <Wallet className="size-5" />
                      </span>
                      <div>
                        <CardTitle className="text-lg font-semibold">{wallet.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {wallet.transactionCount} {wallet.transactionCount === 1 ? "transacción" : "transacciones"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      wallet.status === "Activa"
                        ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {wallet.status}
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo</p>
                    <p className="text-2xl font-semibold text-emerald-600">
                      {currencyFormatter.format(wallet.balance)}
                    </p>
                        {balanceBcv && (
                          <p className="text-xs text-muted-foreground">≈ {balanceBcv} BCV</p>
                        )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border bg-emerald-50/50 px-3 py-2 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                      <div className="flex items-center gap-1 text-emerald-600">
                        <ArrowUpCircle className="size-4" />
                        <span>Ingresos</span>
                      </div>
                          <p className="font-semibold">{currencyFormatter.format(wallet.income)}</p>
                          {incomeBcv && (
                            <p className="text-xs text-muted-foreground">≈ {incomeBcv} BCV</p>
                          )}
                    </div>
                    <div className="rounded-xl border bg-red-50/60 px-3 py-2 dark:border-red-500/20 dark:bg-red-500/5">
                      <div className="flex items-center gap-1 text-red-600">
                        <ArrowDownCircle className="size-4" />
                        <span>Gastos</span>
                      </div>
                          <p className="font-semibold">{currencyFormatter.format(wallet.expense)}</p>
                          {expenseBcv && (
                            <p className="text-xs text-muted-foreground">≈ {expenseBcv} BCV</p>
                          )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div className="rounded-lg border px-3 py-2">
                      Positivas: <span className="font-semibold text-emerald-600">{wallet.positiveCount}</span>
                    </div>
                    <div className="rounded-lg border px-3 py-2">
                      Negativas: <span className="font-semibold text-red-600">{wallet.negativeCount}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleOpenDialog("edit", wallet)}
                    >
                      <Edit3 className="size-4" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2"
                      onClick={() => promptDeleteWallet(wallet)}
                      disabled={actionPendingId === wallet.id}
                    >
                      {actionPendingId === wallet.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
              )
            })}
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "edit" ? "Editar billetera" : "Nueva billetera"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "edit"
                ? "Actualiza el nombre para mantener tus cuentas organizadas."
                : "Asigna un nombre representativo para identificarla fácilmente."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmitWallet}>
            <div className="space-y-2">
              <Label htmlFor="wallet-name">Nombre</Label>
              <Input
                id="wallet-name"
                placeholder="Ej. Principal, Ahorros..."
                value={walletName}
                onChange={(event) => setWalletName(event.target.value)}
                disabled={saving}
                maxLength={NAME_MAX_LENGTH}
              />
              <p className="text-xs text-muted-foreground">Máximo {NAME_MAX_LENGTH} caracteres.</p>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleDialogClose(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : dialogMode === "edit" ? "Guardar cambios" : "Crear billetera"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => (open ? setDeleteDialogOpen(true) : closeDeleteDialog())}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar billetera</AlertDialogTitle>
            <AlertDialogDescription>
              {walletPendingDelete ? (
                <>
                  Vas a eliminar <span className="font-semibold text-foreground">{walletPendingDelete.name}</span>. Esta acción no se puede deshacer.
                </>
              ) : (
                "Confirma si deseas eliminar esta billetera."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPendingId !== null} onClick={closeDeleteDialog}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWallet}
              disabled={!walletPendingDelete || actionPendingId === walletPendingDelete.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {walletPendingDelete && actionPendingId === walletPendingDelete.id ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </>
  )
}
