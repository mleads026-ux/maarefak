-- Applied live on 2026-10-05.
-- The bucket had zero objects and no current space referenced image_url.
-- Keep future room images inaccessible outside authenticated app sessions.

update storage.buckets
set public=false
where id='space-images';

drop policy if exists space_image_public_read on storage.objects;
create policy space_image_authenticated_read
on storage.objects
for select
to authenticated
using (bucket_id='space-images');
