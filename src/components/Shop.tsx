"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Banknote, Check, Minus, Plus, QrCode, ShoppingBag, X } from "lucide-react";
import { PRODUCTS, findOption, peso, type Product } from "@/lib/menu";

type Cart = Record<string, number>; // "productId:optionId" -> quantity
type Payment = "cod" | "qr";

const CART_KEY = "sbs-cart";
const categories = ["All", "Muffins", "Breads"] as const;

export default function Shop() {
  const [cart, setCart] = useState<Cart>({});
  const [filter, setFilter] = useState<(typeof categories)[number]>("All");
  const [open, setOpen] = useState(false);
  const [placed, setPlaced] = useState<{ code: string; total: number } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const lines = useMemo(
    () =>
      Object.entries(cart).flatMap(([key, quantity]) => {
        const [productId, optionId] = key.split(":");
        const found = findOption(productId, optionId);
        return found && quantity > 0 ? [{ key, quantity, ...found }] : [];
      }),
    [cart],
  );
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((n, l) => n + l.quantity * l.option.price, 0);

  const setQty = (key: string, quantity: number) =>
    setCart((c) => {
      const next = { ...c };
      if (quantity <= 0) delete next[key];
      else next[key] = Math.min(quantity, 99);
      return next;
    });

  const shown = PRODUCTS.filter((p) => filter === "All" || p.category === filter);

  return (
    <section id="menu" className="scroll-mt-28 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl font-bold sm:text-5xl">
            Our <span className="text-rose">menu</span>
          </h2>
          <p className="mt-2 text-cocoa-soft">Baked fresh to order. Mix and match as much as you like.</p>
        </div>
        <div className="glass flex rounded-full p-1" role="tablist">
          {categories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={filter === c}
              onClick={() => setFilter(c)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                filter === c ? "bg-rose text-white shadow" : "text-cocoa-soft hover:text-cocoa"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="dotted-rule mt-6" />

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <ProductCard key={p.id} product={p} cart={cart} setQty={setQty} />
        ))}
      </div>

      {count > 0 && !open && (
        <div className="fixed inset-x-0 bottom-4 z-30 px-4">
          <button
            onClick={() => setOpen(true)}
            className="glass-strong mx-auto flex w-full max-w-md items-center justify-between rounded-full py-2 pr-2 pl-5 transition hover:scale-[1.01]"
          >
            <span className="flex items-center gap-2 font-bold">
              <ShoppingBag className="size-5 text-rose" />
              {count} item{count > 1 ? "s" : ""} · {peso(total)}
            </span>
            <span className="rounded-full bg-rose px-5 py-2.5 font-bold text-white">Checkout</span>
          </button>
        </div>
      )}

      {open && (
        <Checkout
          lines={lines}
          total={total}
          setQty={setQty}
          placed={placed}
          onClose={() => {
            setOpen(false);
            setPlaced(null);
          }}
          onPlaced={(code) => {
            setPlaced({ code, total });
            setCart({});
          }}
        />
      )}
    </section>
  );
}

