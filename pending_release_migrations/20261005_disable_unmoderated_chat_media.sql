-- APPLY DURING PRODUCTION CUTOVER IF real media moderation is still unconfigured.
-- The new client reads these flags and disables image/video controls.
-- Storage policies and create_media_message already enforce the same flags server-side.

update public.app_media_settings
set chat_media_uploads_enabled=false,
    avatar_uploads_enabled=false,
    social_image_uploads_enabled=false,
    private_photo_uploads_enabled=false,
    space_image_uploads_enabled=false,
    updated_at=now()
where id=1
  and moderation_required=true
  and moderation_provider='unconfigured';
