import { config } from "../config.js";

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function ollamaConfigured(): boolean {
  return Boolean(config.ollamaUrl);
}

export function ollamaDefaultModel(): string {
  return config.ollamaModel;
}

type ChatResult =
  | { ok: true; content: string; model: string }
  | { ok: false; error: string; status?: number };

export async function ollamaChat(
  messages: OllamaChatMessage[],
  model?: string,
): Promise<ChatResult> {
  const base = config.ollamaUrl?.replace(/\/$/, "");
  if (!base) {
    return { ok: false, error: "Ollama δεν είναι ρυθμισμένο (OLLAMA_URL)" };
  }
  const useModel = (model?.trim() || config.ollamaModel).trim();
  if (!useModel) {
    return { ok: false, error: "Λείπει OLLAMA_MODEL" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.ollamaTimeoutMs);
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: useModel,
        messages,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 240) || `Ollama HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      message?: { content?: string };
      model?: string;
    };
    const content = data.message?.content?.trim() ?? "";
    if (!content) {
      return { ok: false, error: "Κενή απάντηση από Ollama" };
    }
    return { ok: true, content, model: data.model ?? useModel };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Timeout — το μοντέλο άργησε πολύ" };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ollama request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function ollamaListModels(): Promise<
  { ok: true; models: { name: string; size?: number }[] } | { ok: false; error: string }
> {
  const base = config.ollamaUrl?.replace(/\/$/, "");
  if (!base) {
    return { ok: false, error: "Ollama δεν είναι ρυθμισμένο" };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.min(config.ollamaTimeoutMs, 15_000));
  try {
    const res = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    if (!res.ok) {
      return { ok: false, error: `Ollama HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      models?: { name?: string; size?: number }[];
    };
    return {
      ok: true,
      models: (data.models ?? [])
        .filter((m) => m.name)
        .map((m) => ({ name: m.name!, size: m.size })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ollama tags failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function ollamaPing(): Promise<boolean> {
  const base = config.ollamaUrl?.replace(/\/$/, "");
  if (!base) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
