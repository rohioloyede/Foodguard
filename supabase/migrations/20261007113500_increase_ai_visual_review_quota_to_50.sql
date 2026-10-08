alter table public.ai_visual_review_usage
drop constraint if exists ai_visual_review_usage_request_count_check;

alter table public.ai_visual_review_usage
add constraint ai_visual_review_usage_request_count_check
check (request_count between 0 and 50);

create or replace function public.consume_ai_visual_review_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	current_request_count smallint;
begin
	insert into public.ai_visual_review_usage as usage (user_id, request_date, request_count)
	values (p_user_id, (now() at time zone 'utc')::date, 1)
	on conflict (user_id, request_date)
	do update set request_count = usage.request_count + 1
	where usage.request_count < 50
	returning request_count into current_request_count;

	return current_request_count is not null;
end;
$$;

revoke all on function public.consume_ai_visual_review_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_visual_review_quota(uuid) to service_role;
