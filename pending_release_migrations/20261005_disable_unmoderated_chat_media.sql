-- APPLY DURING PRODUCTION CUTOVER IF real media moderation is still unconfigured.
-- The new client reads this flag and disables the attachment control.
-- The Storage policy and create_media_message RPC already enforce the same flag server-side.

update public.app_media_settings
set chat_media_uploads_enabled=false,
    updated_at=now()
where id=1
  and moderation_required=true
  and moderation_provider='unconfigured';
