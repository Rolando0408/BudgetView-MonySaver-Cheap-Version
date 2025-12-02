"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import {
  Calendar as CalendarIcon,
  CreditCard,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  FolderKanban,
  Loader2,
  PiggyBank,
  Wallet,
} from "lucide-react"
import { jsPDF } from "jspdf"

import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { formatCurrency, useBcvRate } from "@/lib/currency"

const DATASET_OPTIONS = [
  {
    value: "transacciones",
    label: "Transacciones",
    description: "Exporta todos tus movimientos con categoría y billetera.",
    icon: CreditCard,
    accent:
      "border-emerald-300 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
  },
  {
    value: "billeteras",
    label: "Billeteras",
    description: "Listado de cuentas registradas para tu usuario.",
    icon: Wallet,
    accent:
      "border-blue-300 bg-blue-50/70 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100",
  },
  {
    value: "categorias",
    label: "Categorías",
    description: "Catálogo de categorías de gastos e ingresos.",
    icon: FolderKanban,
    accent:
      "border-purple-300 bg-purple-50/70 text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-100",
  },
  {
    value: "presupuestos",
    label: "Presupuestos",
    description: "Metas mensuales por categoría con su límite de gasto.",
    icon: PiggyBank,
    accent:
      "border-amber-300 bg-amber-50/70 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
  },
] as const

type DatasetType = (typeof DATASET_OPTIONS)[number]["value"]
type ExportFormat = "csv" | "json" | "pdf" | "txt"
type MovementFilter = "all" | "ingreso" | "gasto"

type DatasetStats = Record<DatasetType, number>

type WalletOption = { id: string; nombre: string | null }

type TransactionExportRow = {
  id: string
  monto: number | string | null
  tipo: string | null
  descripcion: string | null
  fecha_transaccion: string | null
  categorias?: { nombre: string | null } | Array<{ nombre: string | null }> | null
  billeteras?: { nombre: string | null } | Array<{ nombre: string | null }> | null
}

type CategoryExportRow = {
  id: string
  nombre: string | null
  tipo: "gasto" | "ingreso" | null
}

type WalletExportRow = {
  id: string
  nombre: string | null
}
type WalletUsageRow = { billetera_id: string | null }

type BudgetExportRow = {
  id: string
  monto: number | string | null
  periodo: string | null
  categorias?: { nombre: string | null } | Array<{ nombre: string | null }> | null
}

type ColumnMeta = { key: string; label: string }

type NormalizedRow = Record<string, string | number | null>

const DATASET_COLUMNS: Record<DatasetType, ColumnMeta[]> = {
  transacciones: [
    { key: "date", label: "Fecha" },
    { key: "type", label: "Tipo" },
    { key: "wallet", label: "Billetera" },
    { key: "category", label: "Categoría" },
    { key: "amountUsd", label: "Monto (USD)" },
    { key: "amountVes", label: "Monto (VES BCV)" },
    { key: "description", label: "Descripción" },
  ],
  billeteras: [
    { key: "walletId", label: "ID" },
    { key: "name", label: "Nombre" },
  ],
  categorias: [
    { key: "categoryId", label: "ID" },
    { key: "name", label: "Nombre" },
    { key: "kind", label: "Tipo" },
  ],
  presupuestos: [
    { key: "category", label: "Categoría" },
    { key: "period", label: "Periodo" },
    { key: "limitUsd", label: "Límite (USD)" },
    { key: "limitVes", label: "Límite (VES BCV)" },
  ],
}

const createDefaultRange = (): DateRange => {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 30)
  return { from: start, to: today }
}

const toCsv = (rows: NormalizedRow[], columns: ColumnMeta[]) => {
  if (rows.length === 0) return ""
  const escapeValue = (value: string | number | null) => {
    if (value === null || value === undefined) return ""
    const stringValue = String(value)
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }
    return stringValue
  }

  const header = columns.map((column) => column.label).join(",")
  const lines = rows.map((row) =>
    columns
      .map((column) => escapeValue(row[column.key] ?? ""))
      .join(",")
  )

  return [header, ...lines].join("\n")
}

const toPlainText = (rows: NormalizedRow[], columns: ColumnMeta[]) => {
  if (rows.length === 0) return ""
  const header = columns.map((column) => column.label).join(" | ")
  const divider = "-".repeat(Math.max(header.length, 24))
  const lines = rows.map((row) =>
    columns
      .map((column) => {
        const value = row[column.key]
        if (value === null || value === undefined) return ""
        return typeof value === "number" ? value.toString() : String(value)
      })
      .join(" | ")
  )
  return [header, divider, ...lines].join("\n")
}

