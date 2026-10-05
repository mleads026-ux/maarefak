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

  const { data: ownedObjects, error: inventoryError } = await admin.rpc(
    "account_owned_storage_objects",
    { p_user: user.id },
  )
  if (inventoryError) return json({ error: "storage_inventory_failed" }, 500)

  const byBucket = new Map<string, string[]>()
  for (const row of ownedObjects || []) {
    if (!row?.bucket_id || !row?.object_name) continue
    const names = byBucket.get(row.bucket_id) || []
    names.push(row.object_name)
    byBucket.set(row.bucket_id, names)
  }

  const found: Record<string, number> = {}
  for (const [bucket, names] of byBucket) found[bucket] = names.length

  if (dryRun) {
    return json({
      ok: true,
      dry_run: true,
      user_id: user.id,
      storage_objects_found: found,
    })
  }

  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 1000) {
      const chunk = names.slice(i, i + 1000)
      const { error: removeError } = await admin.storage.from(bucket).remove(chunk)
      if (removeError) return json({ error: `storage_cleanup_failed:${bucket}` }, 500)
    }
  }

  const { data: remaining, error: remainingError } = await admin.rpc(
    "account_owned_storage_objects",
    { p_user: user.id },
  )
  if (remainingError) return json({ error: "storage_cleanup_verify_failed" }, 500)
  if ((remaining || []).length > 0) return json({ error: "storage_cleanup_incomplete" }, 500)

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) return json({ error: "auth_user_delete_failed" }, 500)

  return json({
    ok: true,
    deleted: true,
    storage_objects_removed: found,
  })
})
