// app/api/get-report/route.ts
export const runtime = "nodejs"; // ensure Node runtime (not edge), so fetch supports all defaults

export async function POST(req: Request) {
  const url = (process.env.LAMBDA_URL || "").trim();
  if (!url) {
    return Response.json(
      { ok: false, error: "Missing LAMBDA_URL on server." },
      { status: 500 }
    );
  }

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    // Try JSON first; if not JSON, pass back raw text
    try {
      const data = JSON.parse(text);
      return Response.json(data, { status: res.status });
    } catch {
      return new Response(text, {
        status: res.status,
        headers: { "Content-Type": "text/plain" },
      });
    }
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Upstream request failed" },
      { status: 502 }
    );
  }
}

// Optional: Handle preflight if you’ll ever call this route cross-origin
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
