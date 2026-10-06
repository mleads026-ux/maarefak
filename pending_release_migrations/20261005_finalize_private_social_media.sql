-- DO NOT APPLY BEFORE the signed-media Social Hub code is deployed and smoke-tested.
-- Phase 2: make social-media private so blocks/deletions cannot be bypassed with a saved public URL.
-- The app must already read social_posts.media_path and create short-lived signed URLs.

update storage.buckets
set public=false
where id='social-media';

-- media_url is retained temporarily for backwards compatibility/audit history.
-- Once all supported clients use media_path, it can be removed in a later cleanup migration.
