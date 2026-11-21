import { getTheme } from "@/lib/catalog";
import { emailConfigured } from "@/lib/email";
import SettingsPanel from "@/components/admin/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const email = {
    ready: emailConfigured(),
    from: process.env.GMAIL_USER ?? null,
    alertsTo: process.env.ORDER_EMAIL_TO || process.env.GMAIL_USER || null,
  };
  return <SettingsPanel theme={await getTheme()} email={email} />;
}
