// A stand-in for Supabase (tables, RPC, Storage) with sample orders, for trying the app
// without touching real data. Used by `npm run dev:mock`. Everything resets when it stops.
//
//   GET /__fail?n=3  makes the next 3 order saves fail, to try out checkout retries
import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_PORT || 54399);

const menu = [
  ["choco-lava-muffin", "Choco Lava Muffins", "Choco Lava", [["pc", "Per piece", 55], ["box", "Box", 120]]],
  ["carrot-muffin", "Carrot Muffins", "Carrot", [["pc", "Per piece", 75], ["box", "Box", 150]]],
  ["banana-muffin", "Banana Muffins", "Banana", [["pc", "Per piece", 55], ["box", "Box", 120]]],
  ["smores-banana-muffin", "S'mores Banana Muffins", "S'mores Banana", [["pc", "Per piece", 80], ["box", "Box", 150]]],
  ["smores-banana-bread", "S'mores Banana Bread", "", [["loaf", "Loaf", 185]]],
  ["banana-bread", "Banana Bread", "", [["loaf", "Loaf", 120]]],
];
const now = () => new Date().toISOString();

const products = menu.map(([id, name, , opts], i) => ({
  id, name, description: `Sample description for ${name}.`, category: id.includes("bread") ? "Breads" : "Muffins",
  image_url: `/images/${id}.png`, options: opts.map(([oid, label, price]) => ({ id: oid, label, price })),
  active: true, sort_order: (i + 1) * 10, created_at: now(), updated_at: now(),
}));
const short = Object.fromEntries(menu.map(([id, , s]) => [id, s]));
const pair = (a, b, price) => ({ id: "mix-" + [a, b].sort().join("--"), label: `${short[a]} + ${short[b]}`, price, mix: [a, b] });
products.push({
  id: "mix-and-match-box", name: "Mix & Match Box", description: "Choose two flavors in one box.", category: "Muffins", image_url: null,
  options: [
    pair("smores-banana-muffin", "banana-muffin", 120),
    pair("smores-banana-muffin", "choco-lava-muffin", 120),
    pair("smores-banana-muffin", "carrot-muffin", 150),
    pair("carrot-muffin", "banana-muffin", 120),
    pair("carrot-muffin", "choco-lava-muffin", 120),
  ],
  active: true, sort_order: 45, created_at: now(), updated_at: now(),
});

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const names = ["Maria Santos", "Juan dela Cruz", "Ana Reyes", "Paolo Garcia", "Bea Mendoza", "Carlo Lim"];
const orders = [];
for (let n = 1; n <= 24; n++) {
  const items = [];
  for (const [id, name, , opts] of [pick(menu), pick(menu)]) {
    const [opt, label, price] = pick(opts);
    if (items.some((i) => i.product_id === id && i.option === opt)) continue;
    const q = 1 + Math.floor(rnd() * 3);
    items.push({ product_id: id, name, option: opt, option_label: label, unit_price: price, quantity: q, line_total: q * price });
  }
  const created = new Date(Date.now() - (24 - n) * 1.1 * 86400000);
  const status = n > 19 ? ["new", "confirmed", "baking", "ready", "ready"][n - 20] : pick(["completed", "completed", "completed", "cancelled"]);
  const pm = rnd() > 0.55 ? "qr" : "cod";
  orders.push({
    id: randomUUID(), order_number: n, created_at: created.toISOString(), updated_at: created.toISOString(),
    completed_at: status === "completed" ? new Date(created.getTime() + 5 * 3600000).toISOString() : null,
    customer_name: pick(names), phone: `0917 ${100 + n} 45${10 + n}`, address: `${10 + n} Mabini St, Brgy. San Antonio, Pasig City`,
    notes: rnd() > 0.7 ? "Near the blue gate, please call on arrival" : null,
    payment_method: pm, payment_reference: pm === "qr" ? "GC" + (8800000 + n * 137) : null,
    payment_status: status === "completed" || pm === "qr" ? "paid" : "unpaid",
    items, total: items.reduce((s, i) => s + i.line_total, 0), status, client_ref: null, source: pick(["website", "website", "messenger"]),
    delivery_status: status === "completed" ? "delivered" : n === 24 ? "out_for_delivery" : "pending",
  });
}
const tables = { orders, products, settings: [{ key: "theme", value: "light", updated_at: now() }] };
const files = new Map();
let failNext = 0;

