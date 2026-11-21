import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { peso } from "./menu";
import { PAYMENT_LABEL, SOURCE_LABEL, orderCode, type Order } from "./orders";

/*
 * Emails go out through the shop's Gmail account (free, no domain needed, about 500 a day):
 *   GMAIL_USER          the shop's Gmail address
 *   GMAIL_APP_PASSWORD  a 16-character App Password (not the normal Gmail password)
 *   ORDER_EMAIL_TO      where new-order alerts go (defaults to GMAIL_USER)
 * Without them, nothing is sent and orders still work. EMAIL_PREVIEW_DIR writes emails
 * to .html files instead, for checking how they look.
 */

type Mail = { to: string; subject: string; html: string };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validEmail = (s: string | null | undefined): s is string => !!s && EMAIL_RE.test(s);

let transport: Transporter | null = null;

async function send(mail: Mail) {
  const preview = process.env.EMAIL_PREVIEW_DIR;
  if (preview) {
    await mkdir(preview, { recursive: true });
    const file = `${Date.now()}-${mail.subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}.html`;
    await writeFile(path.join(preview, file), `<!-- To: ${mail.to} | Subject: ${mail.subject} -->\n${mail.html}`);
    return;
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ""); // Google shows it in groups of four
  if (!user || !pass) return;
  transport ??= nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  await transport.sendMail({ from: { name: "Soft Baked Stories", address: user }, replyTo: user, ...mail });
}

// ─── Layout ──────────────────────────────────────────────────────────────────

const siteUrl = () => {
  const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? (host.startsWith("http") ? host : `https://${host}`) : null;
};

function layout(body: string, preheader: string) {
  const site = siteUrl();
  const logo = site
    ? `<img src="${site}/images/logo.png" alt="Soft Baked Stories" width="186" style="display:block;margin:0 auto 8px;height:auto">`
    : `<p style="margin:0 0 8px;text-align:center;font-size:20px;font-weight:700;color:#c65f7c">Soft Baked Stories</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#fbf5f1">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#fbf5f1;padding:28px 14px;color:#4a2b20">
  <div style="max-width:520px;margin:auto">
    ${logo}
    <div style="background:#ffffff;border-radius:22px;padding:28px;box-shadow:0 10px 30px -18px rgba(122,60,75,.35)">${body}</div>
    <p style="text-align:center;font-size:12px;color:#7a5546;margin:18px 0 0">Soft Baked Stories · Home-baked with love${site ? ` · <a href="${site}" style="color:#c65f7c">Order again</a>` : ""}</p>
  </div>
</div></body></html>`;
}

