"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, PiggyBank, Settings, UtensilsCrossed } from "lucide-react";

const links = [
  { href: "/admin", label: "Orders", icon: ClipboardList },
  { href: "/admin/finance", label: "Finance", icon: PiggyBank },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <div className="flex gap-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-bold transition active:scale-95 sm:px-4 ${
              active ? "bg-rose text-white shadow" : "text-cocoa-soft hover:bg-surface/60 hover:text-cocoa"
            }`}
          >
            <Icon className="size-5 sm:size-4" /> <span className={active ? "" : "hidden md:inline"}>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
