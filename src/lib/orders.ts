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
