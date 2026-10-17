-- CPZ quantity update. Paste into Supabase > SQL Editor > Run. Run this BEFORE uploading the new index.html.

alter table orders add column if not exists quantity int not null default 1
  check (quantity between 1 and 1000);

drop function if exists create_order(text, text, bigint, text);
create function create_order(p_name text, p_phone text, p_service bigint, p_details text, p_qty int default 1)
returns text language plpgsql security definer set search_path = public as $$
declare s services%rowtype; n text;
begin
  select * into s from services where id = p_service and active;
  if not found then raise exception 'Service unavailable'; end if;
  n := 'CPZ-' || lpad(nextval('order_seq')::text, 4, '0');
  insert into orders(order_no, customer_name, phone, service_id, service_name, price, price_note, details, quantity)
  values (n, trim(p_name), trim(p_phone), s.id, s.name, s.price, s.price_note, p_details,
          greatest(1, least(coalesce(p_qty, 1), 1000)));
  return n;
end $$;

drop function if exists track_order(text, text);
create function track_order(p_no text, p_phone text)
returns table(order_no text, service_name text, price numeric, price_note text, quantity int, status text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select order_no, service_name, price, price_note, quantity, status, created_at
  from orders where order_no = upper(trim(p_no)) and phone = trim(p_phone)
$$;

grant execute on function create_order(text,text,bigint,text,int) to anon, authenticated;
grant execute on function track_order(text,text) to anon, authenticated;
