/**
 * Muntrume Motorsport · plantillas de correo transaccional (HTML responsive + texto plano).
 * Todas las variables se escapan antes de insertarse en el HTML.
 */

const SITE = "https://muntru.me";
const LOGO = `${SITE}/assets/img/logo.png`;

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(name) {
  const n = String(name || "").trim();
  return n ? n.split(/\s+/)[0] : "piloto";
}

/**
 * Layout base: tabla centrada de 560px, fondo claro para máxima compatibilidad
 * (Gmail, Outlook, Apple Mail, modo oscuro), cabecera con los colores del equipo.
 */
function layout({ preheader, title, bodyHtml, cta, footerNote }) {
  const ctaHtml = cta
    ? `<tr><td align="center" style="padding:8px 32px 28px 32px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
          <td align="center" bgcolor="#10b981" style="border-radius:10px;">
            <a href="${escapeHtml(cta.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#052e1c;text-decoration:none;border-radius:10px;">${escapeHtml(cta.label)}</a>
          </td></tr></table>
        ${cta.hint ? `<p style="margin:14px 0 0 0;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#64748b;">${cta.hint}</p>` : ""}
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<style>
  @media only screen and (max-width:600px){
    .container{width:100% !important;}
    .px{padding-left:20px !important;padding-right:20px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#eef2f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef2f5">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" class="container" width="560" cellspacing="0" cellpadding="0" border="0" style="width:560px;max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dfe5eb;">
    <tr><td bgcolor="#0b0e14" style="padding:22px 32px;" class="px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
        <td width="44" valign="middle"><img src="${LOGO}" width="36" height="48" alt="Muntrume" style="display:block;border:0;"></td>
        <td valign="middle" style="font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;">
          <div style="font-size:16px;font-weight:800;letter-spacing:0.5px;color:#ffffff;">MUNTRUME MOTORSPORT</div>
          <div style="font-size:12px;color:#34d399;font-weight:600;">Setup Vault · muntru.me</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="height:4px;line-height:4px;font-size:0;background-color:#10b981;">&nbsp;</td></tr>
    <tr><td class="px" style="padding:30px 32px 8px 32px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
      <h1 style="margin:0 0 14px 0;font-size:21px;line-height:28px;font-weight:800;color:#0f172a;">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </td></tr>
    ${ctaHtml}
    <tr><td class="px" style="padding:18px 32px 24px 32px;border-top:1px solid #eef2f5;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#64748b;">
      ${footerNote ? `<p style="margin:0 0 8px 0;">${footerNote}</p>` : ""}
      <p style="margin:0;">Muntrume Motorsport · Simracing team · Sant Andreu, Barcelona<br>
      <a href="${SITE}" style="color:#059669;text-decoration:none;">muntru.me</a></p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

const P = (html) => `<p style="margin:0 0 14px 0;font-size:15px;line-height:23px;color:#334155;">${html}</p>`;

function infoBox(rows) {
  const tr = rows
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `<tr>
      <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;width:140px;vertical-align:top;">${escapeHtml(k)}</td>
      <td style="padding:6px 0;font-size:14px;color:#0f172a;vertical-align:top;word-break:break-word;">${escapeHtml(v)}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f6f8fa;border:1px solid #e5eaef;border-radius:12px;margin:4px 0 18px 0;"><tr><td style="padding:12px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${tr}</table></td></tr></table>`;
}

const textFooter = `\n--\nMuntrume Motorsport · Simracing team · Sant Andreu, Barcelona\n${SITE}\n`;

/** 1) Confirmación al piloto: solicitud recibida */
export function requestReceivedEmail({ name }) {
  const subject = "Hemos recibido tu solicitud · Muntrume Setup Vault";
  const html = layout({
    preheader: "Control de Carrera revisará tu solicitud y te avisaremos por correo.",
    title: "Solicitud recibida",
    bodyHtml:
      P(`Hola ${escapeHtml(firstName(name))},`) +
      P("Gracias por querer unirte al Setup Vault de Muntrume Motorsport. Hemos recibido tu solicitud y Control de Carrera la revisará personalmente.") +
      P("Te escribiremos a este correo en cuanto haya una decisión. Si se aprueba, recibirás un enlace seguro para crear tu contraseña; nunca te pediremos que nos la envíes."),
    footerNote: "Si no has enviado esta solicitud, puedes ignorar este correo.",
  });
  const text = `Hola ${firstName(name)},

Gracias por querer unirte al Setup Vault de Muntrume Motorsport. Hemos recibido tu solicitud y Control de Carrera la revisará personalmente.

Te escribiremos a este correo en cuanto haya una decisión. Si se aprueba, recibirás un enlace seguro para crear tu contraseña; nunca te pediremos que nos la envíes.

Si no has enviado esta solicitud, puedes ignorar este correo.${textFooter}`;
  return { subject, html, text };
}

