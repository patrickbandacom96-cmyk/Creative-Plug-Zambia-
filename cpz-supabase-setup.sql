-- ============================================================
-- Creative Plug Zambia (CPZ) - database setup for Supabase
-- Run this whole file once in Supabase > SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- TABLES ----------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10,2) not null check (price >= 0),
  price_is_starting boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create sequence public.cpz_order_seq start 1;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  phone text not null,
  email text,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  unit_price numeric(10,2) not null,
  price_is_starting boolean not null default false,
  quantity int not null check (quantity between 1 and 100),
  total numeric(10,2) not null,
  preferred_date date,
  instructions text,
  status text not null default 'Pending'
    check (status in ('Pending','Confirmed','In Progress','Completed','Cancelled')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger orders_touch before update on public.orders
for each row execute function public.touch_updated_at();

-- ---------- ADMIN CHECK ----------

create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- SECURITY (Row Level Security) ----------

alter table public.services enable row level security;
alter table public.orders   enable row level security;
alter table public.admins   enable row level security;

-- Customers (not logged in) can only READ active services
create policy "public reads active services"
  on public.services for select
  to anon, authenticated
  using (active = true);

-- Admin can do everything with services
create policy "admin manages services"
  on public.services for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Orders: ONLY the admin can read or change them directly
create policy "admin manages orders"
  on public.orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- admins table: no policies = nobody can read it from the app

revoke all on public.orders from anon;
revoke all on public.admins from anon, authenticated;

-- ---------- CUSTOMER FUNCTIONS (price is decided by the server) ----------

create or replace function public.create_order(
  p_service_id uuid,
  p_quantity int,
  p_name text,
  p_phone text,
  p_email text,
  p_date date,
  p_instructions text
) returns text
language plpgsql security definer
set search_path = public as $$
declare
  s public.services;
  n text;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then
    raise exception 'Invalid quantity';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Name is required';
  end if;
  if length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 9 then
    raise exception 'A valid phone number is required';
  end if;

  select * into s from public.services where id = p_service_id and active = true;
  if not found then
    raise exception 'Service not available';
  end if;

  n := 'CPZ-' || lpad(nextval('public.cpz_order_seq')::text, 4, '0');

  insert into public.orders (
    order_number, customer_name, phone, email,
    service_id, service_name, unit_price, price_is_starting,
    quantity, total, preferred_date, instructions
  ) values (
    n, left(trim(p_name), 100), left(trim(p_phone), 30), nullif(left(trim(coalesce(p_email, '')), 120), ''),
    s.id, s.name, s.price, s.price_is_starting,
    p_quantity, s.price * p_quantity, p_date, nullif(left(trim(coalesce(p_instructions, '')), 1000), '')
  );

  return n;
end $$;

-- Customer looks up ONLY their own order: order number + phone must both match
create or replace function public.get_order(p_order_number text, p_phone text)
returns table (
  order_number text,
  service_name text,
  quantity int,
  unit_price numeric,
  total numeric,
  price_is_starting boolean,
  status text,
  preferred_date date,
  created_at timestamptz
)
language sql security definer
set search_path = public as $$
  select o.order_number, o.service_name, o.quantity, o.unit_price, o.total,
         o.price_is_starting, o.status, o.preferred_date, o.created_at
  from public.orders o
  where o.order_number = upper(trim(p_order_number))
    and right(regexp_replace(o.phone, '\D', '', 'g'), 9)
        = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9);
$$;

revoke all on function public.create_order(uuid,int,text,text,text,date,text) from public;
revoke all on function public.get_order(text,text) from public;
grant execute on function public.create_order(uuid,int,text,text,text,date,text) to anon, authenticated;
grant execute on function public.get_order(text,text) to anon, authenticated;

-- ---------- OFFICIAL CPZ SERVICES ----------

insert into public.services (name, price, price_is_starting, sort_order) values
  ('Poster Design',        70,  false, 1),
  ('Flyer Design',         70,  false, 2),
  ('Banner Design',        100, false, 3),
  ('Business Card Design', 100, false, 4),
  ('Church Poster Design', 100, false, 5),
  ('Event Design',         150, false, 6),
  ('Email Design',         150, false, 7),
  ('Menu Card Design',     60,  false, 8),
  ('Birthday Design',      50,  false, 9),
  ('Logo Design',          100, true,  10);
