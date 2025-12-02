import * as React from "react"

export type ExchangeRate = {
  currency: string
  rate: number
}

const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(currency: string, locale = "es-VE") {
  const key = `${locale}-${currency}`
  if (!formatterCache.has(key)) {
    formatterCache.set(
      key,
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      })
    )
  }
  return formatterCache.get(key)!
}

export function formatCurrency(value: number, currency: string, locale?: string) {
  if (!Number.isFinite(value)) {
    return "—"
  }
  return getFormatter(currency, locale).format(value)
}

export function formatUsd(value: number) {
  return formatCurrency(value, "USD")
}

export function formatVes(value: number) {
  return formatCurrency(value, "VES")
}

export async function fetchBcvRate(signal?: AbortSignal): Promise<ExchangeRate | null> {
  if (typeof fetch === "undefined") {
    return null
  }

  try {
    const response = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", {
      signal,
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`BCV API responded with ${response.status}`)
    }

    const data = await response.json()
    const average = typeof data?.promedio === "number" ? data.promedio : Number(data?.promedio)
    if (!average || Number.isNaN(average)) {
      return null
    }

    return { currency: "VES", rate: average }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return null
    }

    console.error("Error fetching BCV rate", error)
    return null
  }
}

type UseBcvRateOptions = {
  refreshInterval?: number
}

type UseBcvRateResult = {
  rate: number | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useBcvRate(options?: UseBcvRateOptions): UseBcvRateResult {
  const { refreshInterval } = options ?? {}
  const [rate, setRate] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const mountedRef = React.useRef(true)

  const loadRate = React.useCallback(async () => {
    setLoading(true)
    const result = await fetchBcvRate()
    if (!mountedRef.current) {
      return
    }
    if (!result) {
      setRate(null)
      setError("No pudimos obtener la tasa BCV.")
    } else {
      setRate(result.rate)
      setError(null)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    mountedRef.current = true
    loadRate()
    return () => {
      mountedRef.current = false
    }
  }, [loadRate])

  React.useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) {
      return
    }

    const id = window.setInterval(() => {
      loadRate()
    }, refreshInterval)

    return () => {
      window.clearInterval(id)
    }
  }, [refreshInterval, loadRate])

  const refresh = React.useCallback(() => {
    loadRate()
  }, [loadRate])

  return { rate, loading, error, refresh }
}
