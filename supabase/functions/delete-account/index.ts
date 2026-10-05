import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function readKey(jsonEnv: string | undefined, fallback: string | undefined) {
  if (jsonEnv) {
    try {
      const parsed = JSON.parse(jsonEnv)
      if (parsed?.default) return String(parsed.default)
    } catch {}
  }
  return fallback || ""
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  const url = Deno.env.get("SUPABASE_URL") || ""
  const publishableKey = readKey(
    Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"),
    Deno.env.get("SUPABASE_ANON_KEY"),
  )
  const secretKey = readKey(
    Deno.env.get("SUPABASE_SECRET_KEYS"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  )
  const authorization = req.headers.get("Authorization") || ""

  if (!url || !publishableKey || !secretKey || !authorization.startsWith("Bearer ")) {
    return json({ error: "server_or_auth_configuration_missing" }, 500)
  }

  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return json({ error: "not_authenticated" }, 401)

  const { error: gateError } = await userClient.rpc("assert_account_deletion_allowed")
  if (gateError) {
    const code = gateError.message?.includes("mfa_required") ? "mfa_required" : "deletion_not_allowed"
    return json({ error: code }, code === "mfa_required" ? 403 : 400)
  }

  let dryRun = false
  try {
    const body = await req.json()
    dryRun = body?.dry_run === true
  } catch {}

  const userId = user.id

  const [{ data: memberships, error: membershipError }, { data: sentMessages, error: messageError }] =
    await Promise.all([
      admin.from("conversation_members").select("conversation_id").eq("user_id", userId),
      admin.from("messages").select("conversation_id").eq("sender_id", userId),
    ])

  if (membershipError || messageError) {
    return json({ error: "failed_to_resolve_owned_media" }, 500)
  }

  const conversationIds = Array.from(new Set([
    ...(memberships || []).map((x: any) => x.conversation_id),
    ...(sentMessages || []).map((x: any) => x.conversation_id),
  ].filter(Boolean)))

  const prefixes: Array<{ bucket: string; prefix: string }> = [
    { bucket: "avatars", prefix: userId },
    { bucket: "social-media", prefix: userId },
    { bucket: "space-images", prefix: userId },
    { bucket: "voice-intros", prefix: userId },
    { bucket: "private-profile-photos", prefix: userId },
    { bucket: "gift-voice", prefix: userId },
    { bucket: "chat-media-pending", prefix: userId },
    ...conversationIds.map((id: string) => ({
      bucket: "chat-media-approved",
      prefix: `${id}/${userId}`,
    })),
  ]

  async function removePrefix(bucket: string, prefix: string) {
    let removed = 0
    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(prefix, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      })
      if (error) throw new Error(`list_failed:${bucket}`)
      const names = (data || [])
        .filter((item: any) => item?.id && item?.name)
        .map((item: any) => `${prefix}/${item.name}`)
      if (!names.length) break
      if (dryRun) {
        removed += names.length
        break
      }
      const { error: removeError } = await admin.storage.from(bucket).remove(names)
      if (removeError) throw new Error(`remove_failed:${bucket}`)
      removed += names.length
      if (names.length < 1000) break
    }
    return removed
  }

  const removedByBucket: Record<string, number> = {}
  try {
    for (const item of prefixes) {
      const count = await removePrefix(item.bucket, item.prefix)
      removedByBucket[item.bucket] = (removedByBucket[item.bucket] || 0) + count
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "storage_cleanup_failed"
    return json({ error: message }, 500)
  }

  if (dryRun) {
    return json({
      ok: true,
      dry_run: true,
      user_id: userId,
      storage_objects_found: removedByBucket,
    })
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return json({ error: "auth_user_delete_failed" }, 500)
  }

  return json({
    ok: true,
    deleted: true,
    storage_objects_removed: removedByBucket,
  })
})
