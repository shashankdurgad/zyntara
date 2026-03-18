"use client";

import { useEffect } from "react";

/**
 * One-time migration: copy treeminspls_* localStorage keys to zyntara_*
 * for users who had the app before rebrand.
 */
export function StorageMigration() {
  useEffect(() => {
    const keys = ["treeminspls_github", "treeminspls_screenshots", "treeminspls_critiques"];
    for (const oldKey of keys) {
      const newKey = oldKey.replace("treeminspls_", "zyntara_");
      const oldVal = localStorage.getItem(oldKey);
      const newVal = localStorage.getItem(newKey);
      if (oldVal && !newVal) {
        localStorage.setItem(newKey, oldVal);
        localStorage.removeItem(oldKey);
      }
    }
  }, []);
  return null;
}
