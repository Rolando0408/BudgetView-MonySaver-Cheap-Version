"use client";

import * as React from "react"
import { ChevronDown, Loader2, Wallet2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabaseClient"

type TransactionBalanceRow = {
    monto: number | string | null
    tipo: "ingreso" | "gasto" | null
}

type WalletRow = {
    id: string
    nombre: string | null
}

type WalletOption = {
    id: string
    name: string
}

type HeaderProps = {
    className?: string
    appName?: string
    tagline?: string
    currentBalance?: number
    currency?: string
    selectedWallet?: string
    onWalletChange?: (walletId: string) => void
}

const currencyFormatters = new Map<string, Intl.NumberFormat>()
function formatCurrency(value: number, currency: string) {
    if (!currencyFormatters.has(currency)) {
        currencyFormatters.set(
            currency,
            new Intl.NumberFormat("es-ES", {
                style: "currency",
                currency,
                maximumFractionDigits: 2,
            })
        )
    }
    return currencyFormatters.get(currency)!.format(value)
}

export function Header({
    className,
    appName = "Budgetview",
    tagline = "MonySaver",
    currentBalance = 0,
    currency = "USD",
    selectedWallet,
    onWalletChange,
}: HeaderProps) {
    const broadcastWalletChange = React.useCallback((value: string) => {
        if (typeof window === "undefined") return
        try {
            window.localStorage.setItem("dashboard.activeWalletId", value)
        } catch (_error) {
            // Ignore storage failures (private mode, etc.)
        }

        window.dispatchEvent(
            new CustomEvent("wallet:changed", {
                detail: { walletId: value },
            })
        )
    }, [])

    const [walletId, setWalletId] = React.useState<string | null>(selectedWallet ?? null)
    const [wallets, setWallets] = React.useState<WalletOption[]>([])
    const [walletsLoading, setWalletsLoading] = React.useState(true)
    const [walletsError, setWalletsError] = React.useState<string | null>(null)
    const [balance, setBalance] = React.useState<number>(currentBalance)
    const [balanceLoading, setBalanceLoading] = React.useState(true)
    const [balanceError, setBalanceError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!selectedWallet) return
        setWalletId(selectedWallet)
    }, [selectedWallet])

    React.useEffect(() => {
        if (!walletId) return
        broadcastWalletChange(walletId)
    }, [walletId, broadcastWalletChange])

    React.useEffect(() => {
        let active = true

        const fetchWallets = async () => {
            setWalletsLoading(true)
            setWalletsError(null)
            try {
                const { data, error } = await supabase
                    .from("billeteras")
                    .select("id,nombre")
                    .order("nombre", { ascending: true, nullsFirst: false })

                if (!active) return

                if (error) {
                    throw error
                }

                const rows = (data ?? []) as WalletRow[]
                const records = rows.map((wallet) => ({
                    id: wallet.id,
                    name: (wallet.nombre ?? "Billetera sin nombre").trim() || "Billetera sin nombre",
                }))

                setWallets(records)

                setWalletId((prev) => {
                    if (selectedWallet && records.some((wallet) => wallet.id === selectedWallet)) {
                        return selectedWallet
                    }

                    if (prev && records.some((wallet) => wallet.id === prev)) {
                        return prev
                    }

                    return records.length > 0 ? records[0].id : null
                })
            } catch (error) {
                if (!active) return
                console.error("Error al cargar billeteras", error)
                setWallets([])
                setWalletsError("No pudimos cargar tus billeteras.")
            } finally {
                if (active) {
                    setWalletsLoading(false)
                }
            }
        }

        fetchWallets()

        return () => {
            active = false
        }
    }, [selectedWallet])

    const fetchBalance = React.useCallback(async () => {
        if (!walletId) {
            return null
        }

        const { data, error } = await supabase
            .from("transacciones")
            .select("monto,tipo")
            .eq("billetera_id", walletId)

        if (error) {
            throw error
        }

        const rows = (data ?? []) as TransactionBalanceRow[]
        let totalIncome = 0
        let totalExpense = 0

        for (const row of rows) {
            const amount = Number(row.monto ?? 0)
            if (Number.isNaN(amount)) {
                continue
            }
            if (row.tipo === "ingreso") {
                totalIncome += amount
            } else if (row.tipo === "gasto") {
                totalExpense += amount
            }
        }

        return totalIncome - totalExpense
    }, [walletId])

    React.useEffect(() => {
        if (!walletId) {
            return
        }

        let active = true

        const loadBalance = async () => {
            setBalanceLoading(true)
            setBalanceError(null)
            try {
                const total = await fetchBalance()
                if (!active || total === null) return
                setBalance(total)
            } catch (error) {
                if (!active) return
                console.error("Error al obtener el saldo actual", error)
                setBalanceError("No pudimos cargar tu saldo.")
            } finally {
                if (active) {
                    setBalanceLoading(false)
                }
            }
        }

        loadBalance()

        return () => {
            active = false
        }
    }, [walletId, fetchBalance])

    React.useEffect(() => {
        if (!walletId) {
            return
        }

        const handleTransactionsUpdated = (event: Event) => {
            if (!walletId) return
            const customEvent = event as CustomEvent<{ walletId?: string }>
            if (customEvent.detail?.walletId && customEvent.detail.walletId !== walletId) {
                return
            }

            fetchBalance()
                .then((total) => {
                    if (total === null) return
                    setBalance(total)
                    setBalanceError(null)
                })
                .catch((error) => {
                    console.error("Error al actualizar el saldo", error)
                    setBalanceError("No pudimos cargar tu saldo.")
                })
        }

        window.addEventListener("transactions:updated", handleTransactionsUpdated as EventListener)

        return () => {
            window.removeEventListener("transactions:updated", handleTransactionsUpdated as EventListener)
        }
    }, [walletId, fetchBalance])

    React.useEffect(() => {
        if (!walletId) {
            return
        }

        const channel = supabase
            .channel(`transacciones-balance-${walletId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "transacciones",
                    filter: `billetera_id=eq.${walletId}`,
                },
                () => {
                    fetchBalance()
                        .then((total) => {
                            if (total === null) return
                            setBalance(total)
                            setBalanceError(null)
                        })
                        .catch((error) => {
                            console.error("Error al actualizar el saldo", error)
                            setBalanceError("No pudimos cargar tu saldo.")
                        })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [walletId, fetchBalance])

    React.useEffect(() => {
        if (walletId) {
            return
        }

        if (walletsLoading) {
            setBalanceLoading(true)
            setBalanceError(null)
            return
        }

        setBalanceLoading(false)
        setBalanceError(null)
        setBalance(0)
    }, [walletId, walletsLoading])

    const handleWalletChange = (value: string) => {
        if (!value || value === walletId) return
        setWalletId(value)
        onWalletChange?.(value)
    }

    const selectedWalletLabel = wallets.find((wallet) => wallet.id === walletId)?.name
    const walletButtonLabel = walletsLoading
        ? "Cargando billeteras..."
        : wallets.length === 0
            ? "Sin billeteras disponibles"
            : selectedWalletLabel ?? "Selecciona una billetera"

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 flex w-full flex-col gap-4 border bg-card/80 py-2.5 px-8 shadow-sm backdrop-blur supports-backdrop-filter:bg-card/60 md:flex-row md:items-center md:justify-between",
                className
            )}
        >
            <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Wallet2 className="size-6" />
                </div>
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{tagline}</p>
                    <p className="text-2xl font-semibold leading-tight tracking-tight">{appName}</p>
                </div>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
                <div className="rounded-2xl border bg-background/60 px-6 py-2 text-center shadow-xs">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Saldo actual</p>
                    {balanceLoading ? (
                        <div className="flex h-10 items-center justify-center">
                            <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : walletId ? (
                        <p className="text-2xl font-semibold tracking-tight">{formatCurrency(balance, currency)}</p>
                    ) : (
                        <p className="text-xs text-muted-foreground">Selecciona una billetera para ver tu saldo.</p>
                    )}
                    {balanceError && !balanceLoading && (
                        <p className="mt-1 text-xs font-medium text-destructive">{balanceError}</p>
                    )}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="ml-1 mb-0.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Mi billetera
                    </label>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="h-9 w-35 justify-between rounded-xl border bg-background/80 px-4 text-sm font-medium shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                                disabled={walletsLoading || wallets.length === 0}
                            >
                                <span>{walletButtonLabel}</span>
                                {walletsLoading ? (
                                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                ) : (
                                    <span className="text-muted-foreground">
                                        <ChevronDown className="size-4 text-muted-foreground" />
                                    </span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-20">
                            {walletsLoading ? (
                                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                                    <Loader2 className="size-4 animate-spin" />
                                    Cargando billeteras...
                                </div>
                            ) : wallets.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                    No tienes billeteras registradas.
                                </div>
                            ) : (
                                <DropdownMenuRadioGroup
                                    value={walletId ?? ""}
                                    onValueChange={handleWalletChange}
                                >
                                    {wallets.map((option) => (
                                        <DropdownMenuRadioItem
                                            key={option.id}
                                            value={option.id}
                                        >
                                            {option.name}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {walletsError && (
                        <p className="text-xs font-medium text-destructive">{walletsError}</p>
                    )}
                    {!walletsError && !walletsLoading && wallets.length === 0 && (
                        <p className="text-xs text-muted-foreground">Crea una billetera para comenzar.</p>
                    )}
                </div>
            </div>
        </header>
    )
}