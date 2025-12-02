"use client";

import * as React from "react"
import { ChevronDown, Loader2 } from "lucide-react"
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
import { GLOBAL_WALLET_ID, GLOBAL_WALLET_LABEL } from "@/lib/wallets"
import { formatCurrency, useBcvRate } from "@/lib/currency"
import { Logo } from "@/components/logo";

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
        } catch {
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
    const { rate: bcvRate, loading: bcvLoading, error: bcvError } = useBcvRate()

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

                const availableWallets: WalletOption[] = [
                    { id: GLOBAL_WALLET_ID, name: GLOBAL_WALLET_LABEL },
                    ...records,
                ]

                let storedWalletId: string | null = null
                if (typeof window !== "undefined") {
                    try {
                        storedWalletId = window.localStorage.getItem("dashboard.activeWalletId")
                    } catch {
                        storedWalletId = null
                    }
                }

                setWallets(availableWallets)

                setWalletId((prev) => {
                    const preferredOrder = [selectedWallet, prev, storedWalletId]
                    for (const candidate of preferredOrder) {
                        if (candidate && availableWallets.some((wallet) => wallet.id === candidate)) {
                            return candidate
                        }
                    }

                    return availableWallets.length > 0 ? availableWallets[0].id : null
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

        const query = supabase
            .from("transacciones")
            .select("monto,tipo")

        if (walletId !== GLOBAL_WALLET_ID) {
            query.eq("billetera_id", walletId)
        }

        const { data, error } = await query

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
            if (
                walletId !== GLOBAL_WALLET_ID &&
                customEvent.detail?.walletId &&
                customEvent.detail.walletId !== walletId
            ) {
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
            .channel(
                walletId === GLOBAL_WALLET_ID
                    ? "transacciones-balance-global"
                    : `transacciones-balance-${walletId}`
            )
            .on(
                "postgres_changes",
                walletId === GLOBAL_WALLET_ID
                    ? {
                        event: "*",
                        schema: "public",
                        table: "transacciones",
                    }
                    : {
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

    const balanceInVES = React.useMemo(() => {
        if (!bcvRate || balance <= 0) return null
        return balance * bcvRate
    }, [balance, bcvRate])

    const selectedWalletLabel = wallets.find((wallet) => wallet.id === walletId)?.name
    const walletButtonLabel = walletsLoading
        ? "Cargando billeteras..."
        : wallets.length === 0
            ? "Sin billeteras disponibles"
            : selectedWalletLabel ?? "Selecciona una billetera"

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 border bg-card/80 px-4 py-2 shadow-sm backdrop-blur supports-backdrop-filter:bg-card/60 sm:px-6 md:px-8 md:py-2.5",
                className
            )}
        >
            <div className="flex w-full items-center gap-3 overflow-x-auto sm:justify-between">
                <Logo
                    className="shrink-0"
                    textClassName="hidden sm:block"
                    title={appName}
                    subtitle={tagline}
                />

                <div className="flex flex-1 min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
                    <div className="flex w-full gap-2 sm:hidden">
                        <div className="flex flex-1 flex-col rounded-xl border bg-background/60 px-3 py-1.5 text-center shadow-xs">
                            <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">Saldo</p>
                            {balanceLoading ? (
                                <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                            ) : walletId ? (
                                <>
                                    <p className="text-sm font-semibold tracking-tight">
                                        {formatCurrency(balance, currency)}
                                    </p>
                                    {balanceInVES && (
                                        <p className="text-[0.65rem] text-muted-foreground">
                                            ≈ {formatCurrency(balanceInVES, "VES")}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-[0.65rem] text-muted-foreground">Selecciona una billetera</p>
                            )}
                        </div>

                        <div className="flex flex-1 flex-col rounded-xl border bg-background/60 px-3 py-1.5 shadow-xs">
                            <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">Billetera</p>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="h-7 w-full justify-between px-0 text-xs font-semibold"
                                        disabled={walletsLoading || wallets.length === 0}
                                    >
                                        <span className="truncate">{walletButtonLabel}</span>
                                        {walletsLoading ? (
                                            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="size-3.5 text-muted-foreground" />
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-48">
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
                        </div>
                    </div>

                    <div className="hidden sm:block rounded-2xl border bg-background/60 px-6 py-2 text-center shadow-xs">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Saldo actual</p>
                        {balanceLoading ? (
                            <div className="flex h-10 items-center justify-center">
                                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : walletId ? (
                            <>
                                <p className="text-md font-semibold tracking-tight">{formatCurrency(balance, currency)}</p>
                                {balanceInVES && (
                                    <p className="text-xs text-muted-foreground">
                                        ≈ {formatCurrency(balanceInVES, "VES")} {bcvLoading ? "(actualizando...)" : "(BCV)"}
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-xs text-muted-foreground">Selecciona una billetera para ver tu saldo.</p>
                        )}
                        {balanceError && !balanceLoading && (
                            <p className="mt-1 text-xs font-medium text-destructive">{balanceError}</p>
                        )}
                        {bcvError && !bcvLoading && (
                            <p className="mt-1 text-xs text-destructive">{bcvError}</p>
                        )}
                    </div>

                    <div className="hidden w-full flex-col gap-1 sm:flex sm:w-auto">
                        <label className="ml-1 mb-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                            Mi billetera
                        </label>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-9 w-full justify-between rounded-xl border bg-background/80 px-4 text-sm font-medium shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:w-48"
                                    disabled={walletsLoading || wallets.length === 0}
                                >
                                    <span className="truncate text-left">{walletButtonLabel}</span>
                                    {walletsLoading ? (
                                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                    ) : (
                                        <span className="text-muted-foreground">
                                            <ChevronDown className="size-4 text-muted-foreground" />
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48">
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
            </div>
        </header>
    )
}