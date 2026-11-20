"use client";

import { Minus, Plus } from "lucide-react";

export default function Stepper({ qty, onChange, label }: { qty: number; onChange: (q: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-surface/80 p-1 shadow-sm">
      <button aria-label={`Remove one ${label}`} onClick={() => onChange(qty - 1)} className="grid size-9 place-items-center rounded-full hover:bg-blush active:scale-90">
        <Minus className="size-4" />
      </button>
      <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
      <button
        aria-label={`Add one ${label}`}
        onClick={() => onChange(qty + 1)}
        className="grid size-9 place-items-center rounded-full bg-rose text-white hover:bg-rose-deep active:scale-90"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
