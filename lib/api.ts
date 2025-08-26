export type ApiResponse = {
  ok: boolean;
  analysis?: string;
  metrics?: any;
  error?: string;
  status?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * POST payload to the Lambda URL from NEXT_PUBLIC_LAMBDA_URL.
 * Returns a normalized ApiResponse even on network/errors.
 */
export async function runAnalysis(payload: any): Promise<ApiResponse> {
  const url = (process.env.NEXT_PUBLIC_LAMBDA_URL || "").trim();

  if (!url) {
    return {
      ok: false,
      error:
        "Missing NEXT_PUBLIC_LAMBDA_URL. Set it in your environment (Vercel → Project → Settings → Environment Variables).",
      status: 0,
    };
  }

  // Timeout guard so the UI doesn't hang forever
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });

    // Try to parse JSON; on failure, surface raw text
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error:
          text?.trim() ||
          `Lambda returned non-JSON response (status ${res.status}).`,
        status: res.status,
      };
    }

    // If Lambda responded with a non-2xx, normalize to { ok:false, ... }
    if (!res.ok) {
      return {
        ok: false,
        error:
          data?.error ||
          data?.message ||
          `Lambda error (status ${res.status}).`,
        status: res.status,
      };
    }

    // Trust Lambda if it already returns { ok: true/false, ... }
    if (typeof data?.ok === "boolean") {
      return data as ApiResponse;
    }

    // Otherwise wrap it
    return { ok: true, analysis: data?.analysis, metrics: data?.metrics };
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return {
      ok: false,
      error: isAbort ? "Request timed out" : e?.message || "Request failed",
      status: 0,
    };
  } finally {
    clearTimeout(t);
  }
}
