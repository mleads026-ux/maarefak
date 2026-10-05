-- APPLY ONLY after the hardened client is live in Production and smoke-tested.
-- The new client uses create_media_message and request_chat_call directly.

revoke execute on function public.create_image_message(uuid,text) from authenticated;
revoke execute on function public.request_voice_call(uuid) from authenticated;
