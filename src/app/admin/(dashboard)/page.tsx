import Link from "next/link";
import { MapPin, Phone, StickyNote } from "lucide-react";
import { db } from "@/lib/supabase";
import { peso } from "@/lib/menu";
import { DELIVERY_STATUSES, PAYMENT_LABEL, STATUS_LABEL, orderCode, type Order, type OrderStatus } from "@/lib/orders";
import { updateOrder } from "../actions";
import SetupNotice from "@/components/admin/SetupNotice";
import { dayKey, when } from "@/lib/format";

export const dynamic = "force-dynamic";

const VIEWS = {
  active: { label: "Active", statuses: ["new", "confirmed", "baking", "ready"] },
  completed: { label: "Completed", statuses: ["completed"] },
  cancelled: { label: "Cancelled", statuses: ["cancelled"] },
  all: { label: "All", statuses: null },
} as const;
type View = keyof typeof VIEWS;

const PROGRESS: OrderStatus[] = ["new", "confirmed", "baking", "ready", "completed"];

const STATUS_TONE: Record<OrderStatus, string> = {
  new: "bg-rose text-white",
  confirmed: "bg-amber-100 text-amber-800",
  baking: "bg-orange-100 text-orange-800",
  ready: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-stone-200 text-stone-600",
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: rawView } = await searchParams;
  const view: View = rawView && rawView in VIEWS ? (rawView as View) : "active";

  let orders: Order[];
  try {
    let query = db().from("orders").select("*").order("created_at", { ascending: view === "active" }).limit(300);
    const statuses = VIEWS[view].statuses;
    if (statuses) query = query.in("status", statuses as unknown as string[]);
    const { data, error } = await query;
    if (error) throw error;
    orders = data as Order[];
  } catch (err) {
    return <SetupNotice error={err} />;
  }

  const counts = await statusCounts();

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="New orders" value={counts.new} accent />
        <Stat label="In the kitchen" value={counts.confirmed + counts.baking} />
        <Stat label="Ready / out" value={counts.ready} />
        <Stat label="Completed today" value={counts.completedToday} />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Orders</h1>
        <div className="glass flex rounded-full p-1">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <Link
              key={v}
              href={v === "active" ? "/admin" : `/admin?view=${v}`}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                view === v ? "bg-cocoa text-white" : "text-cocoa-soft hover:text-cocoa"
              }`}
            >
              {VIEWS[v].label}
            </Link>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="glass mt-6 rounded-[2rem] p-12 text-center text-cocoa-soft">
          {view === "active" ? "No open orders right now. New ones appear here automatically." : "Nothing here yet."}
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </>
  );
}

async function statusCounts() {
  const { data } = await db()
    .from("orders")
    .select("status, completed_at")
    .in("status", ["new", "confirmed", "baking", "ready", "completed"])
    .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString());
  const today = dayKey(new Date());
  const counts = { new: 0, confirmed: 0, baking: 0, ready: 0, completedToday: 0 };
  for (const r of data ?? []) {
    if (r.status === "completed") {
      if (r.completed_at && dayKey(r.completed_at) === today) counts.completedToday++;
    } else counts[r.status as keyof typeof counts]++;
  }
  return counts;
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`glass rounded-3xl p-5 ${accent && value > 0 ? "ring-2 ring-rose/60" : ""}`}>
      <p className="text-sm font-semibold text-cocoa-soft">{label}</p>
      <p className={`font-display mt-1 text-4xl font-bold tabular-nums ${accent && value > 0 ? "text-rose" : ""}`}>{value}</p>
    </div>
  );
}

function OrderCard({ order: o }: { order: Order }) {
  const closed = o.status === "completed" || o.status === "cancelled";
  const step = PROGRESS.indexOf(o.status);
  const hidden = (
    <>
      <input type="hidden" name="id" value={o.id} />
      <input type="hidden" name="payment_method" value={o.payment_method} />
    </>
  );

  return (
    <article className={`glass flex flex-col rounded-[2rem] p-5 sm:p-6 ${o.status === "new" ? "ring-2 ring-rose/50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold">{orderCode(o.order_number)}</p>
          <p className="text-sm text-cocoa-soft">{when(o.created_at)}</p>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
          <p className="font-display mt-1 text-2xl font-bold text-rose">{peso(o.total)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 text-sm">
          <p className="font-bold">{o.customer_name}</p>
          <a href={`tel:${o.phone}`} className="flex items-center gap-2 text-cocoa-soft hover:text-rose">
            <Phone className="size-4 shrink-0" /> {o.phone}
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`}
            target="_blank"
            rel="noreferrer"
            className="flex gap-2 text-cocoa-soft hover:text-rose"
          >
            <MapPin className="mt-0.5 size-4 shrink-0" /> <span className="whitespace-pre-line">{o.address}</span>
          </a>
          {o.notes && (
            <p className="flex gap-2 text-cocoa-soft">
              <StickyNote className="mt-0.5 size-4 shrink-0" /> {o.notes}
            </p>
          )}
        </div>
        <ul className="space-y-1 rounded-2xl bg-white/45 p-3 text-sm">
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
        <span className="rounded-full bg-white/60 px-3 py-1 font-semibold">
          {PAYMENT_LABEL[o.payment_method]}
          {o.payment_reference && <span className="text-cocoa-soft"> · Ref {o.payment_reference}</span>}
        </span>
        <form action={updateOrder}>
          {hidden}
          <button
            name="payment_status"
            value={o.payment_status === "paid" ? "unpaid" : "paid"}
            className={`rounded-full px-3 py-1 font-bold transition ${
              o.payment_status === "paid" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-amber-100 text-amber-800 hover:bg-amber-200"
            }`}
            title="Toggle payment status"
          >
            {STATUS_LABEL[o.payment_status]}
          </button>
        </form>
      </div>

      <div className="dotted-rule my-5" />

      <p className="mb-2 text-xs font-bold tracking-wide text-cocoa-soft uppercase">Progress</p>
      <form action={updateOrder} className="grid grid-cols-5 gap-1.5">
        {hidden}
        {PROGRESS.map((s, i) => (
          <button
            key={s}
            name="status"
            value={s}
            disabled={o.status === s}
            className={`rounded-xl px-1 py-2 text-xs font-bold transition sm:text-sm ${
              o.status === "cancelled"
                ? "bg-white/40 text-cocoa-soft"
                : i <= step
                  ? "bg-rose text-white"
                  : "bg-white/50 text-cocoa-soft hover:bg-white/80 hover:text-cocoa"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </form>

      <p className="mt-4 mb-2 text-xs font-bold tracking-wide text-cocoa-soft uppercase">Delivery</p>
      <form action={updateOrder} className="grid grid-cols-3 gap-1.5">
        {hidden}
        {DELIVERY_STATUSES.map((d) => (
          <button
            key={d}
            name="delivery_status"
            value={d}
            disabled={o.delivery_status === d}
            className={`rounded-xl px-1 py-2 text-xs font-bold transition sm:text-sm ${
              o.delivery_status === d ? "bg-cocoa text-white" : "bg-white/50 text-cocoa-soft hover:bg-white/80 hover:text-cocoa"
            }`}
          >
            {STATUS_LABEL[d]}
          </button>
        ))}
      </form>

      <form action={updateOrder} className="mt-4 text-right">
        {hidden}
        {o.status === "cancelled" ? (
          <button name="status" value="new" className="text-sm font-semibold text-cocoa-soft hover:text-rose">
            Restore order
          </button>
        ) : (
          !closed && (
            <button name="status" value="cancelled" className="text-sm font-semibold text-cocoa-soft hover:text-rose-deep">
              Cancel order
            </button>
          )
        )}
      </form>
    </article>
  );
}
