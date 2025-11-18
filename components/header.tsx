"use client";

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Wallet2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const walletOptions = [
    { label: "Billetera principal", value: "principal" },
    { label: "Ahorros", value: "ahorros" },
    { label: "Inversiones", value: "inversiones" },
    { label: "Efectivo", value: "efectivo" },
] as const

export type WalletType = (typeof walletOptions)[number]["value"]

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

    React.useEffect(() => {
        if (!selectedWallet) return
        setWalletType(selectedWallet)
    }, [selectedWallet])

    const handleWalletChange = (value: string) => {
        const newWalletType = value as WalletType
        setWalletType(newWalletType)
        onWalletChange?.(newWalletType)
    }

    const selectedWalletLabel = walletOptions.find(w => w.value === walletType)?.label

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 flex w-full flex-col gap-4 border bg-card/80 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/60 md:flex-row md:items-center md:justify-between",
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
                <div className="rounded-2xl border bg-background/60 px-6 py-4 text-center shadow-xs">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Saldo actual</p>
                    <p className="text-3xl font-semibold tracking-tight">{formatCurrency(currentBalance, currency)}</p>
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