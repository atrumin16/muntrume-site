/**
 * 🏁 Muntrume Motorsport · Cloudflare Worker (API de muntru.me)
 *
 * - Setup Vault: login con contraseña (PBKDF2-SHA256), sesiones firmadas HMAC (JWT_SECRET),
 *   enlaces de un solo uso para crear/restablecer contraseña, panel Race Control
 *   (aprobar / rechazar / reenviar invitación) y correos transaccionales vía Resend.
 * - Garage 61: proxy de solo lectura a la API oficial; devuelve únicamente datos reales.
 * - Formulario de contacto y asistente IA (Groq).
 *
 * Secretos (wrangler secret put): JWT_SECRET (obligatorio), RESEND_API_KEY, GROQ_API_KEY,
 * GARAGE61_API_TOKEN (opcional), ADMIN_ALERT_EMAIL/TO_EMAIL y RESEND_FROM_EMAIL (opcionales).
 * Nunca se guardan ni se registran contraseñas en claro.
 */

import {
  requestReceivedEmail,
  adminNewRequestEmail,
  approvedLinkEmail,
  approvedTempPasswordEmail,
  rejectedEmail,
  resetPasswordEmail,
  contactFormEmail,
} from "./emails.js";

const SITE = "https://muntru.me";
const ALLOWED_ORIGINS = [
  "https://muntru.me",
  "https://www.muntru.me",
  "https://atrumin16.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
];

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const INVITE_TTL_MS = 72 * 3600 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD = 10;
const PBKDF2_ITERATIONS = 100000; // máximo soportado por Workers
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;

// ───────────────────────────── utilidades ─────────────────────────────

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : SITE,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With, Authorization, X-G61-Token",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlFromBytes(bytes) {
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesFromB64url(str) {
  const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function sha256Hex(text) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(text))));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}
function clean(v, max) {
  return String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

/** Contraseña aleatoria criptográficamente segura (sin caracteres ambiguos). */
function generateTempPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    const buf = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of buf) {
      if (b < limit && out.length < length) out += alphabet[b % alphabet.length];
    }
  }
  return `MTM-${out.slice(0, 4)}-${out.slice(4, 9)}-${out.slice(9)}`;
}

// ───────────────────────────── contraseñas ─────────────────────────────

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${b64urlFromBytes(salt)}$${b64urlFromBytes(bits)}`;
}

/** Devuelve { ok, legacy }. legacy=true si la contraseña estaba guardada en claro (formato antiguo). */
async function verifyPassword(password, stored) {
  if (!stored || !password) return { ok: false, legacy: false };
  if (stored.startsWith("pbkdf2_sha256$")) {
    const [, iterStr, saltB64, hashB64] = stored.split("$");
    const iterations = Math.min(parseInt(iterStr, 10) || PBKDF2_ITERATIONS, PBKDF2_ITERATIONS);
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: bytesFromB64url(saltB64), iterations },
        key,
        256
      )
    );
    return { ok: timingSafeEqual(bits, bytesFromB64url(hashB64)), legacy: false };
  }
  // Formato heredado (texto plano): comparación en tiempo constante sobre los hashes.
  const a = enc.encode(await sha256Hex(password));
  const b = enc.encode(await sha256Hex(stored));
  return { ok: timingSafeEqual(a, b), legacy: true };
}

/** Huella corta del hash actual: invalida enlaces y sesiones antiguas al cambiar la contraseña. */
async function passwordFingerprint(storedHash) {
  return (await sha256Hex(`fp:${storedHash || "none"}`)).slice(0, 16);
}

// ───────────────────────────── tokens firmados ─────────────────────────────

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}
async function signToken(payload, secret) {
  const data = b64urlFromBytes(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data));
  return `${data}.${b64urlFromBytes(sig)}`;
}
async function verifyToken(token, secret, typ) {
  try {
    if (!token || typeof token !== "string" || token.length > 2048) return null;
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), bytesFromB64url(sig), enc.encode(data));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(bytesFromB64url(data)));
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (typ && payload.typ !== typ) return null;
    return payload;
  } catch {
    return null;
  }
}

// ───────────────────────────── correo (Resend) ─────────────────────────────

async function sendEmail(env, { to, subject, html, text, replyTo }) {
  if (!env.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY no configurada" };
  const payload = {
    from: env.RESEND_FROM_EMAIL || "Muntrume Motorsport <muntrume@trujillomingorance.com>",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };
  if (replyTo) payload.reply_to = replyTo;
  const post = (p) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  try {
    let res = await post(payload);
    let data = await res.json().catch(() => ({}));
    if (!res.ok && !env.RESEND_FROM_EMAIL) {
      // Dominio aún sin verificar en Resend: remitente de pruebas (solo entrega al titular de la cuenta Resend).
      console.warn("[email] remitente principal rechazado:", res.status, data?.name || "");
      res = await post({ ...payload, from: "Muntrume Motorsport <onboarding@resend.dev>" });
      data = await res.json().catch(() => ({}));
    }
    if (!res.ok) {
      console.error("[email] envío fallido:", res.status, data?.name || "", data?.message || "");
      return { ok: false, error: data?.message || `Resend HTTP ${res.status}` };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[email] excepción:", e?.message);
    return { ok: false, error: "No se pudo contactar con el proveedor de correo" };
  }
}

function adminAlertAddress(env) {
  return env.ADMIN_ALERT_EMAIL || env.TO_EMAIL || "alberto@trujillomingorance.com";
}

// ───────────────────────────── rate limit ligero ─────────────────────────────

/** Limita intentos por clave usando la Cache API del colo (best-effort, sin estado global). */
async function rateLimited(key, max, windowSec) {
  try {
    const cache = caches.default;
    const req = new Request(`https://ratelimit.muntrume.internal/${encodeURIComponent(key)}`);
    const hit = await cache.match(req);
    const count = hit ? parseInt(await hit.text(), 10) || 0 : 0;
    if (count >= max) return true;
    await cache.put(
      req,
      new Response(String(count + 1), { headers: { "Cache-Control": `max-age=${windowSec}` } })
    );
    return false;
  } catch {
    return false;
  }
}

