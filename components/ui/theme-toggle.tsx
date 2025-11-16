"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

// Simple toggle: adds/removes 'dark' class on <html> and stores preference.
export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = React.useState(false);
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    // Avoid running twice.
    if (mountedRef.current) return;
    mountedRef.current = true;
    const root = document.documentElement;
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      root.classList.add("dark");
      setIsDark(true);
      return;
    }
    if (stored === "light") {
      root.classList.remove("dark");
      setIsDark(false);
      return;
    }
    // No stored preference: use media query.
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      root.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggleTheme}
      className={className}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="ml-2 text-xs font-medium">
        {isDark ? "Claro" : "Oscuro"}
      </span>
    </Button>
  );
}