/** 2) Aviso interno a Control de Carrera: nueva solicitud */
export function adminNewRequestEmail({ name, email, iracing_id, car_category, message }) {
  const subject = `Nueva solicitud de piloto: ${String(name).slice(0, 60)}`;
  const html = layout({
    preheader: `${name} (${email}) ha solicitado acceso al Setup Vault.`,
    title: "Nueva solicitud de acceso",
    bodyHtml:
      P("Un piloto ha solicitado acceso al Setup Vault:") +
      infoBox([
        ["Piloto", name],
        ["Correo", email],
        ["iRacing ID", iracing_id || "—"],
        ["Categoría", car_category || "—"],
        ["Mensaje", message || "—"],
      ]) +
      P("Revísala en el panel de Race Control para aprobarla o rechazarla."),
    cta: { url: `${SITE}/setups#admin`, label: "Abrir Race Control" },
  });
  const text = `Nueva solicitud de acceso al Setup Vault

Piloto: ${name}
Correo: ${email}
iRacing ID: ${iracing_id || "—"}
Categoría: ${car_category || "—"}
Mensaje: ${message || "—"}

Revísala en Race Control: ${SITE}/setups#admin${textFooter}`;
  return { subject, html, text };
}

/** 3a) Aprobado · con enlace para crear contraseña (método recomendado) */
export function approvedLinkEmail({ name, email, link, expiresHours }) {
  const subject = "Acceso aprobado · Crea tu contraseña del Setup Vault";
  const html = layout({
    preheader: `Tu acceso está aprobado. El enlace caduca en ${expiresHours} horas.`,
    title: "¡Bienvenido al equipo!",
    bodyHtml:
      P(`Hola ${escapeHtml(firstName(name))},`) +
      P("Control de Carrera ha aprobado tu solicitud. Ya tienes acceso al Setup Vault de Muntrume Motorsport.") +
      infoBox([["Usuario", email], ["Acceso", `${SITE}/setups`]]) +
      P("Para entrar, crea tu contraseña personal con el botón de abajo:"),
    cta: {
      url: link,
      label: "Crear mi contraseña",
      hint: `El enlace es personal, de un solo uso y caduca en ${expiresHours} horas. Si caduca, usa «¿Olvidaste tu contraseña?» en ${SITE}/setups.`,
    },
    footerNote: "Consejo: una vez dentro, usa «Vincular carpeta iRacing» para guardar los setups directamente en Documents\\iRacing\\setups.",
  });
  const text = `Hola ${firstName(name)},

Control de Carrera ha aprobado tu solicitud. Ya tienes acceso al Setup Vault de Muntrume Motorsport.

Usuario: ${email}

Crea tu contraseña personal aquí (enlace personal, de un solo uso, caduca en ${expiresHours} horas):
${link}

Si el enlace caduca, usa «¿Olvidaste tu contraseña?» en ${SITE}/setups.${textFooter}`;
  return { subject, html, text };
}

/** 3b) Aprobado · con contraseña temporal (solo si el admin lo elige explícitamente) */
export function approvedTempPasswordEmail({ name, email, tempPassword }) {
  const subject = "Acceso aprobado · Tu contraseña temporal del Setup Vault";
  const html = layout({
    preheader: "Tu acceso está aprobado. Tendrás que cambiar la contraseña en el primer inicio de sesión.",
    title: "¡Bienvenido al equipo!",
    bodyHtml:
      P(`Hola ${escapeHtml(firstName(name))},`) +
      P("Control de Carrera ha aprobado tu solicitud. Estas son tus credenciales de acceso:") +
      infoBox([["Usuario", email], ["Contraseña temporal", tempPassword]]) +
      P("En tu primer acceso el sistema te pedirá elegir una contraseña personal. La temporal deja de funcionar en cuanto la cambies."),
    cta: { url: `${SITE}/setups`, label: "Entrar al Setup Vault" },
    footerNote: "Por seguridad, borra este correo después de cambiar la contraseña.",
  });
  const text = `Hola ${firstName(name)},

Control de Carrera ha aprobado tu solicitud. Estas son tus credenciales de acceso:

Usuario: ${email}
Contraseña temporal: ${tempPassword}

Entra en ${SITE}/setups. En tu primer acceso tendrás que elegir una contraseña personal.
Por seguridad, borra este correo después de cambiarla.${textFooter}`;
  return { subject, html, text };
}

