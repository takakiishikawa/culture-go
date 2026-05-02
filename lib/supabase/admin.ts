import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { CulturegoClient } from "./types";

/**
 * service_role を使った admin クライアント。
 * GitHub Actions などユーザーセッションが無いコンテキストでだけ使う。
 * RLS を bypass するので web からは触れさせない。
 */
export function createAdminClient(): CulturegoClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "culturego" },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  ) as unknown as CulturegoClient;
}
