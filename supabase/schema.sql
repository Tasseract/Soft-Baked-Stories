-- Soft Baked Stories database.
-- Run in Supabase → SQL Editor → New query → Run.
-- Safe to run again: every statement only creates or adds what is missing, and never deletes data.

-- ─── Orders ──────────────────────────────────────────────────────────────────

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,

  customer_name text not null,
  phone text not null,
  address text not null,
  notes text,

  payment_method text not null check (payment_method in ('cod', 'qr')),
  payment_reference text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),

  -- [{ product_id, name, option, option_label, unit_price, quantity, line_total }]
  items jsonb not null,
  total integer not null check (total >= 0),

  status text not null default 'new'
    check (status in ('new', 'confirmed', 'baking', 'ready', 'completed', 'cancelled')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'out_for_delivery', 'delivered'))
);

-- Set by the customer's browser once per checkout, so automatic retries never create duplicate orders
alter table public.orders add column if not exists client_ref uuid;
create unique index if not exists orders_client_ref_key on public.orders (client_ref);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

-- An order can only be completed once it has been delivered.
-- "not valid" skips the check for rows that already exist.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_completed_needs_delivery' and conrelid = 'public.orders'::regclass) then
    alter table public.orders
      add constraint orders_completed_needs_delivery
      check (status <> 'completed' or delivery_status = 'delivered') not valid;
  end if;
end $$;

create or replace function public.touch_orders() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_orders();

-- ─── Menu ────────────────────────────────────────────────────────────────────

create table if not exists public.products (
  id text primary key,
  name text not null check (length(name) between 1 and 80),
  description text not null default '',
  category text not null default 'Muffins',
  image_url text,
  -- [{ id, label, price }] — price in whole pesos
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array'),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_sort_idx on public.products (sort_order, created_at);

create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- The original menu. "on conflict do nothing" leaves any edits made in the dashboard alone.
insert into public.products (id, name, description, category, image_url, options, sort_order) values
  ('choco-lava-muffin', 'Choco Lava Muffins',
   'Rich. Fudgy. Irresistible. Loaded with chocolate chips inside and out for the ultimate chocolate experience.',
   'Muffins', '/images/choco-lava-muffin.png',
   '[{"id":"pc","label":"Per piece","price":55},{"id":"box","label":"Box","price":120}]', 10),
  ('carrot-muffin', 'Carrot Muffins',
   'Sweet, creamy, and comforting. A soft carrot muffin crowned with luscious cream cheese frosting for the perfect bakery-style indulgence.',
   'Muffins', '/images/carrot-muffin.png',
   '[{"id":"pc","label":"Per piece","price":75},{"id":"box","label":"Box","price":150}]', 20),
  ('banana-muffin', 'Banana Muffins',
   'Classic comfort in every bite. Moist banana cake packed with chocolate chips and finished with crunchy almond slices.',
   'Muffins', '/images/banana-muffin.png',
   '[{"id":"pc","label":"Per piece","price":55},{"id":"box","label":"Box","price":120}]', 30),
  ('smores-banana-muffin', 'S''mores Banana Muffins',
   'Soft, fluffy muffin topped with toasted marshmallows, rich chocolate, and crunchy graham bits.',
   'Muffins', '/images/smores-banana-muffin.png',
   '[{"id":"pc","label":"Per piece","price":80},{"id":"box","label":"Box","price":150}]', 40),
  ('smores-banana-bread', 'S''mores Banana Bread',
   'Moist and soft banana bread topped with toasted marshmallows, melted chocolate, and crunchy graham pieces for the perfect sweet and gooey bite.',
   'Breads', '/images/smores-banana-bread.png',
   '[{"id":"loaf","label":"Loaf","price":185}]', 50),
  ('banana-bread', 'Banana Bread',
   'Soft, moist, and freshly baked banana bread made with ripe bananas for a naturally sweet and rich flavor, with a lightly golden crust and a tender, comforting center.',
   'Breads', '/images/banana-bread.png',
   '[{"id":"loaf","label":"Loaf","price":120}]', 60)
on conflict (id) do nothing;

-- Public bucket for product photos uploaded from the dashboard
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- ─── Settings ────────────────────────────────────────────────────────────────

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values ('theme', '"light"')
on conflict (key) do nothing;

-- ─── Access ──────────────────────────────────────────────────────────────────
-- RLS on with no policies: only the server (secret key) can read or write these tables.

alter table public.orders enable row level security;
alter table public.products enable row level security;
alter table public.settings enable row level security;

revoke all on public.orders, public.products, public.settings from anon, authenticated;
grant all on public.orders, public.products, public.settings to service_role;

-- Deletes every order and restarts numbering at SBS-0001. Called from Settings → Purge.
create or replace function public.purge_orders() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  truncate table public.orders restart identity;
end $$;

revoke execute on function public.purge_orders() from public, anon, authenticated;
grant execute on function public.purge_orders() to service_role;
