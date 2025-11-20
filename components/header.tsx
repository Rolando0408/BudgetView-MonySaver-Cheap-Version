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

const walletOptions = [
    { label: "Billetera principal", value: "principal" },
    { label: "Ahorros", value: "ahorros" },
    { label: "Inversiones", value: "inversiones" },
    { label: "Efectivo", value: "efectivo" },
] as const

export type WalletType = (typeof walletOptions)[number]["value"]

type TransactionBalanceRow = {
    monto: number | string | null
    tipo: "ingreso" | "gasto" | null
}

type HeaderProps = {
    className?: string
    appName?: string
    tagline?: string
    currentBalance?: number
    currency?: string
    selectedWallet?: WalletType
    onWalletChange?: (wallet: WalletType) => void
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

    const [walletType, setWalletType] = React.useState<WalletType>(selectedWallet ?? walletOptions[0].value)
    const [balance, setBalance] = React.useState<number>(currentBalance)
    const [balanceLoading, setBalanceLoading] = React.useState(true)
    const [balanceError, setBalanceError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!selectedWallet) return
        setWalletType(selectedWallet)
    }, [selectedWallet])

    React.useEffect(() => {
        let active = true

        const fetchBalance = async () => {
            setBalanceLoading(true)
            setBalanceError(null)
            try {
                const { data, error } = await supabase
                    .from("transacciones")
                    .select("monto,tipo")

                if (!active) return

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

                setBalance(totalIncome - totalExpense)
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

        fetchBalance()

        return () => {
            active = false
        }
    }, [])

    const handleWalletChange = (value: string) => {
        const newWalletType = value as WalletType
        setWalletType(newWalletType)
        onWalletChange?.(newWalletType)
    }

    const selectedWalletLabel = walletOptions.find(w => w.value === walletType)?.label

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
                    ) : (
                        <p className="text-2xl font-semibold tracking-tight">{formatCurrency(balance, currency)}</p>
                    )}
                    {balanceError && !balanceLoading && (
                        <p className="mt-1 text-xs font-medium text-destructive">{balanceError}</p>
                    )}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Mi billetera
                    </label>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="h-11 min-w-[220px] justify-between rounded-xl border bg-background/80 px-4 text-sm font-medium shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                            >
                                {selectedWalletLabel}
                                <span className="text-muted-foreground"><ChevronDown className="size-4 text-muted-foreground" /></span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            <DropdownMenuRadioGroup
                                value={walletType}
                                onValueChange={handleWalletChange}
                            >
                                {walletOptions.map((option) => (
                                    <DropdownMenuRadioItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>

                </div>
            </div>
        </header>
    )
}