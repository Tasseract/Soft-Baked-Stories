// Shown instead of the dashboard when Supabase isn't reachable yet, with the likely fix
export default function SetupNotice({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error);
  const missingTable = /orders|products|settings|relation|schema cache|PGRST205/i.test(message);
  return (
    <div className="glass mx-auto max-w-xl rounded-[2rem] p-8">
      <h1 className="font-display text-2xl font-bold">Almost there</h1>
      <p className="mt-2 text-cocoa-soft">The dashboard can&apos;t reach the order database yet.</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
        {missingTable ? (
          <li>
            Run <code className="rounded bg-surface/70 px-1">supabase/schema.sql</code> in Supabase → SQL Editor to create the orders table.
          </li>
        ) : (
          <li>
            Check <code className="rounded bg-surface/70 px-1">SUPABASE_URL</code> and <code className="rounded bg-surface/70 px-1">SUPABASE_SECRET_KEY</code> in your
            environment variables.
          </li>
        )}
      </ul>
      <p className="mt-4 rounded-xl bg-surface/60 p-3 font-mono text-xs break-all text-cocoa-soft">{message}</p>
    </div>
  );
}
