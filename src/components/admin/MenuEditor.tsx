"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Blend, Camera, Check, ChevronDown, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { PLACEHOLDER_IMAGE, flavorName, isMixProduct, type Product } from "@/lib/menu";
import { deleteProduct, reorderProducts, saveProduct, uploadProductImage, type ProductInput } from "@/app/admin/menu-actions";

type Draft = ProductInput & { key: string };
type Flavor = { id: string; name: string; image: string };

const blank = (key: string): Draft => ({
  key,
  name: "",
  description: "",
  category: "Muffins",
  active: true,
  options: [{ label: "Per piece", price: 0 }],
});

const blankMix = (key: string, flavors: Flavor[]): Draft => ({
  key,
  name: "Mix & Match Box",
  description: "Can't pick just one? Choose two muffin flavors and we'll pack them together in one box.",
  category: "Muffins",
  active: true,
  options: flavors.length >= 2 ? [{ label: "", price: 0, mix: [flavors[0].id, flavors[1].id] }] : [],
});

const newKey = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(36);

const toInput = (p: Product): ProductInput => ({
  id: p.id,
  name: p.name,
  description: p.description,
  category: p.category,
  active: p.active !== false,
  options: p.options.map((o) => ({ ...o })),
});

export default function MenuEditor({ products, categories }: { products: Product[]; categories: string[] }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [ordered, setOrdered] = useOptimistic(products, (_cur, next: Product[]) => next);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Flavors a mix & match box can pair up: every regular product
  const flavors: Flavor[] = products.filter((p) => !isMixProduct(p)).map((p) => ({ id: p.id, name: flavorName(p.name), image: p.image }));

  function move(index: number, dir: -1 | 1) {
    const next = [...ordered];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    startTransition(async () => {
      setOrdered(next);
      const res = await reorderProducts(next.map((p) => p.id));
      setError(res.error ?? null);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Menu</h1>
          <p className="mt-1 text-sm text-cocoa-soft">Changes show on the shop as soon as you save. Past orders keep the price they were placed at.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDrafts((d) => [blankMix(newKey(), flavors), ...d])}
            disabled={flavors.length < 2}
            className="glass flex min-h-12 items-center gap-2 rounded-full px-5 font-bold transition active:scale-95 disabled:opacity-40"
          >
            <Blend className="size-5 text-rose" /> Add mix box
          </button>
          <button
            onClick={() => setDrafts((d) => [blank(newKey()), ...d])}
            className="flex min-h-12 items-center gap-2 rounded-full bg-rose px-5 font-bold text-white shadow-lg shadow-rose/30 transition hover:bg-rose-deep active:scale-95"
          >
            <Plus className="size-5" /> Add product
          </button>
        </div>
      </div>
      {error && <p className="mt-4 rounded-2xl bg-rose/10 px-4 py-3 text-sm font-semibold text-rose-deep">{error}</p>}

      <datalist id="categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {drafts.map((d) => (
          <ProductEditor
            key={d.key}
            initial={d}
            image={PLACEHOLDER_IMAGE}
            flavors={flavors}
            onDiscard={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}
            onCreated={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}
          />
        ))}
        {ordered.map((p, i) => (
          <ProductEditor
            key={p.id}
            initial={toInput(p)}
            image={p.image}
            flavors={flavors.filter((f) => f.id !== p.id)}
            onMove={(dir) => move(i, dir)}
            canMoveUp={i > 0}
            canMoveDown={i < ordered.length - 1}
          />
        ))}
      </div>
    </>
  );
}

