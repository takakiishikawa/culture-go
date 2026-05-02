import type { createClient } from "./server";

/** culturego schema にピン留めされた server-side Supabase クライアントの型 */
export type CulturegoClient = Awaited<ReturnType<typeof createClient>>;
