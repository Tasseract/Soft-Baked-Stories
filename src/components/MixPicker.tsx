"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { flavorName, peso, type Option, type Product } from "@/lib/menu";

type Pair = Option & { mix: [string, string] };

/** The flavors on offer and, for each, the pairings it can go in */
export function useMixPairs(product: Product) {
  const pairs = product.options.filter((o): o is Pair => !!o.mix);
  const flavors = [...new Set(pairs.flatMap((p) => p.mix))];
  const partnersOf = (a: string) =>
    pairs.filter((p) => p.mix.includes(a)).map((p) => ({ id: p.mix[0] === a ? p.mix[1] : p.mix[0], pair: p }));
  return { pairs, flavors, partnersOf };
}

/**
 * "[ flavor ▾ ] + [ flavor ▾ ] = ₱price". The second list only offers flavors that
 * pair with the first, so every choice has a price.
 */
export default function MixPicker({
  product,
  products,
  onPick,
  size = "md",
}: {
  product: Product;
  products: Product[];
  onPick: (pair: Pair, flavors: [string, string]) => void;
  size?: "md" | "lg";
}) {
  const mixPairs = useMixPairs(product);
  const { pairs, partnersOf } = mixPairs;
  // List flavors in menu order
  const rank = (id: string) => products.findIndex((p) => p.id === id);
  const flavors = [...mixPairs.flavors].sort((x, y) => rank(x) - rank(y));
  // Starts on the first pairing, matching initialPick()
  const [a, setA] = useState(pairs[0]?.mix[0]);
  const [b, setB] = useState(pairs[0]?.mix[1]);
  const name = (id: string) => flavorName(products.find((p) => p.id === id)?.name ?? id);

  const partners = partnersOf(a);
  const current = partners.find((p) => p.id === b) ?? partners[0];

  function pickA(next: string) {
    setA(next);
    const options = partnersOf(next);
    const keep = options.find((p) => p.id === b) ?? options[0];
    setB(keep?.id);
    if (keep) onPick(keep.pair, [next, keep.id]);
  }
  function pickB(next: string) {
    setB(next);
    const pair = partnersOf(a).find((p) => p.id === next);
    if (pair) onPick(pair.pair, [a, next]);
  }

  if (!pairs.length || !current) return null;
  const text = size === "lg" ? "text-base" : "text-sm";

  return (
    // Two rows ("A +" / "B = ₱") in narrow cards, one row when there's room
    <div className="@container">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 @md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
      <Select value={a} onChange={pickA} label="First flavor" className={text}>
        {flavors.map((id) => (
          <option key={id} value={id}>
            {name(id)}
          </option>
        ))}
      </Select>
      <span className="font-display w-5 text-center text-xl font-bold text-rose">+</span>
      <Select value={current.id} onChange={pickB} label="Second flavor" className={text}>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>
            {name(p.id)}
          </option>
        ))}
      </Select>
      <span className="font-display text-2xl font-bold whitespace-nowrap text-rose tabular-nums">
        <span className="mr-2 text-xl">=</span>
        {peso(current.pair.price)}
      </span>
    </div>
    </div>
  );
}

/** Restores the pairing the picker currently shows, so the parent knows it before any change */
export function initialPick(product: Product) {
  const pairs = product.options.filter((o): o is Pair => !!o.mix);
  const first = pairs[0];
  return first ? { pair: first, flavors: first.mix } : null;
}

function Select({
  value,
  onChange,
  label,
  className,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="relative min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`field min-h-11 cursor-pointer appearance-none pr-9 font-bold ${className ?? ""}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-cocoa-soft" />
    </label>
  );
}