// ───────────────────────────── helpers de sesión ─────────────────────────────

async function issueSession(env, user) {
  const now = Date.now();
  const token = await signToken(
    {
      typ: "session",
      sub: user.email,
      name: user.name,
      role: user.role || "driver",
      mcp: user.must_change_password ? 1 : 0,
      fp: await passwordFingerprint(user.password_hash),
      iat: now,
      exp: now + SESSION_TTL_MS,
    },
    env.JWT_SECRET
  );
  return {
    token,
    user: { email: user.email, name: user.name, role: user.role || "driver" },
    must_change_password: !!user.must_change_password,
  };
}

async function getUser(env, email) {
  return env.muntrume_vault
    .prepare(
      "SELECT id, email, name, role, status, password_hash, must_change_password, created_at FROM allowed_users WHERE lower(email) = ?"
    )
    .bind(normEmail(email))
    .first();
}

/**
 * Valida la sesión contra la base de datos (usuario activo y contraseña no cambiada desde que se emitió).
 * opts.allowPendingChange: permite sesiones que aún deben cambiar la contraseña.
 * opts.admin: exige rol admin.
 */
async function requireSession(request, body, env, opts = {}) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : String(body?.token || "");
  const payload = await verifyToken(token, env.JWT_SECRET, "session");
  if (!payload) return { error: "Sesión no válida o caducada. Vuelve a iniciar sesión.", status: 401 };
  const user = await getUser(env, payload.sub);
  if (!user || user.status !== "active")
    return { error: "Tu acceso al Vault no está activo.", status: 401 };
  if ((await passwordFingerprint(user.password_hash)) !== payload.fp)
    return { error: "Tu contraseña ha cambiado. Vuelve a iniciar sesión.", status: 401 };
  if (user.must_change_password && !opts.allowPendingChange)
    return { error: "Debes cambiar tu contraseña antes de continuar.", status: 403, code: "must_change_password" };
  if (opts.admin && user.role !== "admin") return { error: "Solo Race Control (admins).", status: 403 };
  return { user, payload };
}

async function makeSetPasswordLink(env, user, ttlMs, purpose) {
  const token = await signToken(
    {
      typ: "setpw",
      purpose,
      sub: user.email,
      fp: await passwordFingerprint(user.password_hash),
      exp: Date.now() + ttlMs,
    },
    env.JWT_SECRET
  );
  return `${SITE}/setups?setpw=${token}`;
}

// ───────────────────────────── handlers ─────────────────────────────

