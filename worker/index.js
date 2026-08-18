/**
 * 🏁 Muntrume Motorsport - Secure Cloudflare Worker Backend
 * Sender: muntrume@trujillomingorance.com (with auto-fallback to onboarding@resend.dev)
 * Recipient: alberto@trujillomingorance.com
 * Handles Contact Form Dispatch + Optional Groq AI Serverless Inference
 */

const ALLOWED_ORIGINS = [
  "https://muntru.me",
  "https://www.muntru.me",
  "https://atrumin16.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5500"
];

function getCorsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : "https://muntru.me";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With, Authorization",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff"
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = getCorsHeaders(origin);

    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 2. Health check
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return new Response(JSON.stringify({ status: "healthy", service: "Muntrume Worker Backend" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: corsHeaders
      });
    }

    // 3. Origin verification (allows empty origin for curl/testing or matching domains)
    if (origin && !ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
      return new Response(JSON.stringify({ error: "Forbidden: Unauthorized origin" }), {
        status: 403,
        headers: corsHeaders
      });
    }

    try {
      const body = await request.json();

      // =========================================================================
      // A) GROQ AI HANDLER (con tu GROQ_API_KEY)
      // =========================================================================
      if (body.mode === 'ai_chat' || body.mode === 'ai_setup' || body.mode === 'ask_about') {
        const groqApiKey = env.GROQ_API_KEY;
        if (!groqApiKey) {
          return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured" }), {
            status: 500,
            headers: corsHeaders
          });
        }

        const systemPrompt = body.mode === 'ai_setup' 
          ? "You are an expert iRacing telemetry race engineer for Muntrume Motorsport. Provide concise, expert setup advice."
          : "You are the official AI assistant of Muntrume Motorsport simracing team founded in Sant Andreu, Barcelona.";

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: body.prompt || body.message || body.question || "Hello" }
            ],
            temperature: 0.7,
            max_tokens: 600
          })
        });

        const groqData = await groqRes.json();
        const reply = groqData.choices?.[0]?.message?.content || "No response generated";
        return new Response(JSON.stringify({ answer: reply, result: reply }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // =========================================================================
      // B) FORMULARIO DE CONTACTO -> Resend hacia alberto@trujillomingorance.com
      // =========================================================================
      const { name, email, type, subject, message, website } = body;

      // Anti-spam honeypot
      if (website) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: corsHeaders
        });
      }

      if (!name || !email || !message) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required fields (name, email, message)" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid email format" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const resendApiKey = env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.error("[CRITICAL] RESEND_API_KEY secret is missing in Worker");
        return new Response(
          JSON.stringify({
            success: false,
            error: "Email delivery unconfigured in Worker secrets",
            fallbackMailto: `mailto:alberto@trujillomingorance.com?subject=${encodeURIComponent(`[Muntrume] ${subject || 'Consulta'}`)}&body=${encodeURIComponent(`De: ${name} (${email})\n\n${message}`)}`
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      const targetEmail = env.TO_EMAIL || "alberto@trujillomingorance.com";
      const primaryFromEmail = env.RESEND_FROM_EMAIL || "Muntrume Motorsport <muntrume@trujillomingorance.com>";

      const emailPayload = {
        from: primaryFromEmail,
        to: [targetEmail],
        reply_to: email,
        subject: `🏁 [Muntrume - ${type || 'Inquiry'}] ${subject || 'Nuevo mensaje de ' + name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 24px; }
              .container { max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
              .header { background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 24px; text-align: center; color: #ffffff; }
              .content { padding: 24px; }
              .field-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #22c55e; margin-bottom: 4px; }
              .field-value { font-size: 15px; color: #f1f5f9; margin-bottom: 16px; word-break: break-word; }
              .message-box { background-color: #090d16; border-left: 4px solid #22c55e; border-radius: 6px; padding: 16px; margin: 16px 0; color: #e2e8f0; line-height: 1.6; white-space: pre-wrap; font-size: 14px; }
              .footer { padding: 16px 24px; background-color: #090d16; border-top: 1px solid #1e293b; font-size: 12px; color: #94a3b8; text-align: center; }
              .btn { display: inline-block; background-color: #16a34a; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 22px; font-weight: 800;">🏁 Muntrume Motorsport</h1>
                <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Nuevo mensaje recibido en la web muntru.me</p>
              </div>
              <div class="content">
                <div class="field-label">Remitente</div>
                <div class="field-value"><strong>${name}</strong> &lt;<a href="mailto:${email}" style="color: #22c55e; text-decoration: none;">${email}</a>&gt;</div>

                <div class="field-label">Categoría / Tipo</div>
                <div class="field-value"><span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; padding: 3px 8px; border-radius: 4px; font-weight: 600;">${type || 'General'}</span></div>

                <div class="field-label">Asunto</div>
                <div class="field-value">${subject || 'Sin asunto'}</div>

                <div class="field-label">Mensaje</div>
                <div class="message-box">${message}</div>

                <div style="text-align: center; margin-top: 20px;">
                  <a href="mailto:${email}?subject=${encodeURIComponent(`Re: [Muntrume] ${subject || 'Tu consulta'}`)}" class="btn">Responder a ${name}</a>
                </div>
              </div>
              <div class="footer">
                Muntrume Motorsport · Simracing Team · Sant Andreu, Barcelona 🇪🇸<br>
                Enviado a ${targetEmail}
              </div>
            </div>
          </body>
          </html>
        `
      };

      // Attempt 1: Send with configured custom domain
      let resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(emailPayload)
      });

      let resData = await resendRes.json();

      // Attempt 2: If domain is not verified yet in Resend, automatically fallback to onboarding@resend.dev
      if (!resendRes.ok) {
        console.warn("[RESEND WARNING] Attempt 1 failed:", resData);
        emailPayload.from = "Muntrume Motorsport <onboarding@resend.dev>";
        resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(emailPayload)
        });
        resData = await resendRes.json();
      }

      if (!resendRes.ok) {
        console.error("[RESEND ERROR] Final delivery failed:", resData);
        return new Response(
          JSON.stringify({
            success: false,
            error: resData.message || "Delivery failed",
            fallbackMailto: `mailto:${targetEmail}?subject=${encodeURIComponent(`[${type || 'Contact'}] ${subject || 'New Message'}`)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)}`
          }),
          { status: 502, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          id: resData.id,
          message: "Email sent successfully to " + targetEmail
        }),
        { status: 200, headers: corsHeaders }
      );

    } catch (err) {
      console.error("[WORKER ERROR]", err);
      return new Response(
        JSON.stringify({ success: false, error: "Internal server error" }),
        { status: 500, headers: corsHeaders }
      );
    }
  }
};
