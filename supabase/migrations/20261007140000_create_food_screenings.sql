create table if not exists public.food_screenings (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	food_category text not null check (
		food_category in ('Fruits', 'Vegetables', 'Grains & legumes', 'Animal products')
	),
	food_name text not null check (char_length(btrim(food_name)) between 1 and 100),
	device_reading text check (
		device_reading is null or char_length(device_reading) <= 500
	),
	visible_condition text check (
		visible_condition is null or visible_condition in (
			'no_obvious_visual_issue',
			'possible_visual_issue',
			'unclear'
		)
	),
	observations jsonb not null default '[]'::jsonb check (jsonb_typeof(observations) = 'array'),
	created_at timestamptz not null default now()
);

create index if not exists food_screenings_user_created_at_idx
	on public.food_screenings (user_id, created_at desc);

alter table public.food_screenings enable row level security;
revoke all on public.food_screenings from anon, authenticated;
grant select, insert on public.food_screenings to authenticated;

create policy "Users can view their own food screenings"
	on public.food_screenings
	for select
	to authenticated
	using ((select auth.uid()) = user_id);

create policy "Users can save their own food screenings"
	on public.food_screenings
	for insert
	to authenticated
	with check ((select auth.uid()) = user_id);