async function handleLogin(body, env, ip) {
  const email = normEmail(body.email);
  const password = String(body.password ?? body.key_code ?? "");
  if (!EMAIL_RE.test(email) || !password) return [400, { success: false, error: "Introduce tu correo y tu contraseña." }];
  if ((await rateLimited(`login:${ip}`, 20, 600)) || (await rateLimited(`login:${email}`, 8, 600)))
    return [429, { success: false, error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." }];

  const generic = [401, { success: false, error: "Correo o contraseña incorrectos." }];
  const user = await getUser(env, email);
  if (!user) {
    await hashPassword(password); // coste similar para no revelar si el correo existe
    return generic;
  }
  if (user.status !== "active") return [403, { success: false, error: "Tu acceso al Vault está desactivado. Contacta con Race Control." }];
  if (!user.password_hash) {
    return [401, { success: false, error: "Tu cuenta aún no tiene contraseña. Usa «¿Primer acceso u olvidaste tu contraseña?» para recibir un enlace.", code: "no_password" }];
  }
  const { ok, legacy } = await verifyPassword(password, user.password_hash);
  if (!ok) return generic;

  if (legacy) {
    // Migración transparente del formato antiguo (texto plano) a PBKDF2.
    user.password_hash = await hashPassword(password);
    await env.muntrume_vault
      .prepare("UPDATE allowed_users SET password_hash = ? WHERE id = ?")
      .bind(user.password_hash, user.id)
      .run();
  }
  return [200, { success: true, ...(await issueSession(env, user)) }];
}

async function handleChangePassword(request, body, env) {
  const s = await requireSession(request, body, env, { allowPendingChange: true });
  if (s.error) return [s.status, { success: false, error: s.error }];
  const pw = String(body.new_password || "");
  const err = passwordProblem(pw, s.user.email);
  if (err) return [400, { success: false, error: err }];
  const hash = await hashPassword(pw);
  await env.muntrume_vault
    .prepare("UPDATE allowed_users SET password_hash = ?, must_change_password = 0 WHERE id = ?")
    .bind(hash, s.user.id)
    .run();
  const user = { ...s.user, password_hash: hash, must_change_password: 0 };
  return [200, { success: true, message: "Contraseña actualizada.", ...(await issueSession(env, user)) }];
}

function passwordProblem(pw, email) {
  if (pw.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (pw.length > 128) return "La contraseña es demasiado larga (máx. 128).";
  if (pw.toLowerCase() === normEmail(email)) return "La contraseña no puede ser tu correo.";
  if (/^(.)\1+$/.test(pw)) return "Elige una contraseña menos predecible.";
  return null;
}

async function handleForgotPassword(body, env, ip) {
  const email = normEmail(body.email);
  const generic = [200, { success: true, message: "Si el correo pertenece a un piloto autorizado, recibirás un enlace en unos minutos." }];
  if (!EMAIL_RE.test(email)) return [400, { success: false, error: "Introduce un correo válido." }];
  if ((await rateLimited(`forgot:${ip}`, 10, 3600)) || (await rateLimited(`forgot:${email}`, 3, 900))) return generic;
  const user = await getUser(env, email);
  if (!user || user.status !== "active") return generic;
  const link = await makeSetPasswordLink(env, user, RESET_TTL_MS, "reset");
  const mail = resetPasswordEmail({ name: user.name, link, expiresMinutes: RESET_TTL_MS / 60000 });
  await sendEmail(env, { to: user.email, ...mail });
  return generic;
}

async function handleSetPassword(body, env) {
  const t = await verifyToken(String(body.token || ""), env.JWT_SECRET, "setpw");
  if (!t) return [400, { success: false, error: "El enlace no es válido o ha caducado. Solicita uno nuevo.", code: "invalid_link" }];
  const user = await getUser(env, t.sub);
  if (!user || user.status !== "active") return [400, { success: false, error: "El enlace ya no es válido.", code: "invalid_link" }];
  if ((await passwordFingerprint(user.password_hash)) !== t.fp)
    return [400, { success: false, error: "Este enlace ya se ha utilizado. Solicita uno nuevo si lo necesitas.", code: "invalid_link" }];
  if (body.check_only) return [200, { success: true, email: user.email, name: user.name, purpose: t.purpose }];
  const pw = String(body.new_password || "");
  const err = passwordProblem(pw, user.email);
  if (err) return [400, { success: false, error: err }];
  const hash = await hashPassword(pw);
  await env.muntrume_vault
    .prepare("UPDATE allowed_users SET password_hash = ?, must_change_password = 0 WHERE id = ?")
    .bind(hash, user.id)
    .run();
  return [200, { success: true, message: "Contraseña guardada.", ...(await issueSession(env, { ...user, password_hash: hash, must_change_password: 0 })) }];
}

async function handleRequestJoin(body, env, ip) {
  if (body.website) return [200, { success: true, message: "Solicitud registrada." }]; // honeypot
  const name = clean(body.name, 80);
  const email = normEmail(clean(body.email, 254));
  const iracing_id = clean(body.iracing_id, 20);
  const car_category = clean(body.car_category, 80);
  const message = clean(body.message, 1500);
  if (name.length < 2) return [400, { success: false, error: "Indica tu nombre de piloto." }];
  if (!EMAIL_RE.test(email)) return [400, { success: false, error: "Introduce un correo válido." }];
  if (iracing_id && !/^\d{1,10}$/.test(iracing_id)) return [400, { success: false, error: "El iRacing ID debe ser numérico (Customer ID)." }];
  if (await rateLimited(`join:${ip}`, 5, 3600)) return [429, { success: false, error: "Has enviado varias solicitudes seguidas. Inténtalo más tarde." }];

  const db = env.muntrume_vault;
  const member = await getUser(env, email);
  if (member && member.status === "active")
    return [409, { success: false, code: "already_member", error: "Este correo ya tiene acceso al Vault. Inicia sesión o usa «¿Olvidaste tu contraseña?»." }];
  const pending = await db.prepare("SELECT id FROM join_requests WHERE lower(email) = ? AND status = 'pending'").bind(email).first();
  if (pending)
    return [200, { success: true, duplicate: true, message: "Ya tenemos una solicitud pendiente con este correo. Te avisaremos en cuanto se revise." }];

  await db
    .prepare("INSERT INTO join_requests (name, email, iracing_id, car_category, message, status) VALUES (?, ?, ?, ?, ?, 'pending')")
    .bind(name, email, iracing_id || null, car_category || null, message || null)
    .run();

  const data = { name, email, iracing_id, car_category, message };
  const [, receipt] = await Promise.all([
    sendEmail(env, { to: adminAlertAddress(env), replyTo: email, ...adminNewRequestEmail(data) }),
    sendEmail(env, { to: email, ...requestReceivedEmail(data) }),
  ]);
  return [200, {
    success: true,
    email_sent: !!receipt?.ok,
    message: receipt?.ok
      ? "Solicitud registrada. Te hemos enviado un correo de confirmación; Control de Carrera la revisará."
      : "Solicitud registrada. Control de Carrera la revisará y te escribirá a este correo.",
  }];
}

async function handleAdminPanel(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error }];
  const db = env.muntrume_vault;
  const [reqs, members] = await Promise.all([
    db.prepare("SELECT id, name, email, iracing_id, car_category, message, status, created_at, approved_at FROM join_requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 300").all(),
    db.prepare("SELECT id, email, name, role, status, created_at, must_change_password, CASE WHEN password_hash IS NULL OR password_hash = '' THEN 0 ELSE 1 END AS has_password FROM allowed_users ORDER BY created_at DESC").all(),
  ]);
  return [200, { success: true, requests: reqs.results || [], members: members.results || [] }];
}

/** Crea o reactiva al piloto y genera credenciales según el método elegido. */
async function provisionPilot(env, { email, name, method }) {
  const db = env.muntrume_vault;
  let user = await getUser(env, email);
  let tempPassword = null;
  let hash = user?.password_hash || null;
  let mustChange = user?.must_change_password || 0;

  if (method === "temp_password") {
    tempPassword = generateTempPassword();
    hash = await hashPassword(tempPassword);
    mustChange = 1;
  }

  if (user) {
    await db
      .prepare("UPDATE allowed_users SET status = 'active', name = COALESCE(NULLIF(?, ''), name), password_hash = ?, must_change_password = ? WHERE id = ?")
      .bind(name, hash, mustChange, user.id)
      .run();
  } else {
    await db
      .prepare("INSERT INTO allowed_users (email, name, role, status, password_hash, must_change_password) VALUES (?, ?, 'driver', 'active', ?, ?)")
      .bind(email, name || email.split("@")[0], hash, mustChange)
      .run();
  }
  user = await getUser(env, email);

  let mail;
  let link = null;
  if (method === "temp_password") {
    mail = approvedTempPasswordEmail({ name: user.name, email: user.email, tempPassword });
  } else {
    link = await makeSetPasswordLink(env, user, INVITE_TTL_MS, "invite");
    mail = approvedLinkEmail({ name: user.name, email: user.email, link, expiresHours: INVITE_TTL_MS / 3600000 });
  }
  return { user, mail, link, tempPassword };
}

async function handleAdminApprove(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error }];
  const db = env.muntrume_vault;
  const method = body.method === "temp_password" ? "temp_password" : "link";
  const notify = body.send_email !== false;

  let email;
  let name;
  let requestId = null;
  if (body.request_id || body.id) {
    requestId = parseInt(body.request_id || body.id, 10);
    const jr = await db.prepare("SELECT id, name, email, status FROM join_requests WHERE id = ?").bind(requestId).first();
    if (!jr) return [404, { success: false, error: "Solicitud no encontrada." }];
    if (jr.status !== "pending") return [409, { success: false, error: `Esta solicitud ya está ${jr.status === "approved" ? "aprobada" : "rechazada"}.` }];
    email = normEmail(jr.email);
    name = clean(jr.name, 80);
  } else {
    email = normEmail(body.email);
    name = clean(body.name, 80);
    if (!EMAIL_RE.test(email)) return [400, { success: false, error: "Correo no válido." }];
    if (name.length < 2) return [400, { success: false, error: "Indica el nombre del piloto." }];
  }

  const existing = await getUser(env, email);
  if (existing && existing.status === "active" && existing.password_hash && method === "link" && !body.force) {
    if (requestId) {
      await db.prepare("UPDATE join_requests SET status = 'approved', approved_at = CURRENT_TIMESTAMP, assigned_password = NULL WHERE id = ?").bind(requestId).run();
    }
    return [200, { success: true, already_member: true, email_sent: false, message: "Este piloto ya tenía acceso con contraseña propia. Solicitud marcada como aprobada; no se ha cambiado nada." }];
  }

  const { user, mail, link, tempPassword } = await provisionPilot(env, { email, name, method });
  if (requestId) {
    await db.prepare("UPDATE join_requests SET status = 'approved', approved_at = CURRENT_TIMESTAMP, assigned_password = NULL WHERE id = ?").bind(requestId).run();
  }

  const sent = notify ? await sendEmail(env, { to: user.email, ...mail }) : { ok: false, error: "Envío desactivado por el admin" };
  return [200, {
    success: true,
    method,
    pilot: { email: user.email, name: user.name },
    email_sent: !!sent.ok,
    email_error: sent.ok ? null : sent.error,
    // Se muestran UNA sola vez al admin; no se guardan en claro en ningún sitio.
    set_password_link: link,
    temp_password: tempPassword,
    expires_hours: method === "link" ? INVITE_TTL_MS / 3600000 : null,
  }];
}

