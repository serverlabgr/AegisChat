import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

const PREFIX = "aegis:v1:";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — state stays in memory
  }
}

/** useState that survives reloads via localStorage. */
export function usePersisted<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => load(key, initial));
  useEffect(() => save(key, state), [key, state]);
  return [state, setState];
}
