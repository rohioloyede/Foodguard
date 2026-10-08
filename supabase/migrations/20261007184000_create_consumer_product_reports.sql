create table if not exists public.food_product_reports (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	product_name text not null check (char_length(btrim(product_name)) between 1 and 100),
	brand text check (brand is null or char_length(brand) <= 100),
	purchase_location text check (purchase_location is null or char_length(purchase_location) <= 160),
	concern text not null check (char_length(btrim(concern)) between 10 and 1000),
	created_at timestamptz not null default now()
);

create index if not exists food_product_reports_created_at_idx
	on public.food_product_reports (created_at desc);

alter table public.food_product_reports enable row level security;
revoke all on public.food_product_reports from anon, authenticated;
grant insert on public.food_product_reports to authenticated;

create policy "Users can submit food product reports"
	on public.food_product_reports
	for insert
	to authenticated
	with check ((select auth.uid()) = user_id);