function itemsTable(order: Order) {
  const rows = order.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f6e3e8">${esc(i.name)}<br><span style="color:#7a5546;font-size:13px">${esc(i.option_label)} · ${peso(i.unit_price)}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid #f6e3e8;text-align:center;white-space:nowrap">× ${i.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f6e3e8;text-align:right;white-space:nowrap">${peso(i.line_total)}</td>
      </tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows}</table>
  <p style="text-align:right;font-size:18px;font-weight:700;margin:12px 0 0">Total ${peso(order.total)}</p>`;
}

const box = (html: string, tone: "rose" | "green" | "amber" = "rose") => {
  const colors = { rose: ["#fdf0f3", "#a8445f"], green: ["#ecfdf3", "#166534"], amber: ["#fff7e6", "#92400e"] }[tone];
  return `<div style="background:${colors[0]};color:${colors[1]};border-radius:14px;padding:14px 16px;margin:20px 0;font-size:15px;line-height:1.5">${html}</div>`;
};

const detail = (label: string, value: string) =>
  `<tr><td style="padding:4px 14px 4px 0;color:#7a5546;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:4px 0">${value}</td></tr>`;

const isPickup = (o: Order) => o.address === "Pickup";
const firstName = (name: string) => esc(name.trim().split(/\s+/)[0] || name);

// ─── Emails ──────────────────────────────────────────────────────────────────

/** To the owner, for every new order */
function ownerNewOrder(order: Order): Mail {
  const code = orderCode(order.order_number);
  const via = order.source && order.source !== "website" ? ` · via ${SOURCE_LABEL[order.source]}` : "";
  const body = `
    <p style="margin:0;color:#c65f7c;font-weight:700">New order${via}</p>
    <h1 style="margin:4px 0 20px;font-size:26px">${code} · ${peso(order.total)}</h1>
    ${itemsTable(order)}
    <table style="border-collapse:collapse;margin-top:20px;font-size:15px">
      ${detail("Name", esc(order.customer_name))}
      ${order.phone ? detail("Phone", `<a href="tel:${esc(order.phone)}" style="color:#c65f7c">${esc(order.phone)}</a>`) : ""}
      ${order.customer_email ? detail("Email", esc(order.customer_email)) : ""}
      ${detail(isPickup(order) ? "Pickup" : "Address", isPickup(order) ? "Customer will pick up" : esc(order.address).replace(/\n/g, "<br>"))}
      ${order.notes ? detail("Notes", esc(order.notes)) : ""}
      ${detail("Payment", PAYMENT_LABEL[order.payment_method] + (order.payment_reference ? ` · Ref <b>${esc(order.payment_reference)}</b>` : ""))}
    </table>
    ${order.payment_method === "qr" && order.payment_status !== "paid" ? box(`Check that <b>${peso(order.total)}</b> arrived (ref ${esc(order.payment_reference ?? "none given")}), then tap <b>Unpaid → Paid</b> on the order. ${order.customer_email ? "The customer gets a payment confirmation email." : "This customer didn't leave an email."}`, "amber") : ""}`;
  return {
    to: process.env.ORDER_EMAIL_TO || process.env.GMAIL_USER || "",
    subject: `New order ${code} — ${peso(order.total)} from ${order.customer_name}`,
    html: layout(body, `${order.customer_name} ordered ${order.items.length} item(s) for ${peso(order.total)}`),
  };
}

/** To the customer, right after they order */
function customerOrderReceived(order: Order): Mail {
  const code = orderCode(order.order_number);
  const payment =
    order.payment_method === "qr"
      ? order.payment_status === "paid"
        ? box(`Your payment of <b>${peso(order.total)}</b> has been received. Thank you!`, "green")
        : box(
            `<b>We're checking your payment of ${peso(order.total)}</b>${order.payment_reference ? ` (ref ${esc(order.payment_reference)})` : ""}.<br>We'll email you again as soon as it's confirmed.`,
            "amber",
          )
      : box(
          isPickup(order)
            ? `Please pay <b>${peso(order.total)}</b> when you pick up your order.`
            : `Please prepare <b>${peso(order.total)}</b> in cash for when your order arrives.`,
        );
  const body = `
    <h1 style="margin:0 0 6px;font-size:24px">Thanks, ${firstName(order.customer_name)}! 🧁</h1>
    <p style="margin:0;color:#7a5546;font-size:15px">We've received your order <b style="color:#4a2b20">${code}</b> and will message you to confirm the ${isPickup(order) ? "pickup" : "delivery"} time.</p>
    ${payment}
    ${itemsTable(order)}
    <table style="border-collapse:collapse;margin-top:20px;font-size:15px">
      ${detail(isPickup(order) ? "Pickup" : "Deliver to", isPickup(order) ? "You'll pick this up" : esc(order.address).replace(/\n/g, "<br>"))}
      ${order.notes ? detail("Notes", esc(order.notes)) : ""}
    </table>
    <p style="margin:22px 0 0;font-size:14px;color:#7a5546">Questions or changes? Just reply to this email.</p>`;
  return {
    to: order.customer_email!,
    subject: `We got your order ${code} 🧁`,
    html: layout(body, `Order ${code} for ${peso(order.total)} received`),
  };
}

/** To the customer, when the owner marks a QR order as paid */
function customerPaymentConfirmed(order: Order): Mail {
  const code = orderCode(order.order_number);
  const body = `
    <div style="text-align:center">
      <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;background:#ecfdf3;color:#166534;font-size:28px">✓</div>
      <h1 style="margin:14px 0 6px;font-size:24px">Payment received</h1>
      <p style="margin:0;color:#7a5546;font-size:15px">Thanks, ${firstName(order.customer_name)}! We've confirmed your payment of <b style="color:#4a2b20">${peso(order.total)}</b> for order <b style="color:#4a2b20">${code}</b>${order.payment_reference ? ` (ref ${esc(order.payment_reference)})` : ""}.</p>
    </div>
    ${box(`We're getting your order ready and will message you about the ${isPickup(order) ? "pickup" : "delivery"} time.`, "green")}
    ${itemsTable(order)}
    <p style="margin:22px 0 0;font-size:14px;color:#7a5546">Questions? Just reply to this email.</p>`;
  return {
    to: order.customer_email!,
    subject: `Payment received for ${code} ✓`,
    html: layout(body, `We've confirmed your ${peso(order.total)} payment`),
  };
}

// ─── Triggers ────────────────────────────────────────────────────────────────

/** Order alert to the owner, and a confirmation to the customer if they gave an email */
export async function notifyNewOrder(order: Order, { alertOwner = true } = {}) {
  const mails = [alertOwner ? ownerNewOrder(order) : null, validEmail(order.customer_email) ? customerOrderReceived(order) : null];
  const results = await Promise.allSettled(mails.filter((m): m is Mail => !!m?.to).map(send));
  for (const r of results) if (r.status === "rejected") console.error("Order email failed", r.reason);
}

/** Payment confirmation to the customer. Returns whether it was sent. */
export async function notifyPaymentConfirmed(order: Order) {
  if (!validEmail(order.customer_email)) return false;
  try {
    await send(customerPaymentConfirmed(order));
    return true;
  } catch (err) {
    console.error("Payment email failed", err);
    return false;
  }
}

/** Whether emails can actually go out (shown in the dashboard) */
export const emailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) || !!process.env.EMAIL_PREVIEW_DIR;
