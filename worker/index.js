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

async function signToken(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret || "mtm-racing-super-secret-vault-2026"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = JSON.stringify(payload);
  const dataB64 = Buffer.from(data, "utf-8").toString("base64");
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataB64));
  const sigB64 = Buffer.from(signature).toString("base64");
  return `${dataB64}.${sigB64}`;
}

async function verifyToken(token, secret) {
  try {
    if (!token || !token.includes('.')) return null;
    const [dataB64, sigB64] = token.split('.');
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret || "mtm-racing-super-secret-vault-2026"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Buffer.from(sigB64, "base64");
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(dataB64));
    if (!isValid) return null;
    const payload = JSON.parse(Buffer.from(dataB64, "base64").toString("utf-8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
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
      // 0) SETUP VAULT AUTH & API (Private Garage 61 Team Flow)
      // =========================================================================
      if (body.mode === 'setup_auth' || url.pathname === '/api/setups/auth') {
        const email = (body.email || '').trim().toLowerCase();
        const rawKey = (body.key_code || body.code || body.password || '').trim();
        const keyCode = rawKey.toUpperCase();

        if (!email || !rawKey) {
          return new Response(JSON.stringify({ success: false, error: "Introduce un correo válido y la clave de acceso del equipo." }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const adminEmails = ["admin@muntru.me", "alberto@trujillomingorance.com", "atrumin16@gmail.com"];
        const adminPasswords = ["MTM-Admin2026!Vault", "MTM-ADMIN-2026", env.ADMIN_PASSWORD].filter(Boolean);

        const isAdminPass = adminPasswords.includes(rawKey) || adminPasswords.map(p => p.toUpperCase()).includes(keyCode);
        const isAdminEmail = adminEmails.includes(email);

        // Security check: If trying to log in with an admin email, MUST provide the admin password!
        if (isAdminEmail && !isAdminPass) {
          return new Response(JSON.stringify({ success: false, error: "Contraseña de Administrador requerida para esta cuenta." }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const validStaticKeys = ["MTM-2026", "MTM-TEAM", "GARAGE61-MTM", "MUNTRUME26"];
        let isAuthorized = validStaticKeys.includes(keyCode) || isAdminPass;
        let userRole = (isAdminPass && isAdminEmail) ? 'admin' : 'driver';
        let userName = email.split('@')[0];

        // Check D1 database if bound
        if (env.muntrume_vault) {
          try {
            // Check team keys
            const keyRecord = await env.muntrume_vault
              .prepare("SELECT key_code, is_active FROM team_keys WHERE (UPPER(key_code) = ? OR key_code = ?) AND is_active = 1")
              .bind(keyCode, rawKey)
              .first();
            if (keyRecord) isAuthorized = true;

            // Check if user is in allowed_users
            const userRecord = await env.muntrume_vault
              .prepare("SELECT email, name, role, status FROM allowed_users WHERE LOWER(email) = ?")
              .bind(email)
              .first();

            if (userRecord) {
              if (userRecord.status === 'suspended') {
                return new Response(JSON.stringify({ success: false, error: "Tu cuenta ha sido suspendida. Contacta con Control de Carrera." }), {
                  status: 403,
                  headers: corsHeaders
                });
              }
              if (userRecord.role === 'admin') {
                if (isAdminPass) {
                  userRole = 'admin';
                } else {
                  return new Response(JSON.stringify({ success: false, error: "Esta cuenta requiere la contraseña de Administrador." }), {
                    status: 401,
                    headers: corsHeaders
                  });
                }
              } else {
                userRole = userRecord.role || 'driver';
              }
              userName = userRecord.name || userName;
              isAuthorized = true;
            } else if (isAuthorized) {
              // Valid invite code provided for new user: auto-register in allowed_users
              await env.muntrume_vault
                .prepare("INSERT OR IGNORE INTO allowed_users (email, name, role) VALUES (?, ?, ?)")
                .bind(email, userName, userRole)
                .run();
            }
          } catch (dbErr) {
            console.error("[D1 AUTH ERROR]", dbErr);
          }
        }

        if (!isAuthorized) {
          return new Response(JSON.stringify({ success: false, error: "Clave de equipo o correo no autorizado. Si eres piloto nuevo, solicita unirte." }), {
            status: 401,
            headers: corsHeaders
          });
        }

        // Generate HMAC signature token (valid 7 days)
        const tokenPayload = {
          email,
          name: userName,
          role: userRole,
          exp: Date.now() + 7 * 86400 * 1000
        };
        const token = await signToken(tokenPayload, env.JWT_SECRET || "muntrume-motorsport-vault-secret-2026");

        return new Response(JSON.stringify({
          success: true,
          token,
          user: { email, name: userName, role: userRole }
        }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Solicitud de acceso (Request to Join estilo Garage 61)
      if (body.mode === 'setup_request_join' || url.pathname === '/api/setups/request-join') {
        const { name, email, iracing_id, car_category, message } = body;
        if (!name || !email) {
          return new Response(JSON.stringify({ success: false, error: "Nombre y correo son obligatorios." }), {
            status: 400,
            headers: corsHeaders
          });
        }

        if (env.muntrume_vault) {
          try {
            await env.muntrume_vault
              .prepare("INSERT INTO join_requests (name, email, iracing_id, car_category, message) VALUES (?, ?, ?, ?, ?)")
              .bind(name, email, iracing_id || '', car_category || '', message || '')
              .run();
          } catch (dbErr) {
            console.error("[D1 REQUEST JOIN ERROR]", dbErr);
          }
        }

        // Send email alert to Alberto if Resend configured
        if (env.RESEND_API_KEY) {
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                from: env.RESEND_FROM_EMAIL || "Muntrume Motorsport <muntrume@trujillomingorance.com>",
                to: [env.TO_EMAIL || "alberto@trujillomingorance.com"],
                subject: `🏎️ [Setup Vault] Nueva Solicitud de Piloto: ${name}`,
                html: `
                  <h3>Nueva solicitud para unirse al Setup Vault</h3>
                  <p><strong>Piloto:</strong> ${name}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>iRacing ID:</strong> ${iracing_id || 'N/A'}</p>
                  <p><strong>Coche/Categoría:</strong> ${car_category || 'N/A'}</p>
                  <p><strong>Mensaje:</strong> ${message || 'Sin mensaje'}</p>
                `
              })
            });
          } catch (e) {
            console.warn("Could not send email alert for join request:", e);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          message: "Solicitud registrada correctamente. Control de Carrera revisará tus datos para aprobarte."
        }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Catálogo de Setups
      if (body.mode === 'setup_catalog' || url.pathname === '/api/setups/catalog') {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "") || body.token;
        const session = await verifyToken(token, env.JWT_SECRET || "muntrume-motorsport-vault-secret-2026");

        if (!session) {
          return new Response(JSON.stringify({ success: false, error: "Sesión no válida o expirada. Inicia sesión de nuevo." }), {
            status: 401,
            headers: corsHeaders
          });
        }

        let setups = [];
        let availableCars = [];
        let availableSeasons = [];
        let availableWeeks = [];
        let availableCircuits = [];

        if (env.muntrume_vault) {
          try {
            // Get available cars, seasons, weeks, circuits
            const [carsRes, seasonsRes, weeksRes, circuitsRes] = await Promise.all([
              env.muntrume_vault.prepare("SELECT DISTINCT car FROM setups ORDER BY car").all(),
              env.muntrume_vault.prepare("SELECT DISTINCT season FROM setups ORDER BY season DESC").all(),
              env.muntrume_vault.prepare("SELECT DISTINCT week FROM setups ORDER BY week").all(),
              env.muntrume_vault.prepare("SELECT DISTINCT circuit FROM setups ORDER BY circuit").all()
            ]);

            availableCars = (carsRes.results || []).map(r => r.car);
            availableSeasons = (seasonsRes.results || []).map(r => r.season);
            availableWeeks = (weeksRes.results || []).map(r => r.week);
            availableCircuits = (circuitsRes.results || []).map(r => r.circuit);

            let query = "SELECT id, car, season, week, circuit, filename, setup_type, size_bytes FROM setups";
            const params = [];
            const conditions = [];

            if (body.car) {
              conditions.push("car = ?");
              params.push(body.car);
            }
            if (body.season) {
              conditions.push("season = ?");
              params.push(body.season);
            }
            if (body.week) {
              conditions.push("week = ?");
              params.push(body.week);
            }
            if (body.circuit) {
              conditions.push("circuit = ?");
              params.push(body.circuit);
            }
            if (body.type && body.type !== 'All') {
              conditions.push("setup_type = ?");
              params.push(body.type);
            }

            if (conditions.length > 0) {
              query += " WHERE " + conditions.join(" AND ");
            }
            query += " ORDER BY car, season DESC, week, circuit, filename LIMIT 1000";

            const stmt = env.muntrume_vault.prepare(query);
            const { results } = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
            setups = results || [];
          } catch (dbErr) {
            console.error("[D1 CATALOG ERROR]", dbErr);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          user: session,
          cars: availableCars,
          seasons: availableSeasons,
          weeks: availableWeeks,
          circuits: availableCircuits,
          setups
        }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Descarga de Setup (.sto)
      if (body.mode === 'setup_download' || url.pathname === '/api/setups/download') {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "") || body.token;
        const session = await verifyToken(token, env.JWT_SECRET || "muntrume-motorsport-vault-secret-2026");

        if (!session) {
          return new Response(JSON.stringify({ success: false, error: "No autorizado." }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const setupId = body.id;
        if (!setupId) {
          return new Response(JSON.stringify({ success: false, error: "ID de setup no especificado." }), {
            status: 400,
            headers: corsHeaders
          });
        }

        if (env.muntrume_vault) {
          const setup = await env.muntrume_vault
            .prepare("SELECT filename, car, season, week, circuit, content_base64 FROM setups WHERE id = ?")
            .bind(setupId)
            .first();

          if (setup && setup.content_base64) {
            return new Response(JSON.stringify({
              success: true,
              filename: setup.filename,
              car: setup.car,
              season: setup.season,
              week: setup.week,
              circuit: setup.circuit,
              content_base64: setup.content_base64
            }), {
              status: 200,
              headers: corsHeaders
            });
          }
        }

        return new Response(JSON.stringify({ success: false, error: "Setup no encontrado en el vault." }), {
          status: 404,
          headers: corsHeaders
        });
      }

      // Admin: Ver pilotos y solicitudes de ingreso
      if (body.mode === 'setup_admin_panel' || url.pathname === '/api/setups/admin/panel') {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "") || body.token;
        const session = await verifyToken(token, env.JWT_SECRET || "muntrume-motorsport-vault-secret-2026");

        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ success: false, error: "Acceso denegado: Se requiere rol de Administrador." }), {
            status: 403,
            headers: corsHeaders
          });
        }

        let requests = [];
        let members = [];
        if (env.muntrume_vault) {
          try {
            const reqRes = await env.muntrume_vault
              .prepare("SELECT id, name, email, iracing_id, car_category, message, status, created_at FROM join_requests ORDER BY created_at DESC LIMIT 50")
              .all();
            requests = reqRes.results || [];

            const memRes = await env.muntrume_vault
              .prepare("SELECT id, name, email, role, status, created_at FROM allowed_users ORDER BY role DESC, created_at DESC LIMIT 50")
              .all();
            members = memRes.results || [];
          } catch (e) {
            console.error("[D1 ADMIN PANEL ERROR]", e);
          }
        }

        return new Response(JSON.stringify({ success: true, requests, members }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Admin: Aprobar o dar de alta piloto
      if (body.mode === 'setup_admin_approve' || url.pathname === '/api/setups/admin/approve') {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "") || body.token;
        const session = await verifyToken(token, env.JWT_SECRET || "muntrume-motorsport-vault-secret-2026");

        if (!session || session.role !== 'admin') {
          return new Response(JSON.stringify({ success: false, error: "Acceso denegado." }), {
            status: 403,
            headers: corsHeaders
          });
        }

        const { request_id, email, name, role } = body;
        if (!email) {
          return new Response(JSON.stringify({ success: false, error: "Correo electrónico requerido." }), {
            status: 400,
            headers: corsHeaders
          });
        }

        if (env.muntrume_vault) {
          try {
            await env.muntrume_vault
              .prepare("INSERT OR REPLACE INTO allowed_users (email, name, role, status) VALUES (?, ?, ?, 'active')")
              .bind(email.toLowerCase().trim(), name || email.split('@')[0], role || 'driver')
              .run();

            if (request_id) {
              await env.muntrume_vault
                .prepare("UPDATE join_requests SET status = 'approved' WHERE id = ?")
                .bind(request_id)
                .run();
            }
          } catch (e) {
            console.error("[D1 ADMIN APPROVE ERROR]", e);
          }
        }

        return new Response(JSON.stringify({ success: true, message: `Piloto ${email} dado de alta correctamente.` }), {
          status: 200,
          headers: corsHeaders
        });
      }

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

        // Solo modelos disponibles para la clave de Groq (llama-3.3-70b-versatile ya no lo está).
        // gpt-oss-20b es suficiente y barato; si falla, se prueba gpt-oss-120b.
        const userPrompt = String(body.prompt || body.message || body.question || "Hello").slice(0, 4000);
        let reply = "";
        let lastStatus = 502;
        for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]) {
          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              temperature: 0.7,
              // el razonamiento oculto también consume max_tokens
              max_tokens: 600 + 512,
              reasoning_format: "hidden",
              reasoning_effort: "low"
            })
          });
          if (!groqRes.ok) {
            lastStatus = groqRes.status;
            console.warn(`Groq ${model} failed: ${groqRes.status}`);
            continue;
          }
          const groqData = await groqRes.json();
          reply = groqData.choices?.[0]?.message?.content || "";
          if (reply) break;
        }
        if (!reply) {
          return new Response(JSON.stringify({ error: "AI service unavailable" }), {
            status: lastStatus >= 500 ? 502 : lastStatus,
            headers: corsHeaders
          });
        }
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
        JSON.stringify({ success: false, error: err.message || "Internal server error" }),
        { status: 500, headers: corsHeaders }
      );
    }
  }
};
