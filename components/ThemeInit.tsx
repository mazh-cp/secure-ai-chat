"use client";
import { useEffect } from "react";

const KEY = "theme";

export default function ThemeInit() {
  useEffect(() => {
    // Sync component: only sync state, never override ThemeScript
    // Read exactly what's stored, apply exactly as stored
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "day" || stored === "dark") {
        // Only sync if different from current (avoid unnecessary updates)
        const current = document.documentElement.getAttribute("data-theme");
        if (current !== stored) {
          document.documentElement.setAttribute("data-theme", stored);
          document.documentElement.style.colorScheme = stored === "dark" ? "dark" : "light";
        }
      } else {
        // If empty/invalid, default to dark and store it
        const defaultTheme = "dark";
        localStorage.setItem(KEY, defaultTheme);
        document.documentElement.setAttribute("data-theme", defaultTheme);
        document.documentElement.style.colorScheme = "dark";
      }
    } catch (e) {
      // Fallback: ensure theme is set even if localStorage fails
      const current = document.documentElement.getAttribute("data-theme");
      if (!current || (current !== "day" && current !== "dark")) {
        document.documentElement.setAttribute("data-theme", "dark");
        document.documentElement.style.colorScheme = "dark";
      }
    }
  }, []);
  return null;
}
