"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type FloatingAlertStackProps = React.PropsWithChildren<{
  position?: "top-right" | "top-center" | "bottom-right"
  className?: string
}>

const POSITION_CLASSES: Record<NonNullable<FloatingAlertStackProps["position"]>, string> = {
  "top-right": "top-4 right-4 items-end",
  "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
  "bottom-right": "bottom-4 right-4 items-end",
}

type AlertElement = React.ReactElement<{ className?: string }>

export function FloatingAlertStack({ position = "top-right", className, children }: FloatingAlertStackProps) {
  const alerts = React.useMemo(() => {
    return React.Children.toArray(children).filter((child): child is AlertElement =>
      React.isValidElement(child)
    )
  }, [children])

  if (alerts.length === 0) {
    return null
  }

  const positionClass = POSITION_CLASSES[position] ?? POSITION_CLASSES["top-right"]

  return (
    <div className={cn("pointer-events-none fixed z-50 flex max-w-md flex-col gap-3", positionClass, className)}>
      {alerts.map((child, index) =>
        React.cloneElement(child, {
          className: cn("pointer-events-auto shadow-lg", child.props.className),
          key: child.key ?? index,
        })
      )}
    </div>
  )
}