const generatePdfDocument = (rows: NormalizedRow[], columns: ColumnMeta[], title: string, note: string) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const margin = 40
  const usableWidth = doc.internal.pageSize.getWidth() - margin * 2
  const usableHeight = doc.internal.pageSize.getHeight() - margin * 2
  let cursorY = margin

  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.text(title, margin, cursorY)

  cursorY += 18
  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.text(note, margin, cursorY)
  cursorY += 16

  const lines = toPlainText(rows, columns).split("\n")
  doc.setFont("courier", "normal")
  doc.setFontSize(10)

  lines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, usableWidth)
    wrapped.forEach((chunk: string) => {
      if (cursorY > margin + usableHeight) {
        doc.addPage()
        cursorY = margin
      }
      doc.text(chunk, margin, cursorY)
      cursorY += 12
    })
  })

  return doc
}

const downloadFile = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

const startOfDayIso = (date?: Date | null) => {
  if (!date) return null
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next.toISOString()
}

const endOfDayIso = (date?: Date | null) => {
  if (!date) return null
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next.toISOString()
}

export default function ExportarPage() {
  const [userId, setUserId] = React.useState<string | null>(null)
  const [authError, setAuthError] = React.useState<string | null>(null)
  const [stats, setStats] = React.useState<DatasetStats>({
    transacciones: 0,
    billeteras: 0,
    categorias: 0,
    presupuestos: 0,
  })
  const [statsLoading, setStatsLoading] = React.useState(true)
  const [wallets, setWallets] = React.useState<WalletOption[]>([])
  const [walletFilter, setWalletFilter] = React.useState<string>("all")
  const [transactionRange, setTransactionRange] = React.useState<DateRange | undefined>(createDefaultRange())
  const [monthFilter, setMonthFilter] = React.useState<string>(format(new Date(), "yyyy-MM"))
  const [selectedDataset, setSelectedDataset] = React.useState<DatasetType>("transacciones")
  const [movementFilter, setMovementFilter] = React.useState<MovementFilter>("all")
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("csv")
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null)
  const [statusVariant, setStatusVariant] = React.useState<"success" | "error" | null>(null)
  const [exporting, setExporting] = React.useState(false)
  const { rate: bcvRate, loading: bcvLoading, error: bcvError } = useBcvRate()

  React.useEffect(() => {
    let active = true
    const resolveUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (!active) return
      if (error || !data.user) {
        setAuthError("Debes iniciar sesión para exportar tus datos.")
        setUserId(null)
        return
      }
      setUserId(data.user.id)
      setAuthError(null)
    }
    resolveUser()
    return () => {
      active = false
    }
  }, [])

  const loadReferenceData = React.useCallback(
    async (activeUserId: string) => {
      setStatsLoading(true)
      try {
        const [walletResponse, txCount, walletCount, categoryCount, budgetCount] = await Promise.all([
          supabase
            .from("billeteras")
            .select("id,nombre")
            .eq("usuario_id", activeUserId)
            .order("nombre", { ascending: true }),
          supabase
            .from("transacciones")
            .select("id", { count: "exact", head: true })
            .eq("usuario_id", activeUserId),
          supabase
            .from("billeteras")
            .select("id", { count: "exact", head: true })
            .eq("usuario_id", activeUserId),
          supabase
            .from("categorias")
            .select("id", { count: "exact", head: true })
            .eq("usuario_id", activeUserId),
          supabase
            .from("presupuestos")
            .select("id", { count: "exact", head: true })
            .eq("usuario_id", activeUserId),
        ])

        if (walletResponse.error) throw walletResponse.error
        if (txCount.error) throw txCount.error
        if (walletCount.error) throw walletCount.error
        if (categoryCount.error) throw categoryCount.error
        if (budgetCount.error) throw budgetCount.error

        setWallets((walletResponse.data ?? []) as WalletOption[])
        setStats({
          transacciones: txCount.count ?? 0,
          billeteras: walletCount.count ?? 0,
          categorias: categoryCount.count ?? 0,
          presupuestos: budgetCount.count ?? 0,
        })
      } catch (error) {
        console.error("Error loading reference data", error)
        setStatusVariant("error")
        setStatusMessage("No pudimos cargar la información de referencia. Intenta nuevamente.")
      } finally {
        setStatsLoading(false)
      }
    },
    []
  )

  React.useEffect(() => {
    if (!userId) return
    loadReferenceData(userId)
  }, [userId, loadReferenceData])

  const normalizedMonthLabel = React.useMemo(() => {
    if (!monthFilter) return ""
    const date = new Date(`${monthFilter}-01T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return monthFilter
    return format(date, "MMMM yyyy", { locale: es })
  }, [monthFilter])

  const datasetCardData = DATASET_OPTIONS.map((option) => {
    const Icon = option.icon
    const count = stats[option.value] ?? 0
    return (
      <Card key={option.value} className={cn("border bg-card shadow-sm", option.accent)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{option.label}</CardTitle>
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-background/60">
            <Icon className="size-5" />
          </span>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{statsLoading ? "--" : count}</p>
          <p className="text-xs text-muted-foreground">{option.description}</p>
        </CardContent>
      </Card>
    )
  })

  const normalizeTransactions = React.useCallback(
    (rows: TransactionExportRow[]): NormalizedRow[] =>
      rows.map((row) => {
        const categoryRecord = Array.isArray(row.categorias) ? row.categorias[0] : row.categorias
        const walletRecord = Array.isArray(row.billeteras) ? row.billeteras[0] : row.billeteras
        const amount = Number(row.monto ?? 0)
        return {
          date: row.fecha_transaccion ? new Date(row.fecha_transaccion).toISOString() : null,
          type: row.tipo ?? "",
          wallet: walletRecord?.nombre ?? "",
          category: categoryRecord?.nombre ?? "",
          amountUsd: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
          amountVes: bcvRate && Number.isFinite(amount) ? Number((amount * bcvRate).toFixed(2)) : null,
          description: row.descripcion ?? "",
        }
      }),
    [bcvRate]
  )

  const normalizeWallets = React.useCallback(
    (rows: WalletExportRow[]): NormalizedRow[] =>
      rows.map((row) => ({
        walletId: row.id,
        name: row.nombre?.trim() || "Sin nombre",
      })),
    []
  )

  const normalizeCategories = React.useCallback(
    (rows: CategoryExportRow[]): NormalizedRow[] =>
      rows.map((row) => ({
        categoryId: row.id,
        name: row.nombre?.trim() || "Sin nombre",
        kind: row.tipo ? (row.tipo === "gasto" ? "Gasto" : "Ingreso") : "",
      })),
    []
  )

  const normalizeBudgets = React.useCallback(
    (rows: BudgetExportRow[]): NormalizedRow[] =>
      rows.map((row) => {
        const categoryRecord = Array.isArray(row.categorias) ? row.categorias[0] : row.categorias
        const limit = Number(row.monto ?? 0)
        return {
          category: categoryRecord?.nombre ?? "Sin categoría",
          period: row.periodo ? format(new Date(row.periodo), "yyyy-MM-dd") : "",
          limitUsd: Number.isFinite(limit) ? Number(limit.toFixed(2)) : 0,
          limitVes: bcvRate && Number.isFinite(limit) ? Number((limit * bcvRate).toFixed(2)) : null,
        }
      }),
    [bcvRate]
  )

  const handleExport = React.useCallback(async () => {
    if (!userId) {
      setAuthError("Debes iniciar sesión nuevamente para exportar.")
      return
    }

    setExporting(true)
    setStatusMessage(null)
    setStatusVariant(null)

    try {
      let rows: NormalizedRow[] = []

      if (selectedDataset === "transacciones") {
        let query = supabase
          .from("transacciones")
          .select("id,monto,tipo,descripcion,fecha_transaccion,categorias(nombre),billeteras(nombre)")
          .eq("usuario_id", userId)
          .order("fecha_transaccion", { ascending: true })

        if (walletFilter !== "all") {
          query = query.eq("billetera_id", walletFilter)
        }

        if (movementFilter !== "all") {
          query = query.eq("tipo", movementFilter)
        }

        const fromIso = startOfDayIso(transactionRange?.from)
        const toIso = endOfDayIso(transactionRange?.to)
        if (fromIso) {
          query = query.gte("fecha_transaccion", fromIso)
        }
        if (toIso) {
          query = query.lte("fecha_transaccion", toIso)
        }

        const { data, error } = await query
        if (error) throw error
        rows = normalizeTransactions((data ?? []) as TransactionExportRow[])
      }

      if (selectedDataset === "billeteras") {
        const { data, error } = await supabase
          .from("billeteras")
          .select("id,nombre")
          .eq("usuario_id", userId)
          .order("nombre", { ascending: true })
        if (error) throw error

        let walletRows = (data ?? []) as WalletExportRow[]
        if (movementFilter !== "all") {
          const { data: usageData, error: usageError } = await supabase
            .from("transacciones")
            .select("billetera_id")
            .eq("usuario_id", userId)
            .eq("tipo", movementFilter)
            .not("billetera_id", "is", null)
          if (usageError) throw usageError
          const allowed = new Set(
            ((usageData ?? []) as WalletUsageRow[])
              .map((row) => row.billetera_id)
              .filter((walletId): walletId is string => Boolean(walletId))
          )
          walletRows = walletRows.filter((wallet) => allowed.has(wallet.id))
        }

        rows = normalizeWallets(walletRows)
      }

      if (selectedDataset === "categorias") {
        let query = supabase.from("categorias").select("id,nombre,tipo").eq("usuario_id", userId)
        if (movementFilter !== "all") {
          query = query.eq("tipo", movementFilter)
        }
        const { data, error } = await query.order("nombre", { ascending: true })
        if (error) throw error
        rows = normalizeCategories((data ?? []) as CategoryExportRow[])
      }

      if (selectedDataset === "presupuestos") {
        if (!monthFilter) {
          setStatusVariant("error")
          setStatusMessage("Selecciona un mes para exportar tus presupuestos.")
          setExporting(false)
          return
        }
        const targetPeriod = `${monthFilter}-01`
        const { data, error } = await supabase
          .from("presupuestos")
          .select("id,monto,periodo,categorias(nombre)")
          .eq("usuario_id", userId)
          .eq("periodo", targetPeriod)
          .order("periodo", { ascending: true })
        if (error) throw error
        rows = normalizeBudgets((data ?? []) as BudgetExportRow[])
      }

      if (rows.length === 0) {
        setStatusVariant("error")
        setStatusMessage("No hay datos para exportar con los filtros seleccionados.")
        setExporting(false)
        return
      }

      const columns = DATASET_COLUMNS[selectedDataset]
      const datasetLabel = DATASET_OPTIONS.find((option) => option.value === selectedDataset)?.label ?? selectedDataset
      const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
      const fileBaseName = `${selectedDataset}-${timestamp}`

      if (exportFormat === "json") {
        downloadFile(JSON.stringify(rows, null, 2), `${fileBaseName}.json`, "application/json")
      } else if (exportFormat === "csv") {
        const csvPayload = toCsv(rows, columns)
        downloadFile(csvPayload, `${fileBaseName}.csv`, "text/csv;charset=utf-8")
      } else if (exportFormat === "txt") {
        const txtPayload = toPlainText(rows, columns)
        downloadFile(txtPayload, `${fileBaseName}.txt`, "text/plain;charset=utf-8")
      } else {
        const doc = generatePdfDocument(
          rows,
          columns,
          `Exportación de ${datasetLabel}`,
          `Generado el ${format(new Date(), "dd MMM yyyy HH:mm", { locale: es })}`
        )
        doc.save(`${fileBaseName}.pdf`)
      }

      setStatusVariant("success")
      setStatusMessage(`Exportamos ${rows.length} registros en formato ${exportFormat.toUpperCase()}.`)
    } catch (error) {
      console.error("Error exporting data", error)
      setStatusVariant("error")
      setStatusMessage("No pudimos exportar la información. Intenta nuevamente.")
    } finally {
      setExporting(false)
    }
  }, [exportFormat, monthFilter, movementFilter, normalizeBudgets, normalizeCategories, normalizeTransactions, normalizeWallets, selectedDataset, transactionRange, userId, walletFilter])

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Centro de datos</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Exporta tu información</h1>
            <p className="text-sm text-muted-foreground">
              Descarga tus movimientos, billeteras, categorías y presupuestos en formato CSV, JSON, PDF o TXT.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {bcvLoading
                ? "Cargando tasa BCV..."
                : bcvRate
                  ? `1 US$ = ${formatCurrency(bcvRate, "VES")} (BCV)`
                  : bcvError ?? "No pudimos obtener la tasa BCV. Exportaremos sin equivalentes."}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Database className="size-4" />
            <span>Datos personales y seguros · Solo tú puedes descargarlos</span>
          </div>
        </div>
        {authError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {authError}
          </div>
        )}
        {statusMessage && (
          <div
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              statusVariant === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100"
            )}
          >
            {statusMessage}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{datasetCardData}</div>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-5" />
            Configura tu exportación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 lg:grid-cols-2">
            {DATASET_OPTIONS.map((option) => {
              const Icon = option.icon
              const isActive = selectedDataset === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:shadow-sm",
                    isActive
                      ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-500/10"
                      : "border-border bg-card"
                  )}
                  onClick={() => setSelectedDataset(option.value)}
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <p className="font-semibold">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormat)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un formato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">
                      <span className="inline-flex items-center gap-2">
                        <FileSpreadsheet className="size-4" /> CSV (Excel, Google Sheets)
                      </span>
                    </SelectItem>
                    <SelectItem value="json">
                      <span className="inline-flex items-center gap-2">
                        <FileJson className="size-4" /> JSON (integraciones, APIs)
                      </span>
                    </SelectItem>
                    <SelectItem value="pdf">
                      <span className="inline-flex items-center gap-2">
                        <FileType className="size-4" /> PDF (imprimible)
                      </span>
                    </SelectItem>
                    <SelectItem value="txt">
                      <span className="inline-flex items-center gap-2">
                        <FileText className="size-4" /> TXT (texto plano)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {["transacciones", "billeteras", "categorias"].includes(selectedDataset) && (
                <div className="space-y-2">
                  <Label>Tipo de movimiento</Label>
                  <Select value={movementFilter} onValueChange={(value) => setMovementFilter(value as MovementFilter)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Ingresos y egresos</SelectItem>
                      <SelectItem value="ingreso">Solo ingresos</SelectItem>
                      <SelectItem value="gasto">Solo egresos</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Aplicamos este filtro cuando exportas transacciones, billeteras o categorías.
                  </p>
                </div>
              )}

              {selectedDataset === "transacciones" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Billetera</Label>
                    <Select value={walletFilter} onValueChange={setWalletFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una billetera" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {wallets.map((wallet) => (
                          <SelectItem key={wallet.id} value={wallet.id}>
                            {wallet.nombre?.trim() || "Sin nombre"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Rango de fechas</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !transactionRange?.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {transactionRange?.from ? (
                            transactionRange.to ? (
                              <span>
                                {format(transactionRange.from, "dd MMM yyyy", { locale: es })} -{" "}
                                {format(transactionRange.to, "dd MMM yyyy", { locale: es })}
                              </span>
                            ) : (
                              format(transactionRange.from, "dd MMM yyyy", { locale: es })
                            )
                          ) : (
                            <span>Selecciona un rango</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          numberOfMonths={2}
                          selected={transactionRange}
                          onSelect={(range) => setTransactionRange(range)}
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Si no seleccionas fechas exportaremos todo el historial disponible.
                    </p>
                  </div>
                </div>
              )}

              {selectedDataset === "presupuestos" && (
                <div className="space-y-2">
                  <Label>Mes</Label>
                  <Input
                    type="month"
                    value={monthFilter}
                    onChange={(event) => setMonthFilter(event.target.value)}
                    min="2018-01"
                    max="2035-12"
                  />
                  <p className="text-xs text-muted-foreground">Periodo seleccionado: {normalizedMonthLabel}</p>
                </div>
              )}

              {selectedDataset === "billeteras" && (
                <p className="text-sm text-muted-foreground">
                  Exportaremos todas tus billeteras activas. Usa el filtro de tipo para quedarte solo con las que
                  registran ingresos o egresos.
                </p>
              )}

              {selectedDataset === "categorias" && (
                <p className="text-sm text-muted-foreground">
                  Obtendrás la lista de categorías con su tipo (gasto o ingreso) y puedes limitarla usando el filtro.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">¿Qué incluye este archivo?</p>
                <ul className="mt-2 space-y-1">
                  {DATASET_COLUMNS[selectedDataset].map((column) => (
                    <li key={column.key} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {column.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs">
                  Los valores en VES dependen de la tasa BCV disponible al momento de exportar.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="flex-1" onClick={() => {
                  setWalletFilter("all")
                  setTransactionRange(createDefaultRange())
                  setMonthFilter(format(new Date(), "yyyy-MM"))
                  setMovementFilter("all")
                }}>
                  Restablecer filtros
                </Button>
                <Button type="button" className="flex-1" onClick={handleExport} disabled={exporting || !!authError}>
                  {exporting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Preparando archivo...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 size-4" />
                      Exportar datos
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
