"use client"

import { useEffect } from "react"

type NextPortal = HTMLElement & { shadowRoot?: ShadowRoot | null }

const selectors = [
  "#nextjs-devtools-root",
  "[data-nextjs-devtools]",
  "[aria-label=\"Next.js Developer Tools\"]",
  "[aria-label=\"Open Next.js developer tools\"]",
]

function removeNode(node: Element) {
  if (node && typeof node.remove === "function") {
    node.remove()
  }
}

function removeDevToolsPortals(root: ParentNode) {
  root.querySelectorAll("nextjs-portal").forEach((portal) => {
    const element = portal as NextPortal
    const label = element.getAttribute("aria-label")?.toLowerCase() ?? ""
    const shadowContainsDevTools = Boolean(
      element.shadowRoot?.querySelector("[data-nextjs-devtools]") ||
        element.shadowRoot?.querySelector("button[aria-label*='next.js']")
    )
    if (label.includes("dev") || shadowContainsDevTools) {
      removeNode(element)
    }
  })
  selectors.forEach((selector) => {
    root.querySelectorAll(selector).forEach((node) => {
      removeNode(node)
    })
  })
}

export function HideNextDevtools() {
  useEffect(() => {
    const run = () => removeDevToolsPortals(document)
    run()
    const observer = new MutationObserver(run)
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })
    return () => observer.disconnect()
  }, [])

  return null
}
