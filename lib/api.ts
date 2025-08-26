// lib/api.ts
export type ApiResponse = {
  ok: boolean;
  analysis?: string;
  metrics?: any;
  error?: string;
  status?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;

export async function runAnalysis(payload: any): Promise<ApiResponse> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch("/api/get-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error:
          text?.trim() ||
          `API returned non-JSON response (status ${res.status}).`,
        status: res.status,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: data?.error || data?.message || `API error (status ${res.status}).`,
        status: res.status,
      };
    }

    if (typeof data?.ok === "boolean") return data as ApiResponse;
    return { ok: true, analysis: data?.analysis, metrics: data?.metrics };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.name === "AbortError" ? "Request timed out" : e?.message || "Request failed",
      status: 0,
    };
  } finally {
    clearTimeout(t);
  }
}