-- Soft Baked Stories: run this once in Supabase → SQL Editor → New query.

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

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

-- RLS on with no policies: only the server (secret key) can read or write orders.
alter table public.orders enable row level security;

create or replace function public.touch_orders() returns trigger
language plpgsql as $$
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
