export type ApiResponse = {
  ok: boolean;
  analysis?: string;
  metrics?: any;
  error?: string;
  status?: number;
};

export async function runAnalysis(payload: any): Promise<ApiResponse> {
  try {
    const url = process.env.NEXT_PUBLIC_LAMBDA_URL as string;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e?.message || "Request failed" };
  }
}