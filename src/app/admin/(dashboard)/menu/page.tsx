import { db } from "@/lib/supabase";
import { toProduct, type ProductRow } from "@/lib/catalog";
import SetupNotice from "@/components/admin/SetupNotice";
import MenuEditor from "@/components/admin/MenuEditor";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  // Read straight from the database (not the storefront cache) so edits always show here
  const { data, error } = await db().from("products").select("*").order("sort_order").order("created_at");
  if (error) return <SetupNotice error={error} />;
  const products = (data as ProductRow[]).map(toProduct);
  const categories = [...new Set(["Muffins", "Breads", ...products.map((p) => p.category)])];
  return <MenuEditor products={products} categories={categories} />;
}