async function handleAdminReject(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error }];
  const db = env.muntrume_vault;
  const id = parseInt(body.request_id || body.id, 10);
  const jr = id ? await db.prepare("SELECT id, name, email, status FROM join_requests WHERE id = ?").bind(id).first() : null;
  if (!jr) return [404, { success: false, error: "Solicitud no encontrada." }];
  if (jr.status !== "pending") return [409, { success: false, error: "Solo se pueden rechazar solicitudes pendientes." }];
  await db.prepare("UPDATE join_requests SET status = 'rejected', assigned_password = NULL WHERE id = ?").bind(id).run();
  let sent = { ok: false, error: null };
  if (body.notify) {
    sent = await sendEmail(env, { to: jr.email, ...rejectedEmail({ name: jr.name, reason: clean(body.reason, 500) }) });
  }
  return [200, { success: true, email_sent: !!sent.ok, email_error: body.notify && !sent.ok ? sent.error : null }];
}

async function handleAdminResendInvite(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error }];
  const user = await getUser(env, body.email);
  if (!user || user.status !== "active") return [404, { success: false, error: "Piloto no encontrado o inactivo." }];
  const link = await makeSetPasswordLink(env, user, INVITE_TTL_MS, user.password_hash ? "reset" : "invite");
  const mail = approvedLinkEmail({ name: user.name, email: user.email, link, expiresHours: INVITE_TTL_MS / 3600000 });
  const sent = await sendEmail(env, { to: user.email, ...mail });
  return [200, { success: true, email_sent: !!sent.ok, email_error: sent.ok ? null : sent.error, set_password_link: link, expires_hours: INVITE_TTL_MS / 3600000 }];
}

