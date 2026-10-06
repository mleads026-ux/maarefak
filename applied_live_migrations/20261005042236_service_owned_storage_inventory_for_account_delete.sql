-- Applied live on 2026-10-05.
-- Service-only inventory used by the delete-account Edge Function so every object
-- owned by the user is removed through the Storage API before Auth deletion.

create or replace function public.account_owned_storage_objects(p_user uuid)
returns table(bucket_id text, object_name text)
language sql
security definer
set search_path='storage','public'
as $$
  select o.bucket_id,o.name
  from storage.objects o
  where p_user is not null
    and o.owner_id=p_user::text
  order by o.bucket_id,o.name
$$;

revoke all on function public.account_owned_storage_objects(uuid) from public,anon,authenticated;
grant execute on function public.account_owned_storage_objects(uuid) to service_role;
