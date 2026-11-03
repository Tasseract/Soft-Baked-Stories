"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, PiggyBank } from "lucide-react";

const links = [
  { href: "/admin", label: "Orders", icon: ClipboardList },
  { href: "/admin/finance", label: "Finance", icon: PiggyBank },
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
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
              active ? "bg-rose text-white shadow" : "text-cocoa-soft hover:bg-white/60 hover:text-cocoa"
            }`}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
    </div>
  );
}