function ProductEditor({
  initial,
  image,
  flavors,
  onMove,
  canMoveUp,
  canMoveDown,
  onDiscard,
  onCreated,
}: {
  initial: ProductInput;
  image: string;
  flavors: Flavor[];
  onMove?: (dir: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onDiscard?: () => void;
  onCreated?: () => void;
}) {
  const [form, setForm] = useState<ProductInput>(initial);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !initial.id;
  const initialJson = JSON.stringify(initial);
  const dirty = JSON.stringify(form) !== initialJson;

  // After a save the server sends back the tidied-up product (trimmed names, pairing labels);
  // take it as the new starting point unless the owner has kept typing since
  const savedSnapshot = useRef<string | null>(null);
  useEffect(() => {
    if (savedSnapshot.current !== null && savedSnapshot.current === JSON.stringify(form)) {
      savedSnapshot.current = null;
      setForm(JSON.parse(initialJson));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the saved product comes back
  }, [initialJson]);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: v }));
  };
  const setOption = (i: number, patch: Partial<ProductInput["options"][number]>) =>
    set(
      "options",
      form.options.map((o, n) => (n === i ? { ...o, ...patch } : o)),
    );

  function save() {
    setError(null);
    savedSnapshot.current = JSON.stringify(form);
    startSave(async () => {
      const res = await saveProduct(form);
      if (res.error) {
        savedSnapshot.current = null;
        return setError(res.error);
      }
      setSaved(true);
      if (isNew) onCreated?.();
    });
  }

  function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    startSave(async () => {
      const res = await deleteProduct(initial.id!);
      if (res.error) setError(res.error);
    });
  }

  const hidden = !form.active;
  const mix = form.options.some((o) => o.mix);

  return (
    <article className={`glass flex flex-col gap-4 rounded-[2rem] p-5 sm:p-6 ${isNew ? "ring-2 ring-rose/50" : ""} ${hidden ? "opacity-80" : ""}`}>
      <div className="flex gap-4">
        {mix ? (
          <div className="flex w-28 shrink-0 flex-col items-center gap-1.5 sm:w-32">
            <div className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl bg-surface/50">
              <Blend className="size-10 text-rose" />
            </div>
            <p className="text-center text-[11px] leading-tight text-cocoa-soft">The shop shows the two chosen flavors&apos; photos</p>
          </div>
        ) : (
          <PhotoPicker productId={initial.id} image={image} />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={80}
            placeholder="Product name"
            aria-label="Product name"
            className="field font-display text-lg font-bold"
          />
          <input
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            list="categories"
            maxLength={30}
            placeholder="Category"
            aria-label="Category"
            className="field text-sm"
          />
          <button
            onClick={() => set("active", !form.active)}
            className={`flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-bold transition active:scale-95 ${
              hidden ? "bg-surface/50 text-cocoa-soft" : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {hidden ? "Hidden from shop" : "Shown on shop"}
          </button>
        </div>
      </div>

      <textarea
        value={form.description}
        onChange={(e) => set("description", e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Short description customers will see"
        aria-label="Description"
        className="field resize-none text-sm"
      />

      {mix ? (
        <PairsEditor options={form.options} flavors={flavors} onChange={(options) => set("options", options)} />
      ) : (
      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-cocoa-soft uppercase">Sizes &amp; prices</p>
        <div className="space-y-2">
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o.label}
                onChange={(e) => setOption(i, { label: e.target.value })}
                maxLength={30}
                placeholder="e.g. Box of 6"
                aria-label="Size name"
                className="field min-w-0 flex-1 text-sm"
              />
              <label className="relative w-32 shrink-0">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-bold text-cocoa-soft">₱</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100000}
                  value={o.price || ""}
                  onChange={(e) => setOption(i, { price: Number(e.target.value) })}
                  placeholder="0"
                  aria-label={`Price for ${o.label || "this size"}`}
                  className="field pl-7 text-right font-bold tabular-nums"
                />
              </label>
              <button
                onClick={() => set("options", form.options.filter((_, n) => n !== i))}
                disabled={form.options.length === 1}
                aria-label={`Remove ${o.label || "size"}`}
                className="grid size-11 shrink-0 place-items-center rounded-full text-cocoa-soft hover:bg-surface/60 hover:text-rose-deep disabled:opacity-30"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => set("options", [...form.options, { label: "", price: 0 }])}
          className="mt-2 flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-rose hover:bg-surface/50"
        >
          <Plus className="size-4" /> Add size
        </button>
      </div>
      )}

      {error && <p className="rounded-2xl bg-rose/10 px-4 py-2.5 text-sm font-semibold text-rose-deep">{error}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-surface/60 pt-4">
        {isNew ? (
          <button onClick={onDiscard} className="min-h-11 rounded-full px-4 text-sm font-bold text-cocoa-soft hover:bg-surface/50">
            Discard
          </button>
        ) : (
          <>
            <button
              onClick={() => onMove?.(-1)}
              disabled={!canMoveUp}
              aria-label="Move up"
              className="grid size-11 place-items-center rounded-full bg-surface/50 transition active:scale-90 disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
            <button
              onClick={() => onMove?.(1)}
              disabled={!canMoveDown}
              aria-label="Move down"
              className="grid size-11 place-items-center rounded-full bg-surface/50 transition active:scale-90 disabled:opacity-30"
            >
              <ArrowDown className="size-4" />
            </button>
            <button
              onClick={remove}
              disabled={saving}
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition active:scale-95 ${
                confirmDelete ? "bg-rose-deep text-white" : "text-cocoa-soft hover:bg-surface/50 hover:text-rose-deep"
              }`}
            >
              <Trash2 className="size-4" /> {confirmDelete ? "Tap again to delete" : "Delete"}
            </button>
          </>
        )}
        <span className="flex-1" />
        {saved && !dirty && (
          <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
            <Check className="size-4" /> Saved
          </span>
        )}
        <button
          onClick={save}
          disabled={saving || (!dirty && !isNew)}
          className="flex min-h-12 items-center gap-2 rounded-full bg-cocoa px-6 font-bold text-cream transition active:scale-95 disabled:opacity-40"
        >
          {saving && <span className="spinner spinner-cream size-4" />}
          {isNew ? "Add to menu" : "Save"}
        </button>
      </div>
    </article>
  );
}

