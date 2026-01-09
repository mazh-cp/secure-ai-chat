"use client";
import { useEffect, useState } from "react";

const KEY = "theme";

export default function ThemeToggleButton() {
  // Initialize from data-theme attribute (set by ThemeScript) to avoid hydration mismatch
  const [theme, setTheme] = useState<"day" | "dark">(() => {
    if (typeof window !== "undefined") {
      const dataTheme = document.documentElement.getAttribute("data-theme");
      if (dataTheme === "day" || dataTheme === "dark") {
        return dataTheme;
      }
      // Fallback to localStorage if data-theme not set
      const stored = (localStorage.getItem(KEY) as "day" | "dark" | null) ?? "dark";
      return stored;
    }
    return "dark"; // SSR fallback
  });

  useEffect(() => {
    // Sync with data-theme attribute (set by ThemeScript)
    const dataTheme = document.documentElement.getAttribute("data-theme");
    if (dataTheme === "day" || dataTheme === "dark") {
      setTheme(dataTheme);
    } else {
      const stored = (localStorage.getItem(KEY) as "day" | "dark" | null) ?? "dark";
      setTheme(stored);
    }
  }, []);

  const toggle = () => {
    // Bulletproof toggle: always do all 3 operations in order
    const next = theme === "dark" ? "day" : "dark";
    localStorage.setItem(KEY, next); // 1. Persist to storage
    document.documentElement.setAttribute("data-theme", next); // 2. Apply to DOM
    document.documentElement.style.colorScheme = next === "dark" ? "dark" : "light"; // 3. Force repaint
    setTheme(next); // 4. Update React state
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        color: "var(--text)",
        boxShadow: "var(--card-shadow)",
      }}
      aria-label="Toggle Day/Night mode"
      title="Toggle Day/Night mode"
    >
      <span style={{ color: "var(--text-muted)" }}>
        {theme === "dark" ? "Night" : "Day"}
      </span>
    </button>
  );
}
