-- Applied live on 2026-10-05.
-- Remove legacy table-level client mutation grants where no authenticated write RLS policy exists.
-- profile_interests intentionally keeps INSERT/DELETE, but UPDATE is unused and revoked.

revoke insert,update,delete,truncate,references,trigger
on table public.cities,
         public.conversation_members,
         public.conversations,
         public.countries,
         public.interests,
         public.random_chat_sessions,
         public.space_private_contact_unlocks,
         public.space_voice_participants,
         public.voice_call_sessions
from authenticated,anon;

revoke update on table public.profile_interests from authenticated,anon;
