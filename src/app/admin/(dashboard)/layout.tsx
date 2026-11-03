import Image from "next/image";
import Link from "next/link";
import { LogOut, Store } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions";
import AdminNav from "@/components/admin/AdminNav";
import AutoRefresh from "@/components/admin/AutoRefresh";

export const metadata = { title: "Dashboard · Soft Baked Stories", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <header className="sticky top-0 z-30 pt-4">
        <nav className="glass flex items-center justify-between gap-2 rounded-full px-3 py-2 sm:px-5">
          <div className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="Soft Baked Stories" width={186} height={53} className="hidden h-9 w-auto sm:block" />
            <AdminNav />
          </div>
          <div className="flex items-center gap-1">
            <Link href="/" className="grid size-10 place-items-center rounded-full hover:bg-white/60" title="View shop">
              <Store className="size-5" />
            </Link>
            <form action={logout}>
              <button className="grid size-10 place-items-center rounded-full hover:bg-white/60" title="Sign out">
                <LogOut className="size-5" />
              </button>
            </form>
          </div>
        </nav>
      </header>
      <AutoRefresh seconds={30} />
      <main className="pt-8">{children}</main>
    </div>
  );
}
