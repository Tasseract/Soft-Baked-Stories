import { getAllProducts, orderable } from "@/lib/catalog";
import Pos from "@/components/admin/Pos";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  // Hidden products are included: the owner can still ring them up
  const products = orderable(await getAllProducts({ fresh: true }), { includeHidden: true });
  return <Pos products={products} />;
}