/** Shrinks a photo in the browser before upload: faster on mobile data and well under the upload limit */
async function shrinkImage(file: File, maxSide = 900): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
    if (!blob) return file;
    // Browsers that can't make WebP hand back PNG instead
    const type = blob.type || "image/png";
    return new File([blob], `photo.${type.split("/")[1]}`, { type });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoPicker({ productId, image }: { productId?: string; image: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(file: File | undefined) {
    if (!file || !productId) return;
    setError(null);
    const local = URL.createObjectURL(file);
    setPreview(local);
    startUpload(async () => {
      const form = new FormData();
      form.set("id", productId);
      form.set("file", await shrinkImage(file));
      const res = await uploadProductImage(form);
      setPreview(res.url ?? null);
      if (res.error) setError(res.error);
      URL.revokeObjectURL(local);
    });
  }

  return (
    <div className="flex w-28 shrink-0 flex-col items-center gap-1.5 sm:w-32">
      <button
        onClick={() => input.current?.click()}
        disabled={!productId || uploading}
        className="group relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl bg-surface/50 transition active:scale-95"
        aria-label="Change photo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- previews include local blob: URLs */}
        <img src={preview ?? image} alt="" className="size-full object-contain p-1.5" />
        {productId && (
          <span className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded-full bg-cocoa/75 py-1 text-[11px] font-bold text-cream">
            {uploading ? <span className="spinner spinner-cream size-3" /> : <Camera className="size-3.5" />}
            {uploading ? "Uploading" : "Change"}
          </span>
        )}
      </button>
      {!productId && <p className="text-center text-[11px] leading-tight text-cocoa-soft">Add a photo after saving</p>}
      {error && <p className="text-center text-[11px] leading-tight font-semibold text-rose-deep">{error}</p>}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

type PairOption = ProductInput["options"][number];

/** Rows of "[flavor ▾] + [flavor ▾] = ₱price" for a mix & match box */
function PairsEditor({ options, flavors, onChange }: { options: PairOption[]; flavors: Flavor[]; onChange: (o: PairOption[]) => void }) {
  const key = (o: PairOption) => [...(o.mix ?? [])].sort().join("|");
  const update = (i: number, patch: Partial<PairOption>) => onChange(options.map((o, n) => (n === i ? { ...o, ...patch } : o)));

  function addPair() {
    const used = new Set(options.map(key));
    for (const a of flavors)
      for (const b of flavors)
        if (a.id !== b.id && !used.has([a.id, b.id].sort().join("|"))) return onChange([...options, { label: "", price: 0, mix: [a.id, b.id] }]);
  }

  const counts = new Map<string, number>();
  options.forEach((o) => counts.set(key(o), (counts.get(key(o)) ?? 0) + 1));

  return (
    <div>
      <p className="mb-2 text-xs font-bold tracking-wide text-cocoa-soft uppercase">Flavor pairings &amp; prices</p>
      <div className="space-y-2">
        {options.map((o, i) => {
          const [a, b] = o.mix ?? ["", ""];
          const problem = a === b ? "Pick two different flavors" : (counts.get(key(o)) ?? 0) > 1 ? "Listed twice" : null;
          return (
            <div key={i}>
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <FlavorSelect value={a} flavors={flavors} onChange={(v) => update(i, { mix: [v, b] })} />
                <span className="font-display text-lg font-bold text-rose">+</span>
                <FlavorSelect value={b} flavors={flavors} onChange={(v) => update(i, { mix: [a, v] })} />
                <span className="font-display text-lg font-bold text-rose">=</span>
                <label className="relative w-28 shrink-0">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-bold text-cocoa-soft">₱</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100000}
                    value={o.price || ""}
                    onChange={(e) => update(i, { price: Number(e.target.value) })}
                    placeholder="0"
                    aria-label="Price for this pairing"
                    className="field pl-7 text-right font-bold tabular-nums"
                  />
                </label>
                <button
                  onClick={() => onChange(options.filter((_, n) => n !== i))}
                  disabled={options.length === 1}
                  aria-label="Remove pairing"
                  className="grid size-11 shrink-0 place-items-center rounded-full text-cocoa-soft hover:bg-surface/60 hover:text-rose-deep disabled:opacity-30"
                >
                  <X className="size-4" />
                </button>
              </div>
              {problem && <p className="mt-1 text-xs font-semibold text-rose-deep">{problem}</p>}
            </div>
          );
        })}
      </div>
      <button onClick={addPair} className="mt-2 flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-rose hover:bg-surface/50">
        <Plus className="size-4" /> Add pairing
      </button>
    </div>
  );
}

function FlavorSelect({ value, flavors, onChange }: { value: string; flavors: Flavor[]; onChange: (v: string) => void }) {
  return (
    <label className="relative min-w-0 flex-1 basis-32">
      <span className="sr-only">Flavor</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field min-h-11 cursor-pointer appearance-none pr-8 text-sm font-bold">
        {!flavors.some((f) => f.id === value) && <option value={value}>(removed flavor)</option>}
        {flavors.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-cocoa-soft" />
    </label>
  );
}
