-- Mở rộng bảng restaurants thành gian hàng đầy đủ
alter table public.restaurants
  add column if not exists phone text,
  add column if not exists zalo text,
  add column if not exists intro text,
  add column if not exists rating_avg numeric(2,1) default 0,
  add column if not exists review_count integer default 0,
  add column if not exists product_count integer default 0;

-- Bảng sản phẩm
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  price integer not null default 0,
  description text,
  image_emoji text default '📦',
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Allow public read products"
on public.products for select
using (true);

-- Bảng đánh giá
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.restaurants(id) on delete cascade,
  user_name text not null default 'Khách hàng',
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

create policy "Allow public read reviews"
on public.reviews for select
using (true);
