import Link from "next/link";
import { db } from "@/lib/supabase";
import type { Order } from "@/lib/orders";
import SetupNotice from "@/components/admin/SetupNotice";
import OrderCard from "@/components/admin/OrderCard";
import { dayKey } from "@/lib/format";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

const VIEWS = {
  active: { label: "Active", statuses: ["new", "confirmed", "baking", "ready"] },
  completed: { label: "Completed", statuses: ["completed"] },
  cancelled: { label: "Cancelled", statuses: ["cancelled"] },
  all: { label: "All", statuses: null },
} as const;
type View = keyof typeof VIEWS;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: rawView } = await searchParams;
  const view: View = rawView && rawView in VIEWS ? (rawView as View) : "active";

  let orders: Order[];
  let counts: Awaited<ReturnType<typeof statusCounts>>;
  try {
    let query = db().from("orders").select("*").order("created_at", { ascending: view === "active" }).limit(300);
    const statuses = VIEWS[view].statuses;
    if (statuses) query = query.in("status", statuses as unknown as string[]);
    const [{ data, error }, c] = await Promise.all([query, statusCounts()]);
    if (error) throw error;
    orders = data as Order[];
    counts = c;
  } catch (err) {
    return <SetupNotice error={err} />;
  }

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
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                view === v ? "bg-cocoa text-cream" : "text-cocoa-soft hover:text-cocoa"
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
            <OrderCard key={o.id} order={o} emailReady={emailConfigured()} />
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
