"use client";

import { useState, useTransition } from "react";
import { Check, Mail, Monitor, Moon, Sun, TriangleAlert } from "lucide-react";
import type { ThemeMode } from "@/lib/catalog";
import { purgeOrders, resetMenu, saveTheme } from "@/app/admin/settings-actions";

const THEMES: { value: ThemeMode; label: string; hint: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", hint: "Always light", icon: Sun },
  { value: "dark", label: "Dark", hint: "Always dark", icon: Moon },
  { value: "auto", label: "Automatic", hint: "Follows each visitor's device", icon: Monitor },
];

type EmailStatus = { ready: boolean; from: string | null; alertsTo: string | null };

export default function SettingsPanel({ theme, email }: { theme: ThemeMode; email: EmailStatus }) {
  const [selected, setSelected] = useState(theme);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(value: ThemeMode) {
    const previous = selected;
    setSelected(value);
    // Preview straight away; the server re-renders with the saved theme
    document.documentElement.dataset.theme = value;
    setError(null);
    start(async () => {
      const res = await saveTheme(value);
      if (res.error) {
        setError(res.error);
        setSelected(previous);
        document.documentElement.dataset.theme = previous;
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      <section className="glass rounded-[2rem] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Appearance</h2>
            <p className="text-sm text-cocoa-soft">Applies to the whole site: the shop and this dashboard.</p>
          </div>
          {pending && <span className="spinner spinner-dark size-5" aria-label="Saving" />}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
          {THEMES.map(({ value, label, hint, icon: Icon }) => {
            const on = selected === value;
            return (
              <button
                key={value}
                role="radio"
                aria-checked={on}
                onClick={() => !on && choose(value)}
                className={`relative flex min-h-24 flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition active:scale-[0.98] ${
                  on ? "border-rose bg-surface/80" : "border-transparent bg-surface/45 hover:bg-surface/65"
                }`}
              >
                <Icon className={`size-6 ${on ? "text-rose" : "text-cocoa-soft"}`} />
                <span className="font-bold">{label}</span>
                <span className="text-xs text-cocoa-soft">{hint}</span>
                {on && <Check className="absolute top-3 right-3 size-5 text-rose" />}
              </button>
            );
          })}
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-rose-deep">{error}</p>}
      </section>

      <section className="glass rounded-[2rem] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Mail className="size-5 text-rose" />
          <h2 className="font-display text-xl font-semibold">Emails</h2>
          <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${email.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {email.ready ? "On" : "Not set up"}
          </span>
        </div>
        {email.ready ? (
          <ul className="mt-3 space-y-1 text-sm text-cocoa-soft">
            {email.from && (
              <li>
                Sent from <b className="text-cocoa">{email.from}</b>
              </li>
            )}
            {email.alertsTo && (
              <li>
                New-order alerts go to <b className="text-cocoa">{email.alertsTo}</b>
              </li>
            )}
            <li>Customers who leave an email get an order confirmation, and a payment confirmation when a QR order is marked Paid.</li>
          </ul>
        ) : (
          <p className="mt-3 text-sm text-cocoa-soft">
            Orders still work, but no emails are sent. Add <code className="rounded bg-surface/70 px-1">GMAIL_USER</code> and{" "}
            <code className="rounded bg-surface/70 px-1">GMAIL_APP_PASSWORD</code> in Vercel&apos;s environment variables, then redeploy. SETUP.md has the steps.
          </p>
        )}
      </section>

      <section className="glass rounded-[2rem] p-5 ring-2 ring-rose-deep/30 sm:p-6">
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-rose-deep" />
          <h2 className="font-display text-xl font-semibold">Danger zone</h2>
        </div>
        <p className="mt-1 text-sm text-cocoa-soft">These can&apos;t be undone.</p>
        <div className="mt-5 space-y-4">
          <DangerAction
            title="Delete all orders"
            body="Removes every order (including finance history) and restarts numbering at SBS-0001."
            word="DELETE"
            button="Delete all orders"
            run={purgeOrders}
          />
          <DangerAction
            title="Reset the menu"
            body="Deletes products you've added and restores the original six with their original prices and photos."
            word="RESET"
            button="Reset menu"
            run={resetMenu}
          />
        </div>
      </section>
    </div>
  );
}

function DangerAction({
  title,
  body,
  word,
  button,
  run,
}: {
  title: string;
  body: string;
  word: string;
  button: string;
  run: (confirm: string) => Promise<{ error?: string }>;
}) {
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="rounded-2xl bg-surface/45 p-4">
      <p className="font-bold">{title}</p>
      <p className="mt-0.5 text-sm text-cocoa-soft">{body}</p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          start(async () => {
            const res = await run(typed);
            setMessage(res.error ? { ok: false, text: res.error } : { ok: true, text: "Done." });
            if (!res.error) setTyped("");
          });
        }}
      >
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value.toUpperCase())}
          placeholder={`Type ${word} to confirm`}
          aria-label={`Type ${word} to confirm`}
          autoCapitalize="characters"
          autoComplete="off"
          className="field min-w-0 flex-1 text-sm"
        />
        <button
          disabled={typed !== word || pending}
          className="flex min-h-12 items-center gap-2 rounded-full bg-rose-deep px-5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-40"
        >
          {pending && <span className="spinner size-4" />}
          {button}
        </button>
      </form>
      {message && <p className={`mt-2 text-sm font-semibold ${message.ok ? "text-emerald-600" : "text-rose-deep"}`}>{message.text}</p>}
    </div>
  );
}
