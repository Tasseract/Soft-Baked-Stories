import { getTheme } from "@/lib/catalog";
import SettingsPanel from "@/components/admin/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  return <SettingsPanel theme={await getTheme()} />;
}