/** 4) Rechazado */
export function rejectedEmail({ name, reason }) {
  const subject = "Sobre tu solicitud al Setup Vault de Muntrume";
  const html = layout({
    preheader: "Gracias por tu interés en Muntrume Motorsport.",
    title: "Gracias por tu solicitud",
    bodyHtml:
      P(`Hola ${escapeHtml(firstName(name))},`) +
      P("Gracias por tu interés en Muntrume Motorsport. Hemos revisado tu solicitud y, por ahora, no podemos darte acceso al Setup Vault.") +
      (reason ? infoBox([["Comentario", reason]]) : "") +
      P("Puedes volver a solicitarlo más adelante o escribirnos desde la web si tienes cualquier duda."),
    cta: { url: `${SITE}/contact.html`, label: "Contactar con el equipo" },
  });
  const text = `Hola ${firstName(name)},

Gracias por tu interés en Muntrume Motorsport. Hemos revisado tu solicitud y, por ahora, no podemos darte acceso al Setup Vault.
${reason ? `\nComentario: ${reason}\n` : ""}
Puedes volver a solicitarlo más adelante o escribirnos desde ${SITE}/contact.html.${textFooter}`;
  return { subject, html, text };
}

/** 5) Restablecer / crear contraseña (olvidé mi contraseña o primer acceso) */
export function resetPasswordEmail({ name, link, expiresMinutes }) {
  const subject = "Restablece tu contraseña · Muntrume Setup Vault";
  const html = layout({
    preheader: `Enlace para crear una nueva contraseña. Caduca en ${expiresMinutes} minutos.`,
    title: "Restablecer contraseña",
    bodyHtml:
      P(`Hola ${escapeHtml(firstName(name))},`) +
      P("Hemos recibido una petición para crear o restablecer la contraseña de tu cuenta del Setup Vault."),
    cta: {
      url: link,
      label: "Crear nueva contraseña",
      hint: `El enlace es de un solo uso y caduca en ${expiresMinutes} minutos.`,
    },
    footerNote: "Si no lo has pedido tú, ignora este correo: tu contraseña actual no cambia.",
  });
  const text = `Hola ${firstName(name)},

Hemos recibido una petición para crear o restablecer la contraseña de tu cuenta del Setup Vault.

Crea tu nueva contraseña aquí (un solo uso, caduca en ${expiresMinutes} minutos):
${link}

Si no lo has pedido tú, ignora este correo: tu contraseña actual no cambia.${textFooter}`;
  return { subject, html, text };
}

/** 6) Formulario de contacto → buzón del equipo */
export function contactFormEmail({ name, email, type, subject, message, to }) {
  const subj = `[Muntrume · ${String(type || "Consulta").slice(0, 40)}] ${String(subject || `Mensaje de ${name}`).slice(0, 120)}`;
  const html = layout({
    preheader: `${name} te ha escrito desde muntru.me`,
    title: "Nuevo mensaje desde muntru.me",
    bodyHtml:
      infoBox([
        ["Remitente", `${name} <${email}>`],
        ["Tipo", type || "General"],
        ["Asunto", subject || "Sin asunto"],
      ]) +
      `<div style="margin:0 0 18px 0;padding:14px 16px;border-left:4px solid #10b981;background:#f6f8fa;border-radius:8px;font-size:14px;line-height:22px;color:#0f172a;white-space:pre-wrap;">${escapeHtml(message)}</div>`,
    cta: { url: `mailto:${email}`, label: `Responder a ${String(name).slice(0, 40)}` },
    footerNote: `Enviado a ${escapeHtml(to)} desde el formulario de contacto.`,
  });
  const text = `Nuevo mensaje desde muntru.me

Remitente: ${name} <${email}>
Tipo: ${type || "General"}
Asunto: ${subject || "Sin asunto"}

${message}${textFooter}`;
  return { subject: subj, html, text };
}
