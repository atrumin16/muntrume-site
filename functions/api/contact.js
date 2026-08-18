/**
 * Serverless Contact API for Muntrume Motorsport (Cloudflare Pages / Workers)
 * Dispatches verified contact inquiries to info@muntru.me via Resend API
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  try {
    const body = await request.json();
    const { name, email, type, subject, message, website } = body;

    // Honeypot anti-spam check
    if (website) {
      return new Response(JSON.stringify({ success: true, note: "Filtered" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // Required fields validation
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields (name, email, message)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email format" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Retrieve Resend API Key from Environment variable
    const resendKey = env.RESEND_API_KEY || (typeof process !== "undefined" && process.env?.RESEND_API_KEY);

    if (!resendKey) {
      console.warn("RESEND_API_KEY is not configured in Cloudflare environment variables.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Resend API key not configured on server",
          fallbackMailto: `mailto:info@muntru.me?subject=${encodeURIComponent(`[${type || 'Contact'}] ${subject || 'New Message'}`)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)}`
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Construct email payload for Resend API
    const emailPayload = {
      from: env.RESEND_FROM_EMAIL || "Muntrume Motorsport <onboarding@resend.dev>",
      to: ["info@muntru.me"],
      reply_to: email,
      subject: `🏁 [Muntrume - ${type || 'Inquiry'}] ${subject || 'New message from ' + name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
            .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            .header { background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 24px; text-align: center; color: #ffffff; }
            .content { padding: 24px; }
            .field-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #22c55e; margin-bottom: 4px; }
            .field-value { font-size: 15px; color: #f1f5f9; margin-bottom: 16px; word-break: break-word; }
            .message-box { background-color: #0f172a; border-left: 4px solid #22c55e; border-radius: 6px; padding: 16px; margin: 16px 0; color: #e2e8f0; line-height: 1.6; white-space: pre-wrap; font-size: 14px; }
            .footer { padding: 16px 24px; background-color: #0f172a; border-top: 1px solid #334155; font-size: 12px; color: #94a3b8; text-align: center; }
            .btn { display: inline-block; background-color: #16a34a; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">🏁 Muntrume Motorsport</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Nuevo mensaje recibido en info@muntru.me</p>
            </div>
            <div class="content">
              <div class="field-label">Remitente</div>
              <div class="field-value"><strong>${name}</strong> &lt;<a href="mailto:${email}" style="color: #22c55e; text-decoration: none;">${email}</a>&gt;</div>

              <div class="field-label">Tipo de Solicitud</div>
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
              <a href="https://muntru.me" style="color: #22c55e; text-decoration: none;">muntru.me</a>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emailPayload)
    });

    const resData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend API returned error:", resData);
      return new Response(
        JSON.stringify({
          success: false,
          error: resData.message || "Resend API error",
          fallbackMailto: `mailto:info@muntru.me?subject=${encodeURIComponent(`[${type || 'Contact'}] ${subject || 'New Message'}`)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)}`
        }),
        { status: resendRes.status, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: resData.id,
        message: "Email sent successfully to info@muntru.me!"
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error("Internal Server Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
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
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
