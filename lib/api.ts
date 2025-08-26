// lib/api.ts
export type ApiResponse = {
  ok: boolean;
  analysis?: string;
  metrics?: any;
  error?: string;
  status?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;

<<<<<<< HEAD
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
=======
export async function runAnalysis(payload: any): Promise<ApiResponse> {
>>>>>>> 4bdcb6a (feat(api): add server proxy for Lambda and robust client)
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);

  try {
<<<<<<< HEAD
    const res = await fetch(url, {
=======
    const res = await fetch("/api/get-report", {
>>>>>>> 4bdcb6a (feat(api): add server proxy for Lambda and robust client)
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });

<<<<<<< HEAD
    // Try to parse JSON; on failure, surface raw text
=======
>>>>>>> 4bdcb6a (feat(api): add server proxy for Lambda and robust client)
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error:
          text?.trim() ||
<<<<<<< HEAD
          `Lambda returned non-JSON response (status ${res.status}).`,
=======
          `API returned non-JSON response (status ${res.status}).`,
>>>>>>> 4bdcb6a (feat(api): add server proxy for Lambda and robust client)
        status: res.status,
      };
    }

<<<<<<< HEAD
    // If Lambda responded with a non-2xx, normalize to { ok:false, ... }
    if (!res.ok) {
      return {
        ok: false,
        error:
          data?.error ||
          data?.message ||
          `Lambda error (status ${res.status}).`,
=======
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error || data?.message || `API error (status ${res.status}).`,
>>>>>>> 4bdcb6a (feat(api): add server proxy for Lambda and robust client)
        status: res.status,
      };
    }

<<<<<<< HEAD
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
=======
    if (typeof data?.ok === "boolean") return data as ApiResponse;
    return { ok: true, analysis: data?.analysis, metrics: data?.metrics };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.name === "AbortError" ? "Request timed out" : e?.message || "Request failed",
>>>>>>> 4bdcb6a (feat(api): add server proxy for Lambda and robust client)
      status: 0,
    };
  } finally {
    clearTimeout(t);
  }
}
