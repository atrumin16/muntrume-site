/**
 * Secure Serverless Proxy for AI & Telemetry Services
 * Runs on Cloudflare Pages Edge (Zero exposure to browser)
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
  };

  try {
    const workerUrl = env.BACKEND_WORKER_URL;
    const workerSecret = env.WORKER_AUTH_SECRET;

    // If backend worker URL is not configured, return fallback note
    if (!workerUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          fallback: true,
          message: "Local processing active" 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const body = await request.json();

    const headers = { "Content-Type": "application/json" };
    if (workerSecret) {
      headers["Authorization"] = `Bearer ${workerSecret}`;
    }

    const workerRes = await fetch(workerUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    const data = await workerRes.json();
    return new Response(JSON.stringify(data), {
      status: workerRes.status,
      headers: corsHeaders
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, fallback: true }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
