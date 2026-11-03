"use client";

import Image from "next/image";
import { useActionState } from "react";
import { Lock } from "lucide-react";
import { login } from "../actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form action={action} className="glass-strong w-full max-w-sm rounded-[2rem] p-8 text-center">
        <Image src="/images/logo.png" alt="Soft Baked Stories" width={186} height={53} priority className="mx-auto h-12 w-auto" />
        <h1 className="font-display mt-6 text-2xl font-bold">Kitchen dashboard</h1>
        <p className="mt-1 text-sm text-cocoa-soft">Owner sign-in</p>
        <div className="relative mt-6">
          <Lock className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-cocoa-soft" />
          <input name="password" type="password" required autoFocus autoComplete="current-password" placeholder="Password" className="field pl-10" />
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-rose-deep">{error}</p>}
        <button disabled={pending} className="mt-5 w-full rounded-full bg-rose py-3 font-bold text-white hover:bg-rose-deep disabled:opacity-60">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