function ProductCard({
  product,
  cart,
  setQty,
}: {
  product: Product;
  cart: Cart;
  setQty: (key: string, q: number) => void;
}) {
  return (
    <article className="glass group flex flex-col rounded-[2rem] p-5 transition hover:-translate-y-1 hover:bg-white/55">
      <div className="relative grid h-52 place-items-center">
        <div className="absolute inset-x-8 bottom-3 h-6 rounded-full bg-cocoa/15 blur-xl" />
        <Image
          src={product.image}
          alt={product.name}
          width={400}
          height={400}
          className="relative max-h-52 w-auto object-contain drop-shadow-xl transition duration-500 group-hover:scale-105 group-hover:-rotate-2"
        />
      </div>
      <h3 className="font-display mt-4 text-2xl font-bold">{product.name}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-cocoa-soft">{product.description}</p>
      <div className="mt-5 space-y-2">
        {product.options.map((o) => {
          const key = `${product.id}:${o.id}`;
          const qty = cart[key] ?? 0;
          return (
            <div key={o.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/45 py-2 pr-2 pl-4">
              <div className="leading-tight">
                <div className="font-display text-xl font-bold text-rose">{peso(o.price)}</div>
                <div className="text-xs font-semibold tracking-wide text-cocoa-soft uppercase">{o.label}</div>
              </div>
              {qty === 0 ? (
                <button
                  onClick={() => setQty(key, 1)}
                  className="flex items-center gap-1.5 rounded-full bg-cocoa px-4 py-2 text-sm font-bold text-white transition hover:bg-rose"
                >
                  <Plus className="size-4" /> Add
                </button>
              ) : (
                <Stepper qty={qty} onChange={(q) => setQty(key, q)} label={`${product.name} ${o.label}`} />
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Stepper({ qty, onChange, label }: { qty: number; onChange: (q: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/80 p-1 shadow-sm">
      <button aria-label={`Remove one ${label}`} onClick={() => onChange(qty - 1)} className="grid size-8 place-items-center rounded-full hover:bg-blush">
        <Minus className="size-4" />
      </button>
      <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
      <button aria-label={`Add one ${label}`} onClick={() => onChange(qty + 1)} className="grid size-8 place-items-center rounded-full bg-rose text-white hover:bg-rose-deep">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

type Line = { key: string; quantity: number; product: Product; option: Product["options"][number] };

function Checkout({
  lines,
  total,
  setQty,
  placed,
  onClose,
  onPlaced,
}: {
  lines: Line[];
  total: number;
  setQty: (key: string, q: number) => void;
  placed: { code: string; total: number } | null;
  onClose: () => void;
  onPlaced: (code: string) => void;
}) {
  const [payment, setPayment] = useState<Payment>("cod");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ product_id: l.product.id, option: l.option.id, quantity: l.quantity })),
          customer_name: form.get("name"),
          phone: form.get("phone"),
          address: form.get("address"),
          notes: form.get("notes"),
          payment_method: payment,
          payment_reference: form.get("reference"),
          website: form.get("website"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      onPlaced(data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Checkout">
      <button aria-label="Close checkout" onClick={onClose} className="absolute inset-0 bg-cocoa/25 backdrop-blur-sm" />
      <div className="glass-strong relative flex h-full w-full max-w-lg flex-col overflow-y-auto rounded-l-[2rem] p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl font-bold">{placed ? "Order placed!" : "Your order"}</h2>
          <button aria-label="Close" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-white/70 hover:bg-blush">
            <X className="size-5" />
          </button>
        </div>

        {placed ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="grid size-20 place-items-center rounded-full bg-rose text-white shadow-lg shadow-rose/40">
              <Check className="size-10" />
            </div>
            <p className="font-display mt-6 text-2xl font-bold">Thank you!</p>
            <p className="mt-2 text-cocoa-soft">
              Your order <b className="text-cocoa">{placed.code}</b> for <b className="text-cocoa">{peso(placed.total)}</b> is in.
              We&apos;ll text you shortly to confirm the delivery time.
            </p>
            <button onClick={onClose} className="mt-8 rounded-full bg-cocoa px-6 py-3 font-bold text-white hover:bg-rose">
              Back to the menu
            </button>
          </div>
        ) : lines.length === 0 ? (
          <p className="mt-10 text-center text-cocoa-soft">Your bag is empty.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-1 flex-col gap-6">
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-3 rounded-2xl bg-white/50 p-2 pr-3">
                  <Image src={l.product.image} alt="" width={64} height={64} className="size-14 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{l.product.name}</p>
                    <p className="text-sm text-cocoa-soft">
                      {l.option.label} · {peso(l.option.price)}
                    </p>
                  </div>
                  <Stepper qty={l.quantity} onChange={(q) => setQty(l.key, q)} label={`${l.product.name} ${l.option.label}`} />
                </li>
              ))}
            </ul>

            <fieldset className="space-y-3">
              <legend className="font-display mb-2 text-lg font-semibold">Delivery details</legend>
              <input name="name" required maxLength={80} autoComplete="name" placeholder="Full name" className="field" />
              <input
                name="phone"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                pattern="^(\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}$"
                title="Philippine mobile number, e.g. 0917 123 4567"
                placeholder="Mobile number (0917 123 4567)"
                className="field"
              />
              <textarea name="address" required maxLength={400} rows={3} autoComplete="street-address" placeholder="Complete delivery address" className="field resize-none" />
              <input name="notes" maxLength={300} placeholder="Notes (optional) — landmarks, preferred time…" className="field" />
              {/* Honeypot: real customers never see or fill this */}
              <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            </fieldset>

            <fieldset>
              <legend className="font-display mb-2 text-lg font-semibold">Payment</legend>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["cod", "Cash on delivery", Banknote],
                    ["qr", "Scan QR to pay", QrCode],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center text-sm font-bold transition ${
                      payment === value ? "border-rose bg-white/80 text-rose" : "border-transparent bg-white/45 hover:bg-white/65"
                    }`}
                  >
                    <input type="radio" name="payment" value={value} checked={payment === value} onChange={() => setPayment(value)} className="sr-only" />
                    <Icon className="size-6" />
                    {label}
                  </label>
                ))}
              </div>
              {payment === "qr" && (
                <div className="mt-4 flex flex-col items-center rounded-2xl bg-white/70 p-5 text-center">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <QRCodeSVG value={`SOFTBAKEDSTORIES-MOCK|amount=${total}`} size={168} fgColor="#4a2b20" />
                  </div>
                  <p className="mt-3 text-sm text-cocoa-soft">
                    Scan to pay <b className="text-cocoa">{peso(total)}</b>, then enter the reference number below.
                  </p>
                  <span className="mt-1 rounded-full bg-blush px-2 py-0.5 text-[11px] font-bold tracking-wide text-rose uppercase">Demo QR — not a real account</span>
                  <input name="reference" required maxLength={60} placeholder="Payment reference number" className="field mt-4 text-center" />
                </div>
              )}
            </fieldset>

            <div className="mt-auto space-y-3">
              {error && <p className="rounded-2xl bg-rose/10 px-4 py-3 text-sm font-semibold text-rose-deep">{error}</p>}
              <div className="flex items-baseline justify-between">
                <span className="text-cocoa-soft">Total</span>
                <span className="font-display text-3xl font-bold">{peso(total)}</span>
              </div>
              <button
                disabled={submitting}
                className="w-full rounded-full bg-rose py-4 text-lg font-bold text-white shadow-lg shadow-rose/30 transition hover:bg-rose-deep disabled:opacity-60"
              >
                {submitting ? "Placing order…" : "Place order"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
