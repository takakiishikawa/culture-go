"use server";

import { createClient } from "@/lib/supabase/server";

export async function markCardRead(cardId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("card_metadata").upsert(
    {
      card_id: cardId,
      is_read: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "card_id" },
  );
}