async function handleAdminSetStatus(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error }];
  const email = normEmail(body.email);
  const status = body.status === "active" ? "active" : "inactive";
  if (email === normEmail(s.user.email)) return [400, { success: false, error: "No puedes desactivar tu propia cuenta." }];
  const r = await env.muntrume_vault.prepare("UPDATE allowed_users SET status = ? WHERE lower(email) = ?").bind(status, email).run();
  if (!r.meta?.changes) return [404, { success: false, error: "Piloto no encontrado." }];
  return [200, { success: true, status }];
}

/** Envía todas las plantillas SOLO al correo del admin que lo pide (para revisar el formato). */
async function handleAdminEmailPreview(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error }];
  const to = s.user.email;
  const demoLink = `${SITE}/setups?setpw=EJEMPLO-ENLACE-NO-VALIDO`;
  const sample = { name: s.user.name || "Piloto", email: to };
  const templates = [
    requestReceivedEmail(sample),
    adminNewRequestEmail({ ...sample, iracing_id: "", car_category: "", message: "(correo de prueba de formato)" }),
    approvedLinkEmail({ ...sample, link: demoLink, expiresHours: 72 }),
    approvedTempPasswordEmail({ ...sample, tempPassword: "MTM-EJEM-PLO00-NOVAL" }),
    rejectedEmail({ name: sample.name, reason: "" }),
    resetPasswordEmail({ name: sample.name, link: demoLink, expiresMinutes: 60 }),
  ];
  const results = [];
  for (const t of templates) {
    const r = await sendEmail(env, { to, ...t, subject: `[PRUEBA] ${t.subject}` });
    results.push({ subject: t.subject, ok: !!r.ok, error: r.ok ? null : r.error });
  }
  return [200, { success: true, to, results }];
}

// ───────────────────────────── Garage 61 ─────────────────────────────

const normAlnum = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

