create extension if not exists pgcrypto;

create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  description text not null default '',
  price numeric(12,2) not null,
  image_url text,
  category text not null default 'car',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  product_id bigint not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists cart_items_user_id_idx on public.cart_items (user_id);
create index if not exists cart_items_product_id_idx on public.cart_items (product_id);

alter table public.products enable row level security;
alter table public.cart_items enable row level security;

drop policy if exists "products are publicly readable" on public.products;
create policy "products are publicly readable"
on public.products
for select
using (true);

drop policy if exists "cart read own rows" on public.cart_items;
create policy "cart read own rows"
on public.cart_items
for select
using (auth.uid()::text = user_id);

drop policy if exists "cart insert own rows" on public.cart_items;
create policy "cart insert own rows"
on public.cart_items
for insert
with check (auth.uid()::text = user_id);

drop policy if exists "cart update own rows" on public.cart_items;
create policy "cart update own rows"
on public.cart_items
for update
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

drop policy if exists "cart delete own rows" on public.cart_items;
create policy "cart delete own rows"
on public.cart_items
for delete
using (auth.uid()::text = user_id);

insert into public.products (name, description, price, image_url, category, active)
values
  ('Midnight Alloy Wheels', 'Premium-looking alloy wheels for a sharper stance.', 15999, 'https://commons.wikimedia.org/wiki/Special:FilePath/Ferrari_599_HY_KERS_wheel.jpg', 'exterior', true),
  ('Carbon Grip Steering Cover', 'Comfortable grip with a sporty cabin feel.', 2499, 'https://commons.wikimedia.org/wiki/Special:FilePath/Old_car_steering_wheel_(2662480818).jpg', 'interior', true),
  ('Amber LED Headlight Kit', 'Brighter lighting for night drives and road visibility.', 6799, 'https://commons.wikimedia.org/wiki/Special:FilePath/2007_GMC_Yukon_XL_Headlights.jpg', 'lighting', true),
  ('Cruise Comfort Seat Cushions', 'Soft support for longer drives.', 3299, 'https://commons.wikimedia.org/wiki/Special:FilePath/Interior_del_SEAT_Ibiza_IV_Restyling.JPG', 'interior', true),
  ('RoadGuard Car Vacuum Pro', 'Compact interior cleaning for everyday use.', 4599, 'https://commons.wikimedia.org/wiki/Special:FilePath/Automobile_vacuum,_Walkerville,_Windsor,_Ontario,_2025-09-01.jpg', 'cleaning', true),
  ('Velocity Dash Organizer', 'Keeps the cabin tidy and essentials within reach.', 1899, 'https://commons.wikimedia.org/wiki/Special:FilePath/Ursulines_Street_French_Quarter_Aug_2009_Jeep_Dashboard.JPG', 'interior', true)
on conflict do nothing;

-- profiles table to store user metadata
create table if not exists public.profiles (
  id uuid primary key,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_id_idx on public.profiles (id);

alter table public.profiles enable row level security;

drop policy if exists "profiles read own rows" on public.profiles;
create policy "profiles read own rows"
on public.profiles
for select
using (auth.uid()::text = id::text);

drop policy if exists "profiles upsert own rows" on public.profiles;
create policy "profiles upsert own rows"
on public.profiles
for insert, update
with check (auth.uid()::text = id::text);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  items jsonb not null,
  total numeric(12,2) not null,
  payment_method text not null default 'cod',
  address text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);

alter table public.orders enable row level security;

drop policy if exists "orders read own rows" on public.orders;
create policy "orders read own rows"
on public.orders
for select
using (auth.uid()::text = user_id);

drop policy if exists "orders insert own rows" on public.orders;
create policy "orders insert own rows"
on public.orders
for insert
with check (auth.uid()::text = user_id);
