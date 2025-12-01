"use client"

import * as React from "react"
import { Tooltip } from "recharts"
import type { TooltipProps as RechartsTooltipProps } from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<
    string,
    {
        label?: string
        color?: string
    }
>

const ChartContext = React.createContext<ChartConfig | null>(null)

export type ChartContainerProps = React.HTMLAttributes<HTMLDivElement> & {
    config: ChartConfig
}

export function ChartContainer({ config, className, children, style, ...props }: ChartContainerProps) {
    const cssVariables = React.useMemo(() => {
        const variables: React.CSSProperties = {}
        for (const [key, value] of Object.entries(config)) {
            if (value?.color) {
                ; (variables as Record<string, string>)[`--color-${key}`] = value.color
            }
        }
        return variables
    }, [config])

    return (
        <div
            className={cn("flex w-full items-center justify-center", className)}
            style={{ ...style, ...cssVariables }}
            {...props}
        >
            <ChartContext.Provider value={config}>{children}</ChartContext.Provider>
        </div>
    )
}

export function ChartTooltip(props: RechartsTooltipProps<number, string>) {
    return <Tooltip {...props} wrapperStyle={{ outline: "none" }} />
}

type ChartTooltipPayload = {
    name?: string | number
    value?: number | string
    dataKey?: string | number
    color?: string
}

export type ChartTooltipContentProps = {
    active?: boolean
    payload?: ChartTooltipPayload[]
    label?: string | number
    hideLabel?: boolean
    valueFormatter?: (value: number | string | undefined) => React.ReactNode
}

export function ChartTooltipContent(props: ChartTooltipContentProps) {
    const { active, payload, label, hideLabel, valueFormatter } = props
    const config = React.useContext(ChartContext)

    if (!active || !payload?.length) {
        return null
    }

    const title = !hideLabel ? config?.[label as string]?.label ?? label : null

    return (
        <div className="min-w-[160px] rounded-lg border bg-background/95 p-3 text-sm shadow-md">
            {title && <p className="mb-2 font-semibold text-foreground">{title}</p>}
            <div className="space-y-1">
                {payload.map((item) => {
                    const key = String(item.name ?? item.dataKey)
                    const color = item.color ?? config?.[key]?.color
                    const mappedLabel = config?.[key]?.label ?? key
                    return (
                        <div key={`${key}-${item.dataKey}`} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="size-2 rounded-full" style={{ backgroundColor: color ?? "currentColor" }} />
                                <span className="font-medium text-foreground/90">{mappedLabel}</span>
                            </div>
                            <span className="tabular-nums text-muted-foreground">
                                {valueFormatter ? valueFormatter(item.value) : item.value}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