async function g61Get(path, token, params) {
  const u = new URL(`https://garage61.net/api/v1${path}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (Array.isArray(v)) v.forEach((x) => u.searchParams.append(k, String(x)));
    else if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "muntru.me" },
  });
  if (!res.ok) {
    const err = new Error(`G61 ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data.items || data.data || [];
}

async function handleG61Laps(request, body, env) {
  const s = await requireSession(request, body, env);
  if (s.error) return [s.status, { success: false, error: s.error }];

  const userToken = clean(request.headers.get("X-G61-Token") || body.g61_token, 300);
  const token = userToken || env.GARAGE61_API_TOKEN || "";
  if (!token) return [200, { success: true, status: "no_token", laps: [], message: "Garage 61 todavía no está conectado." }];

  const carLabel = clean(body.car_label, 120);
  const circuit = clean(body.circuit, 120);
  if (!carLabel || !circuit) return [400, { success: false, error: "Faltan coche o circuito." }];

  try {
    const [cars, tracks] = await Promise.all([g61Get("/cars", token), g61Get("/tracks", token)]);
    const carKey = normAlnum(carLabel);
    const car =
      cars.find((c) => normAlnum(c.name) === carKey) ||
      cars.find((c) => carKey.length >= 6 && (normAlnum(c.name).includes(carKey) || carKey.includes(normAlnum(c.name))));
    const trackKey = normAlnum(circuit);
    const trackMatches = trackKey.length >= 3 ? tracks.filter((t) => normAlnum(t.name).includes(trackKey)) : [];
    if (!car || trackMatches.length === 0) {
      return [200, { success: true, status: "no_match", laps: [], message: "No se ha encontrado este coche o circuito en Garage 61." }];
    }
    const trackIds = trackMatches.slice(0, 10).map((t) => t.id);
    const laps = await g61Get("/laps", token, { cars: [car.id], tracks: trackIds, group: "driver", lapTypes: 1, limit: 15 });
    const rows = laps
      .filter((l) => typeof l.lapTime === "number" && l.lapTime > 0)
      .sort((a, b) => a.lapTime - b.lapTime)
      .map((l) => ({
        driver: [l.driver?.firstName, l.driver?.lastName].filter(Boolean).join(" ") || l.driver?.slug || null,
        lap_time_sec: l.lapTime,
        start_time: l.startTime || null,
        clean: typeof l.clean === "boolean" ? l.clean : null,
        track: l.track?.name || null,
        track_temp: typeof l.trackTemp === "number" ? l.trackTemp : null,
        air_temp: typeof l.airTemp === "number" ? l.airTemp : null,
        session_type: l.sessionType ?? null,
        link: l.track?.id && l.car?.id ? `https://garage61.net/app/laps/${l.track.id}/${l.car.id}` : null,
      }));
    return [200, {
      success: true,
      status: rows.length ? "ok" : "empty",
      source: userToken ? "user_token" : "team_token",
      car: { id: car.id, name: car.name },
      tracks: trackMatches.slice(0, 10).map((t) => ({ id: t.id, name: t.name })),
      laps: rows,
      fetched_at: new Date().toISOString(),
    }];
  } catch (e) {
    const status = e.status === 401 || e.status === 403 ? "invalid_token" : "error";
    console.warn("[g61]", e.message);
    return [200, { success: false, status, laps: [], error: status === "invalid_token" ? "El token de Garage 61 no es válido o no tiene permisos." : "Garage 61 no responde ahora mismo." }];
  }
}

// ───────────────────────────── catálogo / descargas ─────────────────────────────

const STATIC_CARS = ["acuraarx06gtp","acuransxevo22gt3","amvalkyriegtp","amvantageevogt3","amvantagegt4","astonmartin dbr9","audi90gto","audir8lmsevo2gt3","audirs3lmsgen2","bmwlmdh","bmwm2csr","bmwm2g87","bmwm4evogt4","bmwm4gt3","bmwm4gt4","bmwm8gte","c6r","c8rvettegte","cadillacvseriesrgtp","caterham caterham420r","caterham caterhamacademy","chevyvettez06rgt3","dallaraf3","dallarair18","dallarap217","ferrari296gt3","ferrari488gte","ferrari499p","fordgt","fordgt2017","fordmustanggt3","fordmustanggt4","formulair04","formulavee","formulavee formulavee2","formulavee formulavee3","hondacivictyper","hpdarx01c","hyundaielantracn7","hyundaivelostern","lamborghinievogt3","ligierjsp320","mclaren570sgt4","mclaren720sgt3","mercedesamgevogt3","mercedesamggt4","mercedesw13","ministock","mx5 cup","mx5 mx52016","nissangtpzxt","porsche718gt4","porsche963gtp","porsche991rsr","porsche9922cup","porsche992rgt3","raygr22","renaultcliocup","specracer","stockcars2 mustang2019","supercars fordmustanggen3","superformulalights324","superformulasf23 honda","superformulasf23 toyota","toyotagr86","trucks silverado","trucks toyotatundra2022"];
const STATIC_SEASONS = ["26S4","26S3","26S2","26S1"];
const STATIC_WEEKS = ["Otros Circuitos","Special Event - Algarve 1000","Special Event - Britcar 24","Special Event - Le Mans 24","Special Event - Majors 24","Special Event - NEC","Special Event - Petit Le Mans","Special Event - Road America 6H","Special Event - Sebring 12","Special Event - Spa 24","Special Event - Watkins 6H","W01","W02","W03","W04","W05","W06","W07","W08","W09","W10","W11","W12","W13"];
const STATIC_CIRCUITS = ["Algarve","Barcelona","Bathurst","Canadian Tire","Charlotte","Daytona","Donington","Fuji","General","Hockenheim","Hungaroring","Imola","Indianapolis","Interlagos","Jerez","Knockhill","Laguna Seca","Le Mans","Lime Rock","Long Beach","Magny-Cours","Miami","Mid-Ohio","Misano","Montreal","Monza","Motegi","Mugello","Navarra","Nurburgring","Okayama","Oschersleben","Oulton Park","Phillip Island","Red Bull Ring","Road America","Road Atlanta","Rudskogen","Sebring","Silverstone","Snetterton","Sonoma","Spa","St. Petersburg","Suzuka","The Bend","Tsukuba","Virginia","Watkins Glen","Winton","Zandvoort"];

function setupFilters(body, cols) {
  const conds = [];
  const params = [];
  for (const [field, col] of cols) {
    const v = body[field];
    if (v && v !== "All") {
      conds.push(`${col} = ?`);
      params.push(String(v).slice(0, 120));
    }
  }
  return { where: conds.length ? ` WHERE ${conds.join(" AND ")}` : "", params };
}

async function handleCatalog(request, body, env) {
  const s = await requireSession(request, body, env);
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  const { where, params } = setupFilters(body, [["car", "car"], ["season", "season"], ["week", "week"], ["circuit", "circuit"], ["type", "setup_type"]]);
  const stmt = env.muntrume_vault.prepare(
    `SELECT id, car, season, week, circuit, filename, setup_type, size_bytes FROM setups${where} ORDER BY car, season DESC, week, circuit, filename LIMIT 1000`
  );
  const { results } = await (params.length ? stmt.bind(...params) : stmt).all();
  return [200, {
    success: true,
    user: { email: s.user.email, name: s.user.name, role: s.user.role },
    cars: STATIC_CARS, seasons: STATIC_SEASONS, weeks: STATIC_WEEKS, circuits: STATIC_CIRCUITS,
    setups: results || [],
  }];
}

async function handleDownload(request, body, env) {
  const s = await requireSession(request, body, env);
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  if (!body.id) return [400, { success: false, error: "ID de setup no especificado." }];
  const setup = await env.muntrume_vault
    .prepare("SELECT filename, car, season, week, circuit, content_base64 FROM setups WHERE id = ?")
    .bind(body.id)
    .first();
  if (!setup?.content_base64) return [404, { success: false, error: "Setup no encontrado en el vault." }];
  return [200, { success: true, ...setup }];
}

async function handleDownloadBatch(request, body, env) {
  const s = await requireSession(request, body, env);
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  const cols = "id, filename, car, season, week, circuit, setup_type, size_bytes, content_base64";
  let setups = [];
  if (Array.isArray(body.ids) && body.ids.length) {
    const ids = body.ids.slice(0, 100);
    const { results } = await env.muntrume_vault
      .prepare(`SELECT ${cols} FROM setups WHERE id IN (${ids.map(() => "?").join(",")})`)
      .bind(...ids)
      .all();
    setups = results || [];
  } else if (body.circuit || body.car) {
    const { where, params } = setupFilters(body, [["car", "car"], ["season", "season"], ["week", "week"], ["circuit", "circuit"]]);
    const { results } = await env.muntrume_vault
      .prepare(`SELECT ${cols} FROM setups${where} ORDER BY car, season DESC, week, circuit, filename LIMIT 100`)
      .bind(...params)
      .all();
    setups = results || [];
  }
  return [200, { success: true, count: setups.length, setups }];
}

// ───────────────────────────── IA y contacto ─────────────────────────────

async function handleAI(body, env, ip) {
  if (!env.GROQ_API_KEY) return [503, { error: "Asistente IA no disponible." }];
  if (await rateLimited(`ai:${ip}`, 30, 600)) return [429, { error: "Demasiadas preguntas seguidas. Espera un momento." }];
  const systemPrompt =
    body.mode === "ai_setup"
      ? "You are an expert iRacing telemetry race engineer for Muntrume Motorsport. Provide concise, expert setup advice."
      : "You are the official AI assistant of Muntrume Motorsport simracing team founded in Sant Andreu, Barcelona.";
  const userPrompt = String(body.prompt || body.message || body.question || "Hello").slice(0, 4000);
  let lastStatus = 502;
  for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.7,
        max_tokens: 600 + 512,
        reasoning_format: "hidden",
        reasoning_effort: "low",
      }),
    });
    if (!r.ok) {
      lastStatus = r.status;
      console.warn(`[ai] ${model} ${r.status}`);
      continue;
    }
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || "";
    if (reply) return [200, { answer: reply, result: reply }];
  }
  return [lastStatus >= 500 ? 502 : lastStatus, { error: "AI service unavailable" }];
}

