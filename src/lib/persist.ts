import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { Message } from "../data/mock";

const PREFIX = "aegis:v1:";
const MESSAGE_CAP = 200;

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function capMessageMap(
  value: Record<string, Message[]>,
): Record<string, Message[]> {
  const out: Record<string, Message[]> = {};
  for (const [id, list] of Object.entries(value)) {
    out[id] = list.length > MESSAGE_CAP ? list.slice(-MESSAGE_CAP) : list;
  }
  return out;
}

export function save<T>(key: string, value: T): void {
  try {
    let toStore: unknown = value;
    if (key === "messages" || key === "dm-messages") {
      toStore = capMessageMap(value as Record<string, Message[]>);
    }
    localStorage.setItem(PREFIX + key, JSON.stringify(toStore));
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
