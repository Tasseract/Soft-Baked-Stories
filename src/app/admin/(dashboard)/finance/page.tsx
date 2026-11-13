import Link from "next/link";
import { db } from "@/lib/supabase";
import { peso } from "@/lib/menu";
import { getAllProducts } from "@/lib/catalog";
import { PAYMENT_LABEL, type Order } from "@/lib/orders";
import { dayKey } from "@/lib/format";
import SetupNotice from "@/components/admin/SetupNotice";

export const dynamic = "force-dynamic";

const RANGES = {
  "7": { label: "7 days", days: 7, bucket: "day" },
  "30": { label: "30 days", days: 30, bucket: "day" },
  "90": { label: "90 days", days: 90, bucket: "week" },
  all: { label: "All time", days: null, bucket: "month" },
} as const;
type Range = keyof typeof RANGES;

type Row = Pick<Order, "total" | "items" | "payment_method" | "payment_status" | "completed_at" | "status">;

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rawRange } = await searchParams;
  const range: Range = rawRange && rawRange in RANGES ? (rawRange as Range) : "30";
  const { days, bucket } = RANGES[range];
  const since = days ? startOfDay(days - 1) : null;

  let completed: Row[];
  let open: Pick<Order, "total">[];
  try {
    let q = db()
      .from("orders")
      .select("total, items, payment_method, payment_status, completed_at, status")
      .eq("status", "completed")
      .order("completed_at", { ascending: true })
      .limit(5000);
    if (since) q = q.gte("completed_at", since.toISOString());
    const [c, o] = await Promise.all([q, db().from("orders").select("total").in("status", ["new", "confirmed", "baking", "ready"])]);
    if (c.error) throw c.error;
    if (o.error) throw o.error;
    completed = c.data as Row[];
    open = o.data as Pick<Order, "total">[];
  } catch (err) {
    return <SetupNotice error={err} />;
  }

  const menu = await getAllProducts();
  const revenue = sum(completed.map((o) => o.total));
  const itemsSold = sum(completed.flatMap((o) => o.items.map((i) => i.quantity)));
  const avg = completed.length ? Math.round(revenue / completed.length) : 0;
  const pipeline = sum(open.map((o) => o.total));
  const unpaid = completed.filter((o) => o.payment_status === "unpaid");

  // Revenue over time, with empty buckets filled so gaps show as gaps
  const series = buckets(bucket, since, completed);
  const peak = Math.max(1, ...series.map((b) => b.value));

  // Product performance from what was actually sold, all sizes of a product combined.
  // Current menu items with no sales are listed too, so slow sellers are visible.
  const sales = new Map<string, { name: string; units: number; revenue: number }>();
  for (const p of menu) sales.set(p.id, { name: p.name, units: 0, revenue: 0 });
  for (const line of completed.flatMap((o) => o.items)) {
    const s = sales.get(line.product_id) ?? { name: line.name, units: 0, revenue: 0 };
    s.units += line.quantity;
    s.revenue += line.line_total;
    sales.set(line.product_id, s);
  }
  const byProduct = [...sales.values()].sort((a, b) => b.revenue - a.revenue);
  const topRevenue = Math.max(1, ...byProduct.map((p) => p.revenue));

  const byPayment = (["cod", "qr"] as const).map((m) => {
    const rows = completed.filter((o) => o.payment_method === m);
    return { method: m, orders: rows.length, revenue: sum(rows.map((o) => o.total)) };
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Finance</h1>
        <div className="glass flex rounded-full p-1">
          {(Object.keys(RANGES) as Range[]).map((r) => (
            <Link
              key={r}
              href={`/admin/finance?range=${r}`}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                range === r ? "bg-cocoa text-cream" : "text-cocoa-soft hover:text-cocoa"
              }`}
            >
              {RANGES[r].label}
            </Link>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-cocoa-soft">Counts completed orders only, by the day they were completed.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Revenue" value={peso(revenue)} hero />
        <Tile label="Completed orders" value={completed.length.toLocaleString()} />
        <Tile label="Average order" value={peso(avg)} />
        <Tile label="Items sold" value={itemsSold.toLocaleString()} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="glass rounded-3xl px-5 py-4 text-sm">
          <span className="text-cocoa-soft">In progress, not yet earned: </span>
          <b>{peso(pipeline)}</b> <span className="text-cocoa-soft">across {open.length} open order{open.length === 1 ? "" : "s"}</span>
        </div>
        <div className={`glass rounded-3xl px-5 py-4 text-sm ${unpaid.length ? "ring-2 ring-amber-300" : ""}`}>
          <span className="text-cocoa-soft">Completed but marked unpaid: </span>
          <b>{peso(sum(unpaid.map((o) => o.total)))}</b>{" "}
          <span className="text-cocoa-soft">
            ({unpaid.length} order{unpaid.length === 1 ? "" : "s"})
          </span>
        </div>
      </div>

      <section className="glass mt-6 rounded-[2rem] p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Revenue by {bucket}</h2>
        {revenue === 0 ? (
          <p className="py-16 text-center text-cocoa-soft">No completed orders in this range yet.</p>
        ) : (
          <div className="mt-6 flex">
            <div className="flex h-56 w-14 shrink-0 flex-col justify-between pr-2 text-right text-[11px] text-cocoa-soft tabular-nums">
              <span>{peso(peak)}</span>
              <span>{peso(Math.round(peak / 2))}</span>
              <span>₱0</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative flex h-56 items-end gap-[2px] border-b border-cocoa/20">
                <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-cocoa/10" />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-cocoa/10" />
                {series.map((b) => (
                  <div key={b.key} className="group relative flex h-full flex-1 items-end justify-center hover:bg-surface/30">
                    <div className="w-full max-w-10 rounded-t-[4px] bg-rose transition group-hover:bg-rose-deep" style={{ height: `${(b.value / peak) * 100}%` }} />
                    <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg bg-cocoa px-2.5 py-1.5 text-xs whitespace-nowrap text-cream shadow-lg group-hover:block">
                      <span className="opacity-75">{b.label}</span> · <b>{peso(b.value)}</b> · {b.orders} order{b.orders === 1 ? "" : "s"}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-[2px] text-[11px] text-cocoa-soft">
                {series.map((b, i) => (
                  <span key={b.key} className="flex min-w-0 flex-1 justify-center whitespace-nowrap">
                    {i % Math.ceil(series.length / 8) === 0 ? b.short : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass rounded-[2rem] p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold">Best sellers</h2>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-cocoa-soft uppercase">
              <tr>
                <th className="pb-2 font-bold">Product</th>
                <th className="pb-2 text-right font-bold">Units</th>
                <th className="pb-2 text-right font-bold">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {byProduct.map((p) => (
                <tr key={p.name} className="border-t border-surface/60">
                  <td className="py-2.5 pr-3">
                    <p className="font-semibold">{p.name}</p>
                    <div className="mt-1.5 h-2 rounded-full bg-surface/50">
                      <div className="h-2 rounded-full bg-rose" style={{ width: `${(p.revenue / topRevenue) * 100}%` }} />
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{p.units}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">{peso(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="glass rounded-[2rem] p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold">Payment methods</h2>
          {revenue > 0 && (
            <div className="mt-5 flex h-3 gap-[2px] overflow-hidden rounded-full">
              {byPayment.map((p) =>
                p.revenue ? (
                  <div key={p.method} className={p.method === "cod" ? "bg-cocoa" : "bg-rose"} style={{ width: `${(p.revenue / revenue) * 100}%` }} />
                ) : null,
              )}
            </div>
          )}
          <ul className="mt-5 space-y-3">
            {byPayment.map((p) => (
              <li key={p.method} className="flex items-center justify-between gap-3 rounded-2xl bg-surface/45 px-4 py-3">
                <span className="flex items-center gap-2.5 font-semibold">
                  <span className={`size-3 rounded-full ${p.method === "cod" ? "bg-cocoa" : "bg-rose"}`} />
                  {PAYMENT_LABEL[p.method]}
                </span>
                <span className="text-right">
                  <b className="tabular-nums">{peso(p.revenue)}</b>
                  <span className="block text-xs text-cocoa-soft">
                    {p.orders} order{p.orders === 1 ? "" : "s"}
                    {revenue ? ` · ${Math.round((p.revenue / revenue) * 100)}%` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Tile({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div className={`rounded-3xl p-5 ${hero ? "bg-rose text-white shadow-xl shadow-rose/30" : "glass"}`}>
      <p className={`text-sm font-semibold ${hero ? "text-white/80" : "text-cocoa-soft"}`}>{label}</p>
      <p className="font-display mt-1 text-3xl font-bold tabular-nums sm:text-4xl">{value}</p>
    </div>
  );
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// Midnight in Manila, `daysAgo` days back
function startOfDay(daysAgo: number) {
  const key = dayKey(new Date(Date.now() - daysAgo * 86_400_000));
  return new Date(`${key}T00:00:00+08:00`);
}

function bucketKey(bucket: "day" | "week" | "month", iso: string) {
  const key = dayKey(iso);
  if (bucket === "day") return key;
  if (bucket === "month") return key.slice(0, 7);
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday of that week
  return d.toISOString().slice(0, 10);
}

function buckets(bucket: "day" | "week" | "month", since: Date | null, rows: Row[]) {
  const totals = new Map<string, { value: number; orders: number }>();
  for (const r of rows) {
    if (!r.completed_at) continue;
    const k = bucketKey(bucket, r.completed_at);
    const t = totals.get(k) ?? { value: 0, orders: 0 };
    t.value += r.total;
    t.orders++;
    totals.set(k, t);
  }

  const first = since ?? (rows[0]?.completed_at ? new Date(rows[0].completed_at) : new Date());
  const keys: string[] = [];
  const cursor = new Date(`${bucketKey(bucket, first.toISOString())}T00:00:00Z`);
  const last = bucketKey(bucket, new Date().toISOString());
  for (let guard = 0; guard < 400; guard++) {
    const k = bucket === "month" ? cursor.toISOString().slice(0, 7) : cursor.toISOString().slice(0, 10);
    keys.push(k);
    if (k >= last) break;
    if (bucket === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (bucket === "week") cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const fmt = (k: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-PH", { ...opts, timeZone: "UTC" }).format(new Date(k.length === 7 ? `${k}-01T00:00:00Z` : `${k}T00:00:00Z`));

  return keys.map((k) => ({
    key: k,
    ...(totals.get(k) ?? { value: 0, orders: 0 }),
    label: bucket === "month" ? fmt(k, { month: "long", year: "numeric" }) : (bucket === "week" ? "Week of " : "") + fmt(k, { month: "short", day: "numeric" }),
    short: bucket === "month" ? fmt(k, { month: "short" }) : fmt(k, { month: "short", day: "numeric" }),
  }));
}
