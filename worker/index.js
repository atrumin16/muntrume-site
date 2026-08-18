/**
 * 🏁 Muntrume Motorsport - Secure Edge Worker Backend
 * Stores ALL configuration & keys securely in Cloudflare
 * Features Origin Lockdown, Anti-Abuse Protection, and Resend API Dispatch
 */

// List of authorized domains that can invoke this worker
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With, X-Muntrume-Token",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff"
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = getCorsHeaders(origin);

    // 1. Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 2. Only allow POST requests for dispatch
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: corsHeaders
      });
    }

    // 3. Validate origin to prevent unauthorized external websites from hijacking the worker
    if (origin && !ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
      return new Response(JSON.stringify({ error: "Forbidden: Unauthorized origin" }), {
        status: 403,
        headers: corsHeaders
      });
    }

    try {
      const body = await request.json();
      const { name, email, type, subject, message, website } = body;

      // 4. Anti-spam honeypot
      if (website) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // 5. Basic input validation
      if (!name || !email || !message) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required fields" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid email address" }),
          { status: 400, headers: corsHeaders }
        );
      }

      // 6. Read Secret Variables stored exclusively inside Cloudflare Worker
      const resendApiKey = env.RESEND_API_KEY;
      const targetEmail = env.TO_EMAIL || "info@muntru.me";
      const fromEmail = env.RESEND_FROM_EMAIL || "Muntrume Motorsport <onboarding@resend.dev>";

      if (!resendApiKey) {
        console.error("[CRITICAL] RESEND_API_KEY is not configured in Cloudflare Worker Secrets.");
        return new Response(
          JSON.stringify({
            success: false,
            error: "Service temporarily unavailable",
            fallbackMailto: `mailto:${targetEmail}?subject=${encodeURIComponent(`[${type || 'Contact'}] ${subject || 'New Message'}`)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)}`
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      // 7. Format email payload for Resend API
      const emailPayload = {
        from: fromEmail,
        to: [targetEmail],
        reply_to: email,
        subject: `🏁 [Muntrume - ${type || 'Inquiry'}] ${subject || 'New message from ' + name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 24px; }
              .container { max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; }
              .header { background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 24px; text-align: center; color: #ffffff; }
              .content { padding: 24px; }
              .field-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #22c55e; margin-bottom: 4px; }
              .field-value { font-size: 15px; color: #f1f5f9; margin-bottom: 16px; }
              .message-box { background-color: #090d16; border-left: 4px solid #22c55e; border-radius: 6px; padding: 16px; margin: 16px 0; color: #e2e8f0; line-height: 1.6; white-space: pre-wrap; }
              .footer { padding: 16px 24px; background-color: #090d16; border-top: 1px solid #1e293b; font-size: 12px; color: #94a3b8; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 22px; font-weight: 800;">🏁 Muntrume Motorsport</h1>
                <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Nuevo mensaje recibido en ${targetEmail}</p>
              </div>
              <div class="content">
                <div class="field-label">Remitente</div>
                <div class="field-value"><strong>${name}</strong> &lt;<a href="mailto:${email}" style="color: #22c55e;">${email}</a>&gt;</div>

                <div class="field-label">Tipo de Solicitud</div>
                <div class="field-value"><span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; padding: 3px 8px; border-radius: 4px; font-weight: 600;">${type || 'General'}</span></div>

                <div class="field-label">Asunto</div>
                <div class="field-value">${subject || 'Sin asunto'}</div>

                <div class="field-label">Mensaje</div>
                <div class="message-box">${message}</div>
              </div>
              <div class="footer">
                Muntrume Motorsport · Simracing Team · Sant Andreu, Barcelona 🇪🇸
              </div>
            </div>
          </body>
          </html>
        `
      };

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(emailPayload)
      });

      const resData = await resendRes.json();

      if (!resendRes.ok) {
        console.error("[RESEND ERROR]", resData);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Delivery failed",
            fallbackMailto: `mailto:${targetEmail}?subject=${encodeURIComponent(`[${type || 'Contact'}] ${subject || 'New Message'}`)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)}`
          }),
          { status: 502, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Message sent successfully to ${targetEmail}`
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
