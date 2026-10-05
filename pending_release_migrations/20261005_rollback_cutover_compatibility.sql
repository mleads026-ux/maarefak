-- EMERGENCY ROLLBACK ONLY.
-- Use only if Production has already applied the cutover migrations
-- and the web client must be rolled back to the legacy main version.

grant execute on function public.complete_profile(text,date,uuid,uuid,text,text,uuid[],text) to authenticated;
grant execute on function public.create_lamma(text,text,text,text,boolean,text) to authenticated;
grant execute on function public.join_lamma(uuid,text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

update storage.buckets
set public=true
where id='social-media';

-- The signed-read policy can remain in place while the bucket is public.
-- Re-run the current Production smoke test after restoring compatibility.


-- Restore legacy-client chat media compatibility during an emergency rollback.
update public.app_media_settings
set chat_media_uploads_enabled=true,
    avatar_uploads_enabled=true,
    social_image_uploads_enabled=true,
    private_photo_uploads_enabled=true,
    space_image_uploads_enabled=true,
    updated_at=now()
where id=1;
