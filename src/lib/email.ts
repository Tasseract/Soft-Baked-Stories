import "server-only";
import { Resend } from "resend";
import { peso } from "./menu";
import { PAYMENT_LABEL, orderCode, type Order } from "./orders";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendOrderEmail(order: Order) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_EMAIL_TO;
  if (!key || !to) return;

  const code = orderCode(order.order_number);
  const rows = order.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0">${esc(i.name)} <span style="color:#7a5546">(${esc(i.option_label)})</span></td>
        <td style="padding:8px 0;text-align:center">× ${i.quantity}</td>
        <td style="padding:8px 0;text-align:right">${peso(i.line_total)}</td>
      </tr>`,
    )
    .join("");
  const detail = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#7a5546;vertical-align:top">${label}</td><td style="padding:4px 0">${value}</td></tr>`;

  const html = `<div style="font-family:system-ui,sans-serif;background:#fbf5f1;padding:24px;color:#4a2b20">
  <div style="max-width:520px;margin:auto;background:#fff;border-radius:20px;padding:28px">
    <p style="margin:0;color:#c65f7c;font-weight:700">New order</p>
    <h1 style="margin:4px 0 20px;font-size:26px">${code} · ${peso(order.total)}</h1>
    <table style="width:100%;border-collapse:collapse;border-bottom:1px dashed #e8a7b8">${rows}</table>
    <p style="text-align:right;font-size:18px;font-weight:700;margin:12px 0 24px">Total ${peso(order.total)}</p>
    <table style="border-collapse:collapse">
      ${detail("Name", esc(order.customer_name))}
      ${detail("Phone", `<a href="tel:${esc(order.phone)}">${esc(order.phone)}</a>`)}
      ${detail("Address", esc(order.address).replace(/\n/g, "<br>"))}
      ${order.notes ? detail("Notes", esc(order.notes)) : ""}
      ${detail("Payment", PAYMENT_LABEL[order.payment_method] + (order.payment_reference ? ` · Ref ${esc(order.payment_reference)}` : ""))}
    </table>
  </div>
</div>`;

  const { error } = await new Resend(key).emails.send({
    from: process.env.ORDER_EMAIL_FROM || "Soft Baked Stories <onboarding@resend.dev>",
    to,
    subject: `New order ${code} — ${peso(order.total)} from ${order.customer_name}`,
    html,
  });
  if (error) throw new Error(error.message);
}
