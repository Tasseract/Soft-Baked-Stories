"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Banknote, Check, CloudOff, Download, Plus, QrCode, ShoppingBag, X } from "lucide-react";
import Stepper from "./Stepper";
import { newRef } from "@/lib/ref";
import MixPicker, { initialPick } from "./MixPicker";
import { findOption, isMixProduct, peso, type Product } from "@/lib/menu";

type Cart = Record<string, number>; // "productId:optionId" -> quantity
type Payment = "cod" | "qr";

const CART_KEY = "sbs-cart";
const MAX_ATTEMPTS = 5;
const ATTEMPT_TIMEOUT_MS = 15_000;

export default function Shop({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<Cart>({});
  const [filter, setFilter] = useState("All");
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
        const found = findOption(products, productId, optionId);
        if (!found || quantity <= 0) return [];
        // A mixed box shows its first flavor's photo
        const flavor = found.option.mix && products.find((p) => p.id === found.option.mix![0]);
        return [{ key, quantity, ...found, image: flavor ? flavor.image : found.product.image }];
      }),
    [cart, products],
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

  const categories = ["All", ...new Set(products.map((p) => p.category))];
  const shown = products.filter((p) => filter === "All" || p.category === filter);

  return (
    <section id="menu" className="scroll-mt-28 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl font-bold sm:text-5xl">
            Our <span className="text-rose">menu</span>
          </h2>
          <p className="mt-2 text-cocoa-soft">Baked fresh to order. Mix and match as much as you like.</p>
        </div>
        {categories.length > 2 && (
          <div className="glass flex rounded-full p-1" role="tablist">
            {categories.map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={filter === c}
                onClick={() => setFilter(c)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  filter === c ? "bg-rose text-white shadow" : "text-cocoa-soft hover:text-cocoa"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="dotted-rule mt-6" />

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) =>
          isMixProduct(p) ? (
            <MixCard key={p.id} product={p} products={products} cart={cart} setQty={setQty} />
          ) : (
            <ProductCard key={p.id} product={p} cart={cart} setQty={setQty} />
          ),
        )}
      </div>

      {count > 0 && !open && (
        <div className="fixed inset-x-0 bottom-4 z-30 px-4">
          <button
            onClick={() => setOpen(true)}
            className="glass-strong mx-auto flex w-full max-w-md items-center justify-between rounded-full py-2 pr-2 pl-5 transition active:scale-[0.98]"
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
    <article className="glass group flex flex-col rounded-[2rem] p-5 transition hover:-translate-y-1">
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
            <div key={o.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface/45 py-2 pr-2 pl-4">
              <div className="leading-tight">
                <div className="font-display text-xl font-bold text-rose">{peso(o.price)}</div>
                <div className="text-xs font-semibold tracking-wide text-cocoa-soft uppercase">{o.label}</div>
              </div>
              {qty === 0 ? (
                <button
                  onClick={() => setQty(key, 1)}
                  className="flex min-h-10 items-center gap-1.5 rounded-full bg-cocoa px-4 py-2 text-sm font-bold text-cream transition hover:bg-rose hover:text-white active:scale-95"
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

function MixCard({
  product,
  products,
  cart,
  setQty,
}: {
  product: Product;
  products: Product[];
  cart: Cart;
  setQty: (key: string, q: number) => void;
}) {
  const [pick, setPick] = useState(() => initialPick(product));
  if (!pick) return null;
  const key = `${product.id}:${pick.pair.id}`;
  const qty = cart[key] ?? 0;
  const image = (id: string) => products.find((p) => p.id === id)?.image;
  const inBag = product.options.filter((o) => (cart[`${product.id}:${o.id}`] ?? 0) > 0);

  return (
    <article className="glass group flex flex-col rounded-[2rem] p-5 ring-2 ring-rose/30 transition hover:-translate-y-1 sm:col-span-2 lg:col-span-1">
      <div className="relative grid h-52 place-items-center">
        <div className="absolute inset-x-8 bottom-3 h-6 rounded-full bg-cocoa/15 blur-xl" />
        <span className="absolute top-0 left-0 z-10 rounded-full bg-rose px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">Mix &amp; match</span>
        <div className="relative flex h-full items-end justify-center">
          {pick.flavors.map((id, i) => (
            <Image
              key={id + i}
              src={image(id) ?? product.image}
              alt=""
              width={300}
              height={300}
              className={`pop-in max-h-44 w-auto object-contain drop-shadow-xl ${i === 0 ? "z-10 -mr-6 -rotate-6" : "-ml-6 mt-6 rotate-6"}`}
            />
          ))}
        </div>
      </div>
      <h3 className="font-display mt-4 text-2xl font-bold">{product.name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-cocoa-soft">{product.description}</p>
      <div className="mt-5 flex-1 space-y-3 rounded-2xl bg-surface/45 p-3">
        <MixPicker product={product} products={products} onPick={(pair, flavors) => setPick({ pair, flavors })} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold tracking-wide text-cocoa-soft uppercase">Box · two flavors</span>
          {qty === 0 ? (
            <button
              onClick={() => setQty(key, 1)}
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-cocoa px-4 py-2 text-sm font-bold text-cream transition hover:bg-rose hover:text-white active:scale-95"
            >
              <Plus className="size-4" /> Add
            </button>
          ) : (
            <Stepper qty={qty} onChange={(q) => setQty(key, q)} label={pick.pair.label} />
          )}
        </div>
      </div>
      {inBag.length > 0 && (
        <p className="mt-3 text-xs text-cocoa-soft">
          In your bag: {inBag.map((o) => `${cart[`${product.id}:${o.id}`]}× ${o.label}`).join(", ")}
        </p>
      )}
    </article>
  );
}

type Line = { key: string; quantity: number; product: Product; option: Product["options"][number]; image: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Outcome = { code: string } | { error: string } | { busy: true };

/**
 * Sends the order, quietly retrying network failures and server errors with backoff.
 * The same client_ref goes with every attempt, so the server never saves an order twice.
 */
async function sendOrder(payload: object, onAttempt: (n: number) => void): Promise<Outcome> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onAttempt(attempt);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.code) return { code: data.code };
      // Problems with what the customer typed won't fix themselves, so show them straight away
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)
        return { error: data.error ?? "Please check your details and try again." };
    } catch {
      // network error or timeout: retry
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_ATTEMPTS) await wait(700 * 2 ** (attempt - 1));
  }
  return { busy: true };
}

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
  const [attempt, setAttempt] = useState(0); // 0 = idle
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientRef] = useState(newRef);
  const submitting = attempt > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !submitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    const outcome = await sendOrder(
      {
        client_ref: clientRef,
        items: lines.map((l) => ({ product_id: l.product.id, option: l.option.id, quantity: l.quantity })),
        customer_name: form.get("name"),
        customer_email: form.get("email"),
        phone: form.get("phone"),
        address: form.get("address"),
        notes: form.get("notes"),
        payment_method: payment,
        payment_reference: form.get("reference"),
        website: form.get("website"),
      },
      setAttempt,
    );
    setAttempt(0);
    if ("code" in outcome) onPlaced(outcome.code);
    else if ("error" in outcome) setError(outcome.error);
    else setBusy(true);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Checkout">
      <button aria-label="Close checkout" onClick={() => !submitting && onClose()} className="absolute inset-0 bg-cocoa/25" />
      <div className="drawer-in glass-strong relative flex h-full w-full max-w-lg flex-col overflow-y-auto overscroll-contain rounded-l-[2rem] p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl font-bold">{placed ? "Order placed!" : "Your order"}</h2>
          <button aria-label="Close" onClick={onClose} disabled={submitting} className="grid size-11 place-items-center rounded-full bg-surface/70 hover:bg-blush">
            <X className="size-5" />
          </button>
        </div>

        {placed ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="pop-in grid size-20 place-items-center rounded-full bg-rose text-white shadow-lg shadow-rose/40">
              <Check className="size-10" />
            </div>
            <p className="font-display mt-6 text-2xl font-bold">Thank you!</p>
            <p className="mt-2 text-cocoa-soft">
              Your order <b className="text-cocoa">{placed.code}</b> for <b className="text-cocoa">{peso(placed.total)}</b> is in.
              We&apos;ll text you shortly to confirm the delivery time.
            </p>
            <button onClick={onClose} className="mt-8 rounded-full bg-cocoa px-6 py-3 font-bold text-cream hover:bg-rose hover:text-white">
              Back to the menu
            </button>
          </div>
        ) : lines.length === 0 ? (
          <p className="mt-10 text-center text-cocoa-soft">Your bag is empty.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-1 flex-col gap-6">
            <fieldset disabled={submitting} className="contents">
              <ul className="space-y-3">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-center gap-3 rounded-2xl bg-surface/50 p-2 pr-3">
                    <Image src={l.image} alt="" width={64} height={64} loading="eager" className="size-14 object-contain" />
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

              <div className="space-y-3">
                <p className="font-display mb-2 text-lg font-semibold">Delivery details</p>
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
                <input
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={120}
                  placeholder="Email (optional) — for your order confirmation"
                  className="field"
                />
                <textarea name="address" required maxLength={400} rows={3} autoComplete="street-address" placeholder="Complete delivery address" className="field resize-none" />
                <input name="notes" maxLength={300} placeholder="Notes (optional) — landmarks, preferred time…" className="field" />
                {/* Honeypot: real customers never see or fill this */}
                <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
              </div>

              <div>
                <p className="font-display mb-2 text-lg font-semibold">Payment</p>
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
                        payment === value ? "border-rose bg-surface/80 text-rose" : "border-transparent bg-surface/45 hover:bg-surface/65"
                      }`}
                    >
                      <input type="radio" name="payment" value={value} checked={payment === value} onChange={() => setPayment(value)} className="sr-only" />
                      <Icon className="size-6" />
                      {label}
                    </label>
                  ))}
                </div>
                {payment === "qr" && (
                  <div className="mt-4 flex flex-col items-center rounded-2xl bg-surface/70 p-5 text-center">
                    {/* The QR stays on white so every banking app can read it, in dark mode too */}
                    <div className="rounded-2xl bg-white p-3 shadow-sm">
                      <Image src="/images/payment-qr.jpg" alt="InstaPay QR code for Soft Baked Stories" width={452} height={440} className="w-48 sm:w-52" />
                    </div>
                    <p className="mt-3 text-sm text-cocoa-soft">
                      Scan with GCash, Maya or your bank app (InstaPay) and send exactly <b className="text-cocoa">{peso(total)}</b>.
                    </p>
                    {/* Customers ordering on their phone can't scan their own screen: save it and upload it in the app */}
                    <a
                      href="/images/payment-qr.jpg"
                      download="soft-baked-stories-instapay-qr.jpg"
                      className="mt-3 flex min-h-10 items-center gap-1.5 rounded-full bg-surface/80 px-4 text-sm font-bold text-rose active:scale-95"
                    >
                      <Download className="size-4" /> Save QR to upload in your app
                    </a>
                    <input name="reference" required maxLength={60} placeholder="Reference number from your payment" className="field mt-4 text-center" />
                    <p className="mt-2 text-xs text-cocoa-soft">We&apos;ll check your payment. Add your email above and we&apos;ll send a confirmation once it&apos;s received.</p>
                  </div>
                )}
              </div>
            </fieldset>

            <div className="mt-auto space-y-3">
              {error && <p className="rounded-2xl bg-rose/10 px-4 py-3 text-sm font-semibold text-rose-deep">{error}</p>}
              <div className="flex items-baseline justify-between">
                <span className="text-cocoa-soft">Total</span>
                <span className="font-display text-3xl font-bold">{peso(total)}</span>
              </div>
              <button
                disabled={submitting}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-rose py-4 text-lg font-bold text-white shadow-lg shadow-rose/30 transition hover:bg-rose-deep active:scale-[0.98] disabled:opacity-80"
              >
                {submitting && <span className="spinner" aria-hidden />}
                {submitting ? "Placing order…" : "Place order"}
              </button>
            </div>
          </form>
        )}

        {submitting && <PlacingOverlay attempt={attempt} />}
        {busy && <BusyDialog onClose={() => setBusy(false)} />}
      </div>
    </div>
  );
}

function PlacingOverlay({ attempt }: { attempt: number }) {
  return (
    <div className="fade-in absolute inset-0 z-10 flex flex-col items-center justify-center rounded-l-[2rem] bg-cream/70 text-center backdrop-blur-sm" role="status" aria-live="polite">
      <Image src="/images/choco-lava-muffin.png" alt="" width={120} height={124} className="muffin-bounce w-24 drop-shadow-xl" />
      <div className="mt-2 h-2 w-16 rounded-full bg-cocoa/15 blur-[2px]" />
      <p className="font-display mt-5 text-2xl font-bold">Placing your order…</p>
      <p className="mt-1 text-sm text-cocoa-soft">{attempt <= 1 ? "Just a moment." : "Still working on it, hang tight."}</p>
      <div className="mt-5 flex gap-1.5" aria-hidden>
        <span className="dot" />
        <span className="dot [animation-delay:150ms]" />
        <span className="dot [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function BusyDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fade-in absolute inset-0 z-20 grid place-items-center rounded-l-[2rem] bg-cocoa/30 p-6" role="alertdialog" aria-modal="true" aria-labelledby="busy-title">
      <div className="pop-in glass-strong w-full max-w-xs rounded-3xl p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-blush text-rose">
          <CloudOff className="size-7" />
        </div>
        <p id="busy-title" className="font-display mt-4 text-xl font-bold">
          The server may be busy
        </p>
        <p className="mt-1 text-sm text-cocoa-soft">Please try again in a few minutes! Your bag and details are saved.</p>
        <button onClick={onClose} autoFocus className="mt-5 w-full rounded-full bg-rose py-3 font-bold text-white active:scale-[0.98]">
          Okay
        </button>
      </div>
    </div>
  );
}
