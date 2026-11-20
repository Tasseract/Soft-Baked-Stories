export type OrderItem = {
  product_id: string;
  name: string;
  option: string;
  option_label: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type Order = {
  id: string;
  order_number: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  customer_name: string;
  phone: string;
  address: string;
  notes: string | null;
  payment_method: "cod" | "qr";
  payment_reference: string | null;
  payment_status: PaymentStatus;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  delivery_status: DeliveryStatus;
  source?: OrderSource;
};

export const ORDER_SOURCES = ["website", "messenger", "facebook", "instagram", "tiktok", "phone", "walk_in", "other"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const SOURCE_LABEL: Record<OrderSource, string> = {
  website: "Website",
  messenger: "Messenger",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  phone: "Text / call",
  walk_in: "Walk-in",
  other: "Other",
};

export const ORDER_STATUSES = ["new", "confirmed", "baking", "ready", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DELIVERY_STATUSES = ["pending", "out_for_delivery", "delivered"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus | DeliveryStatus | PaymentStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  baking: "Baking",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Not dispatched",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  unpaid: "Unpaid",
  paid: "Paid",
};

export const PAYMENT_LABEL = { cod: "Cash on delivery", qr: "QR payment" } as const;

export const orderCode = (n: number) => "SBS-" + String(n).padStart(4, "0");

export type OrderPatch = Partial<Pick<Order, "status" | "delivery_status" | "payment_status">>;

/**
 * Validates a status change and fills in what follows from it. Shared by the dashboard
 * (for instant on-screen updates) and the server (which has the final say).
 */
export function applyOrderPatch(
  current: Pick<Order, "status" | "delivery_status" | "payment_method">,
  patch: OrderPatch,
): { patch: OrderPatch } | { error: string } {
  const next: OrderPatch = {};
  if (patch.status && (ORDER_STATUSES as readonly string[]).includes(patch.status)) next.status = patch.status;
  if (patch.delivery_status && (DELIVERY_STATUSES as readonly string[]).includes(patch.delivery_status))
    next.delivery_status = patch.delivery_status;
  if (patch.payment_status && (PAYMENT_STATUSES as readonly string[]).includes(patch.payment_status))
    next.payment_status = patch.payment_status;

  const status = next.status ?? current.status;
  const delivery = next.delivery_status ?? current.delivery_status;
  if (status === "completed" && delivery !== "delivered") {
    return {
      error: next.status
        ? "Mark the order as delivered before completing it."
        : "This order is completed. Move it back to Ready before changing delivery.",
    };
  }
  // Cash on delivery is collected at the door, so a completed COD order is paid
  if (next.status === "completed" && current.payment_method === "cod") next.payment_status = "paid";
  return { patch: next };
}
