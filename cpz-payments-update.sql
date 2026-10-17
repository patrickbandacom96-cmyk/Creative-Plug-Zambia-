-- CPZ payments update. Paste into Supabase > SQL Editor > Run. Run BEFORE uploading the new index.html.
alter table orders add column if not exists paid numeric not null default 0 check (paid >= 0);
alter table orders add column if not exists pay_method text default '';
