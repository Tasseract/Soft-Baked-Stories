"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Banknote, Check, Plus, QrCode, ReceiptText, Store, Trash2, Truck } from "lucide-react";
import { findOption, isMixProduct, peso, type Product } from "@/lib/menu";
import { ORDER_SOURCES, SOURCE_LABEL, type OrderSource } from "@/lib/orders";
import { newRef } from "@/lib/ref";
import Stepper from "@/components/Stepper";
import MixPicker, { initialPick } from "@/components/MixPicker";
import { createPosOrder } from "@/app/admin/pos-actions";

type Ticket = Record<string, number>; // "productId:optionId" -> quantity

const POS_SOURCES = ORDER_SOURCES.filter((s) => s !== "website");

const emptyCustomer = { name: "", phone: "", address: "", notes: "", reference: "" };

export default function Pos({ products }: { products: Product[] }) {
  const [ticket, setTicket] = useState<Ticket>({});
  const [customer, setCustomer] = useState(emptyCustomer);
  const [pickup, setPickup] = useState(false);
  const [source, setSource] = useState<OrderSource>("messenger");
  const [payment, setPayment] = useState<"cod" | "qr">("cod");
  const [paid, setPaid] = useState(false);
  const [ref, setRef] = useState(newRef);
  const [saving, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    if (!created) return;
    const t = setTimeout(() => setCreated(null), 6000);
    return () => clearTimeout(t);
  }, [created]);

  const lines = useMemo(
    () =>
      Object.entries(ticket).flatMap(([key, quantity]) => {
        const [productId, optionId] = key.split(":");
        const found = findOption(products, productId, optionId);
        return found && quantity > 0 ? [{ key, quantity, ...found }] : [];
      }),
    [ticket, products],
  );
  const total = lines.reduce((n, l) => n + l.quantity * l.option.price, 0);
  const count = lines.reduce((n, l) => n + l.quantity, 0);

  const add = (key: string, by = 1) => setTicket((t) => ({ ...t, [key]: Math.min((t[key] ?? 0) + by, 999) }));
  const setQty = (key: string, q: number) =>
    setTicket((t) => {
      const next = { ...t };
      if (q <= 0) delete next[key];
      else next[key] = Math.min(q, 999);
      return next;
    });
  const field = (k: keyof typeof emptyCustomer) => ({
    value: customer[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCustomer((c) => ({ ...c, [k]: e.target.value })),
  });

  function submit() {
    setError(null);
    start(async () => {
      try {
        const res = await createPosOrder({
          client_ref: ref,
          items: lines.map((l) => ({ product_id: l.product.id, option: l.option.id, quantity: l.quantity })),
          customer_name: customer.name,
          phone: customer.phone,
          address: customer.address,
          pickup,
          notes: customer.notes,
          source,
          payment_method: payment,
          paid,
          payment_reference: customer.reference,
        });
        if (res.error) return setError(res.error);
        setCreated(res.code ?? null);
        setTicket({});
        setCustomer(emptyCustomer);
        setPaid(false);
        setRef(newRef()); // the next order gets its own reference
      } catch {
        setError("Couldn't save the order. Check your connection and try again.");
      }
    });
  }

  const categories = ["All", ...new Set(products.map((p) => p.category))];
  const shown = products.filter((p) => filter === "All" || p.category === filter);

  return (
    <div className="grid items-start gap-5 md:grid-cols-[1fr_340px] xl:grid-cols-[1fr_400px]">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">New order</h1>
            <p className="text-sm text-cocoa-soft">For orders from chats, calls and walk-ins. Tap items to add them.</p>
          </div>
          {categories.length > 2 && (
            <div className="glass flex rounded-full p-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={`min-h-10 rounded-full px-4 text-sm font-bold transition ${filter === c ? "bg-cocoa text-cream" : "text-cocoa-soft hover:text-cocoa"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 md:max-lg:grid-cols-1">
          {shown.map((p) =>
            isMixProduct(p) ? <MixTile key={p.id} product={p} products={products} onAdd={add} /> : <ProductTile key={p.id} product={p} ticket={ticket} onAdd={add} />,
          )}
        </div>
      </section>

      <aside className="glass-strong flex flex-col gap-4 rounded-[2rem] p-5 md:sticky md:top-24 md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold">
            <ReceiptText className="size-5 text-rose" /> Ticket
          </h2>
          {count > 0 && (
            <button onClick={() => setTicket({})} className="flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-cocoa-soft hover:text-rose-deep">
              <Trash2 className="size-4" /> Clear
            </button>
          )}
        </div>

        {created && (
          <div className="pop-in flex items-center gap-3 rounded-2xl bg-emerald-100 p-3 text-emerald-900">
            <Check className="size-5 shrink-0" />
            <p className="flex-1 text-sm font-semibold">
              {created} created.{" "}
              <Link href="/admin" className="underline">
                View orders
              </Link>
            </p>
          </div>
        )}

        {lines.length === 0 ? (
          <p className="rounded-2xl bg-surface/40 p-6 text-center text-sm text-cocoa-soft">No items yet.</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-2 rounded-2xl bg-surface/50 p-2 pl-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{l.product.name}</p>
                  <p className="truncate text-xs text-cocoa-soft">
                    {l.option.label} · {peso(l.option.price)}
                  </p>
                </div>
                <Stepper qty={l.quantity} onChange={(q) => setQty(l.key, q)} label={`${l.product.name} ${l.option.label}`} />
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-baseline justify-between border-t border-surface/60 pt-3">
          <span className="text-cocoa-soft">Total</span>
          <span className="font-display text-3xl font-bold tabular-nums">{peso(total)}</span>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold tracking-wide text-cocoa-soft uppercase">Ordered via</p>
          <div className="flex flex-wrap gap-1.5">
            {POS_SOURCES.map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                aria-pressed={source === s}
                className={`min-h-10 rounded-full px-3.5 text-sm font-bold transition active:scale-95 ${
                  source === s ? "bg-rose text-white" : "bg-surface/50 text-cocoa-soft hover:text-cocoa"
                }`}
              >
                {SOURCE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold tracking-wide text-cocoa-soft uppercase">Customer</p>
          <input {...field("name")} maxLength={80} placeholder="Name or chat handle *" className="field" />
          <input {...field("phone")} type="tel" inputMode="tel" maxLength={20} placeholder="Mobile number (optional)" className="field" />
          <Segmented
            value={pickup ? "pickup" : "delivery"}
            onChange={(v) => setPickup(v === "pickup")}
            options={[
              { value: "delivery", label: "Delivery", icon: Truck },
              { value: "pickup", label: "Pickup", icon: Store },
            ]}
          />
          {!pickup && <textarea {...field("address")} maxLength={400} rows={2} placeholder="Delivery address *" className="field resize-none" />}
          <input {...field("notes")} maxLength={300} placeholder="Notes (optional)" className="field" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold tracking-wide text-cocoa-soft uppercase">Payment</p>
          <Segmented
            value={payment}
            onChange={(v) => setPayment(v as "cod" | "qr")}
            options={[
              { value: "cod", label: "Cash", icon: Banknote },
              { value: "qr", label: "GCash / QR", icon: QrCode },
            ]}
          />
          {payment === "qr" && <input {...field("reference")} maxLength={60} placeholder="Reference number (optional)" className="field" />}
          <button
            onClick={() => setPaid((p) => !p)}
            aria-pressed={paid}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${
              paid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {paid ? <Check className="size-4" /> : null}
            {paid ? "Already paid" : "Not paid yet — tap if paid"}
          </button>
        </div>

        {error && <p className="rounded-2xl bg-rose/10 px-4 py-2.5 text-sm font-semibold text-rose-deep">{error}</p>}

        <button
          onClick={submit}
          disabled={saving || lines.length === 0}
          className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-rose text-lg font-bold text-white shadow-lg shadow-rose/30 transition hover:bg-rose-deep active:scale-[0.98] disabled:opacity-50"
        >
          {saving && <span className="spinner" aria-hidden />}
          {saving ? "Saving…" : `Create order${total ? ` · ${peso(total)}` : ""}`}
        </button>
      </aside>
    </div>
  );
}

function ProductTile({ product, ticket, onAdd }: { product: Product; ticket: Ticket; onAdd: (key: string) => void }) {
  return (
    <article className={`glass flex flex-col gap-3 rounded-3xl p-4 ${product.active === false ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-3">
        <Image src={product.image} alt="" width={120} height={120} className="size-14 shrink-0 object-contain drop-shadow" />
        <div className="min-w-0">
          <p className="font-bold leading-tight">{product.name}</p>
          {product.active === false && <p className="text-xs text-cocoa-soft">Hidden from shop</p>}
        </div>
      </div>
      <div className="mt-auto grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(product.options.length, 2)}, minmax(0, 1fr))` }}>
        {product.options.map((o) => {
          const key = `${product.id}:${o.id}`;
          const qty = ticket[key] ?? 0;
          return (
            <button
              key={o.id}
              onClick={() => onAdd(key)}
              className={`relative flex min-h-14 flex-col items-center justify-center rounded-2xl px-2 text-center transition active:scale-95 ${
                qty ? "bg-rose text-white" : "bg-surface/60 hover:bg-surface/80"
              }`}
            >
              <span className="text-xs font-semibold opacity-80">{o.label}</span>
              <span className="font-display text-lg leading-tight font-bold tabular-nums">{peso(o.price)}</span>
              {qty > 0 && (
                <span className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-cocoa text-xs font-bold text-cream">{qty}</span>
              )}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function MixTile({ product, products, onAdd }: { product: Product; products: Product[]; onAdd: (key: string) => void }) {
  const [pick, setPick] = useState(() => initialPick(product));
  if (!pick) return null;
  return (
    <article className="glass flex flex-col gap-3 rounded-3xl p-4 ring-2 ring-rose/30 sm:col-span-2">
      <p className="font-bold leading-tight">{product.name}</p>
      <MixPicker product={product} products={products} onPick={(pair, flavors) => setPick({ pair, flavors })} />
      <button
        onClick={() => onAdd(`${product.id}:${pick.pair.id}`)}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-cocoa font-bold text-cream transition active:scale-95"
      >
        <Plus className="size-4" /> Add {pick.pair.label}
      </button>
    </article>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon: typeof Truck }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface/40 p-1">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition active:scale-95 ${
            value === v ? "bg-cocoa text-cream shadow" : "text-cocoa-soft hover:text-cocoa"
          }`}
        >
          <Icon className="size-4" /> {label}
        </button>
      ))}
    </div>
  );
}