const match = (r, k, v) => {
  const neg = v.startsWith("not.");
  if (neg) v = v.slice(4);
  const [op, ...rest] = v.split(".");
  const val = rest.join(".");
  let ok = true;
  if (op === "eq") ok = String(r[k]) === val;
  else if (op === "neq") ok = String(r[k]) !== val;
  else if (op === "in") ok = val.replace(/[()]/g, "").split(",").includes(String(r[k]));
  else if (op === "gte") ok = r[k] != null && r[k] >= val;
  else if (op === "is") ok = val === "null" ? r[k] == null : true;
  return neg ? !ok : ok;
};
const filter = (rows, params) => {
  for (const [k, v] of params) if (!["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) rows = rows.filter((r) => match(r, k, v));
  return rows;
};
const sortRows = (rows, order) => {
  if (!order) return rows;
  const keys = order.split(",").map((o) => o.split("."));
  return [...rows].sort((a, b) => {
    for (const [col, dir] of keys) if (a[col] !== b[col]) return (a[col] > b[col] ? 1 : -1) * (dir === "desc" ? -1 : 1);
    return 0;
  });
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks);
      const body = raw.toString();
      const json = (code, data) => {
        res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(data === undefined ? "" : JSON.stringify(data));
      };
      const p = url.pathname;

      if (p === "/__fail") return json(200, { failNext: (failNext = Number(url.searchParams.get("n") || 0)) });
      if (p === "/__orders") return json(200, orders.map((o) => ({ n: o.order_number, ref: o.client_ref, status: o.status, source: o.source, total: o.total })));

      const pub = p.match(/^\/storage\/v1\/object\/public\/product-images\/(.+)$/);
      if (pub && req.method === "GET") {
        const f = files.get(decodeURIComponent(pub[1]));
        if (!f) return json(404, {});
        res.writeHead(200, { "Content-Type": f.type });
        return res.end(f.data);
      }
      const up = p.match(/^\/storage\/v1\/object\/product-images\/(.+)$/);
      if (up && req.method === "POST") {
        let data = raw;
        let type = req.headers["content-type"];
        const m = type?.match(/boundary=(.+)$/);
        if (m) {
          const start = raw.indexOf(Buffer.from("\r\n\r\n")) + 4;
          type = raw.slice(0, start).toString().match(/Content-Type: (\S+)/i)?.[1] || "image/webp";
          data = raw.slice(start, raw.lastIndexOf(Buffer.from("\r\n--" + m[1])));
        }
        files.set(decodeURIComponent(up[1]), { type, data });
        return json(200, { Key: "product-images/" + up[1] });
      }
      if (p === "/storage/v1/object/product-images" && req.method === "DELETE") {
        for (const k of JSON.parse(body).prefixes ?? []) files.delete(k);
        return json(200, []);
      }
      if (p === "/rest/v1/rpc/purge_orders") return (orders.length = 0), json(204);

      const t = p.match(/^\/rest\/v1\/(\w+)$/);
      const rows = t && tables[t[1]];
      if (!rows) return json(404, { code: "PGRST205", message: "Could not find the table" });
      const single = (req.headers.accept || "").includes("vnd.pgrst.object");
      const reply = (code, list) => {
        if (!single) return json(code, list);
        if (list.length === 1) return json(code, list[0]);
        return json(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
      };

      if (req.method === "GET") {
        let list = sortRows(filter(rows, url.searchParams), url.searchParams.get("order"));
        const limit = url.searchParams.get("limit");
        return reply(200, limit ? list.slice(0, Number(limit)) : list);
      }
      if (req.method === "PATCH") {
        const patch = JSON.parse(body);
        const hit = filter(rows, url.searchParams);
        for (const r of hit) {
          if (t[1] === "orders" && (patch.status ?? r.status) === "completed" && (patch.delivery_status ?? r.delivery_status) !== "delivered")
            return json(400, { code: "23514", message: "violates check constraint orders_completed_needs_delivery" });
          if (t[1] === "orders" && patch.status) r.completed_at = patch.status === "completed" ? now() : null;
          Object.assign(r, patch, { updated_at: now() });
        }
        return reply(200, hit);
      }
      if (req.method === "DELETE") {
        const hit = new Set(filter(rows, url.searchParams));
        const keep = rows.filter((r) => !hit.has(r));
        rows.length = 0;
        rows.push(...keep);
        return json(204);
      }
      if (req.method === "POST") {
        const merge = (req.headers.prefer || "").includes("merge-duplicates");
        const key = t[1] === "settings" ? "key" : "id";
        const out = [];
        for (const item of [].concat(JSON.parse(body))) {
          if (t[1] === "orders") {
            if (failNext > 0) return failNext--, json(503, { message: "simulated outage" });
            if (item.client_ref && orders.some((o) => o.client_ref === item.client_ref)) return json(409, { code: "23505", message: "duplicate key" });
            Object.assign(item, {
              id: randomUUID(), order_number: Math.max(0, ...orders.map((o) => o.order_number)) + 1, created_at: now(), updated_at: now(),
              completed_at: null, status: item.status ?? "new", delivery_status: "pending", payment_status: item.payment_status ?? "unpaid", source: item.source ?? "website",
            });
          }
          const existing = item[key] != null && rows.find((r) => r[key] === item[key]);
          if (existing && !merge) return json(409, { code: "23505", message: "duplicate key" });
          if (existing) out.push(Object.assign(existing, item));
          else {
            const row = { created_at: now(), updated_at: now(), ...item };
            rows.push(row);
            out.push(row);
          }
        }
        return reply(201, out);
      }
      json(405, {});
    });
  })
  .listen(PORT, () => console.log(`Mock Supabase on http://localhost:${PORT}`));
