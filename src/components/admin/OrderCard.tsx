"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Lock, Mail, MapPin, Phone, StickyNote, Store } from "lucide-react";
import { peso } from "@/lib/menu";
import { when } from "@/lib/format";
import {
  DELIVERY_STATUSES,
  PAYMENT_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  applyOrderPatch,
  orderCode,
  type Order,
  type OrderPatch,
  type OrderStatus,
} from "@/lib/orders";
import { updateOrder } from "@/app/admin/actions";

const PROGRESS: OrderStatus[] = ["new", "confirmed", "baking", "ready", "completed"];

const STATUS_TONE: Record<OrderStatus, string> = {
  new: "bg-rose text-white",
  confirmed: "bg-amber-100 text-amber-800",
  baking: "bg-orange-100 text-orange-800",
  ready: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-stone-200 text-stone-600",
};

// Big, quick-to-hit buttons for tablets: 48px tall, instant press feedback
const segment =
  "min-h-12 rounded-xl px-1 text-xs font-bold transition active:scale-95 sm:text-sm disabled:active:scale-100";

export default function OrderCard({ order, emailReady }: { order: Order; emailReady: boolean }) {
  // The card shows a change the moment it's tapped; the save happens in the background
  const [o, setOptimistic] = useOptimistic(order, (cur: Order, patch: OrderPatch) => ({ ...cur, ...patch }));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  function change(patch: OrderPatch) {
    const checked = applyOrderPatch(o, patch);
    if ("error" in checked) return setError(checked.error);
    setError(null);
    startTransition(async () => {
      setOptimistic(checked.patch);
      try {
        const res = await updateOrder(o.id, patch);
        if (res.error) setError(res.error);
      } catch {
        setError("Couldn't save that change. Check your connection and try again.");
      }
    });
  }

  const closed = o.status === "completed" || o.status === "cancelled";
  const step = PROGRESS.indexOf(o.status);
  const delivered = o.delivery_status === "delivered";
  // POS orders the customer collects: "delivered" means picked up
  const pickup = o.address === "Pickup";
  const steps = pickup ? (["pending", "delivered"] as const) : DELIVERY_STATUSES;
  const stepLabel = (d: (typeof DELIVERY_STATUSES)[number]) =>
    pickup ? (d === "delivered" ? "Picked up" : "Not picked up") : STATUS_LABEL[d];

  return (
    <article className={`glass relative flex flex-col rounded-[2rem] p-5 sm:p-6 ${o.status === "new" ? "ring-2 ring-rose/50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display flex items-center gap-2 text-2xl font-bold">
            {orderCode(o.order_number)}
            {pending && <span className="spinner spinner-dark size-4" aria-label="Saving" />}
          </p>
          <p className="text-sm text-cocoa-soft">
            {when(o.created_at)}
            {o.source && o.source !== "website" && (
              <span className="ml-2 rounded-full bg-blush px-2 py-0.5 text-xs font-bold text-rose">via {SOURCE_LABEL[o.source]}</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
          <p className="font-display mt-1 text-2xl font-bold text-rose">{peso(o.total)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 text-sm">
          <p className="font-bold">{o.customer_name}</p>
          {o.customer_email && (
            <a href={`mailto:${o.customer_email}`} className="flex items-center gap-2 py-0.5 break-all text-cocoa-soft hover:text-rose">
              <Mail className="size-4 shrink-0" /> {o.customer_email}
            </a>
          )}
          {o.phone && (
            <a href={`tel:${o.phone}`} className="flex items-center gap-2 py-0.5 text-cocoa-soft hover:text-rose">
              <Phone className="size-4 shrink-0" /> {o.phone}
            </a>
          )}
          {pickup ? (
            <p className="flex items-center gap-2 py-0.5 font-semibold text-cocoa-soft">
              <Store className="size-4 shrink-0" /> Pickup
            </p>
          ) : (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`}
              target="_blank"
              rel="noreferrer"
              className="flex gap-2 py-0.5 text-cocoa-soft hover:text-rose"
            >
              <MapPin className="mt-0.5 size-4 shrink-0" /> <span className="whitespace-pre-line">{o.address}</span>
            </a>
          )}
          {o.notes && (
            <p className="flex gap-2 text-cocoa-soft">
              <StickyNote className="mt-0.5 size-4 shrink-0" /> {o.notes}
            </p>
          )}
        </div>
        <ul className="space-y-1 rounded-2xl bg-surface/45 p-3 text-sm">
          {o.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-2">
              <span>
                <b>{i.quantity}×</b> {i.name} <span className="text-cocoa-soft">({i.option_label})</span>
              </span>
              <span className="tabular-nums">{peso(i.line_total)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-surface/60 px-3 py-1.5 font-semibold">
          {pickup && o.payment_method === "cod" ? "Cash" : PAYMENT_LABEL[o.payment_method]}
          {o.payment_reference && <span className="text-cocoa-soft"> · Ref {o.payment_reference}</span>}
        </span>
        <button
          onClick={() => change({ payment_status: o.payment_status === "paid" ? "unpaid" : "paid" })}
          className={`min-h-9 rounded-full px-4 font-bold transition active:scale-95 ${
            o.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
          title="Tap to toggle payment status"
        >
          {STATUS_LABEL[o.payment_status]}
        </button>
      </div>
      {o.payment_method === "qr" && (
        <p className="mt-2 text-xs text-cocoa-soft">
          {!o.customer_email
            ? "No email on file, so no payment confirmation is sent."
            : o.paid_email_sent_at
              ? `✓ Payment confirmation emailed to ${o.customer_email}.`
              : o.payment_status === "paid"
                ? "No payment confirmation was emailed for this order."
                : emailReady
                  ? `Check that ${peso(o.total)} arrived, then tap Unpaid to mark it Paid. That emails ${o.customer_email} a confirmation.`
                  : "Emails aren't set up yet, so marking it Paid won't email the customer (see Settings)."}
        </p>
      )}

      <div className="dotted-rule my-5" />

      <p className="mb-2 text-xs font-bold tracking-wide text-cocoa-soft uppercase">Progress</p>
      <div className="grid grid-cols-5 gap-1.5">
        {PROGRESS.map((s, i) => {
          const locked = s === "completed" && !delivered;
          return (
            <button
              key={s}
              onClick={() => change({ status: s })}
              disabled={o.status === s || locked}
              aria-pressed={o.status === s}
              title={locked ? (pickup ? "Mark as picked up first" : "Mark as delivered first") : undefined}
              className={`${segment} ${
                o.status === "cancelled"
                  ? "bg-surface/40 text-cocoa-soft"
                  : locked
                    ? "flex items-center justify-center gap-1 bg-surface/30 text-cocoa-soft/60"
                    : i <= step
                      ? "bg-rose text-white"
                      : "bg-surface/50 text-cocoa-soft hover:bg-surface/80 hover:text-cocoa"
              }`}
            >
              {locked && <Lock className="hidden size-3.5 sm:block" />}
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      <p className="mt-4 mb-2 text-xs font-bold tracking-wide text-cocoa-soft uppercase">{pickup ? "Pickup" : "Delivery"}</p>
      <div className={`grid gap-1.5 ${pickup ? "grid-cols-2" : "grid-cols-3"}`}>
        {steps.map((d) => (
          <button
            key={d}
            onClick={() => change({ delivery_status: d })}
            disabled={o.delivery_status === d || o.status === "completed"}
            aria-pressed={o.delivery_status === d}
            className={`${segment} ${
              o.delivery_status === d
                ? "bg-cocoa text-cream"
                : o.status === "completed"
                  ? "bg-surface/30 text-cocoa-soft/60"
                  : "bg-surface/50 text-cocoa-soft hover:bg-surface/80 hover:text-cocoa"
            }`}
          >
            {stepLabel(d)}
          </button>
        ))}
      </div>
      {!delivered && o.status !== "cancelled" && (
        <p className="mt-2 text-xs text-cocoa-soft">Completed unlocks once the order is marked {pickup ? "Picked up" : "Delivered"}.</p>
      )}

      <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
        <p role="status" aria-live="polite" className={`text-sm font-semibold text-rose-deep transition ${error ? "opacity-100" : "opacity-0"}`}>
          {error}
        </p>
        {o.status === "cancelled" ? (
          <button onClick={() => change({ status: "new" })} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-cocoa-soft hover:text-rose">
            Restore order
          </button>
        ) : (
          !closed && (
            <button onClick={() => change({ status: "cancelled" })} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-cocoa-soft hover:text-rose-deep">
              Cancel order
            </button>
          )
        )}
      </div>
    </article>
  );
}
