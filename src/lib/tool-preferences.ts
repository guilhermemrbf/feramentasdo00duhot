import { useEffect, useState } from "react";
import { cleanPreferences, type ToolPreferences } from "./tool-catalog";
const KEY = "00duhot.tools.v1";
const EVENT = "00duhot:tools";
const EMPTY: ToolPreferences = { favorites: [], recent: [] };
function read() {
  try {
    return cleanPreferences(JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    return EMPTY;
  }
}
function write(next: ToolPreferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Preferences remain optional when storage is blocked. */
  }
  window.dispatchEvent(new Event(EVENT));
  return next;
}
export function recordTool(id: string) {
  const data = read();
  write(cleanPreferences({ ...data, recent: [id, ...data.recent.filter((item) => item !== id)] }));
}
export function useToolPreferences() {
  const [preferences, setPreferences] = useState<ToolPreferences>(EMPTY);
  useEffect(() => {
    const refresh = () => setPreferences(read());
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const toggle = (id: string) => {
    const data = preferences;
    setPreferences(
      write(
        cleanPreferences({
          ...data,
          favorites: data.favorites.includes(id)
            ? data.favorites.filter((item) => item !== id)
            : [...data.favorites, id],
        }),
      ),
    );
  };
  return { ...preferences, toggle };
}