async function handleContact(body, env, ip) {
  if (body.website) return [200, { success: true }];
  const name = clean(body.name, 100);
  const email = normEmail(clean(body.email, 254));
  const type = clean(body.type, 60);
  const subject = clean(body.subject, 150);
  const message = clean(body.message, 5000);
  if (!name || !email || !message) return [400, { success: false, error: "Faltan campos obligatorios (nombre, correo, mensaje)." }];
  if (!EMAIL_RE.test(email)) return [400, { success: false, error: "Formato de correo no válido." }];
  if (await rateLimited(`contact:${ip}`, 6, 3600)) return [429, { success: false, error: "Has enviado varios mensajes seguidos. Inténtalo más tarde." }];
  const to = env.TO_EMAIL || "alberto@trujillomingorance.com";
  const mailto = `mailto:${to}?subject=${encodeURIComponent(`[Muntrume] ${subject || "Consulta"}`)}&body=${encodeURIComponent(`De: ${name} (${email})\n\n${message}`)}`;
  const r = await sendEmail(env, { to, replyTo: email, ...contactFormEmail({ name, email, type, subject, message, to }) });
  if (!r.ok) return [502, { success: false, error: "No se pudo enviar el mensaje ahora mismo.", fallbackMailto: mailto }];
  return [200, { success: true, id: r.id, message: "Mensaje enviado. Te responderemos lo antes posible." }];
}

// ───────────────────────────── router ─────────────────────────────

const ROUTES = {
  "/api/setups/auth": "login",
  "/api/setups/change-password": "change_password",
  "/api/setups/password/forgot": "forgot",
  "/api/setups/password/set": "set_password",
  "/api/setups/request-join": "request_join",
  "/api/setups/catalog": "catalog",
  "/api/setups/download": "download",
  "/api/setups/download-batch": "download_batch",
  "/api/setups/g61-laps": "g61",
  "/api/setups/admin/panel": "admin_panel",
  "/api/setups/admin/approve": "admin_approve",
  "/api/setups/admin/reject": "admin_reject",
  "/api/setups/admin/resend-invite": "admin_resend",
  "/api/setups/admin/set-status": "admin_status",
  "/api/setups/admin/email-preview": "admin_email_preview",
};
const MODE_ALIASES = {
  setup_auth: "login",
  setup_change_password: "change_password",
  setup_request_join: "request_join",
  setup_catalog: "catalog",
  setup_download: "download",
  setup_download_batch: "download_batch",
  setup_g61_laps: "g61",
  setup_admin_panel: "admin_panel",
  setup_admin_approve: "admin_approve",
};
const NEEDS_DB = new Set(Object.values(ROUTES));

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);
    const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return reply(200, { status: "healthy", service: "Muntrume Worker Backend" });
    }
    if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return reply(403, { error: "Forbidden: Unauthorized origin" });

    let body;
    try {
      body = await request.json();
    } catch {
      return reply(400, { success: false, error: "JSON no válido." });
    }
    if (!body || typeof body !== "object") body = {};

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const route = ROUTES[url.pathname.replace(/\/+$/, "")] || MODE_ALIASES[body.mode];

    try {
      if (route && NEEDS_DB.has(route)) {
        if (!env.muntrume_vault) return reply(503, { success: false, error: "Base de datos no disponible." });
        if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
          console.error("[config] JWT_SECRET ausente o demasiado corto");
          return reply(503, { success: false, error: "El Vault está en mantenimiento. Inténtalo en unos minutos." });
        }
      }
      let out;
      switch (route) {
        case "login": out = await handleLogin(body, env, ip); break;
        case "change_password": out = await handleChangePassword(request, body, env); break;
        case "forgot": out = await handleForgotPassword(body, env, ip); break;
        case "set_password": out = await handleSetPassword(body, env); break;
        case "request_join": out = await handleRequestJoin(body, env, ip); break;
        case "catalog": out = await handleCatalog(request, body, env); break;
        case "download": out = await handleDownload(request, body, env); break;
        case "download_batch": out = await handleDownloadBatch(request, body, env); break;
        case "g61": out = await handleG61Laps(request, body, env); break;
        case "admin_panel": out = await handleAdminPanel(request, body, env); break;
        case "admin_approve": out = await handleAdminApprove(request, body, env); break;
        case "admin_reject": out = await handleAdminReject(request, body, env); break;
        case "admin_resend": out = await handleAdminResendInvite(request, body, env); break;
        case "admin_status": out = await handleAdminSetStatus(request, body, env); break;
        case "admin_email_preview": out = await handleAdminEmailPreview(request, body, env); break;
        default:
          if (url.pathname.startsWith("/api/setups/")) return reply(404, { success: false, error: "Ruta no encontrada." });
          if (["ai_chat", "ai_setup", "ask_about"].includes(body.mode)) out = await handleAI(body, env, ip);
          else out = await handleContact(body, env, ip);
      }
      return reply(out[0], out[1]);
    } catch (err) {
      console.error("[worker]", route || "contact", err?.message);
      return reply(500, { success: false, error: "Error interno del servidor. Inténtalo de nuevo." });
    }
  },
};

