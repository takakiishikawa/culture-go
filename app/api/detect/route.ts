import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDetection } from "@/lib/detect/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // detection w/ web search may run a few minutes

export async function POST(request: Request) {
  // ログイン必須（proxy.ts で弾くがここでも明示）
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let lookbackDays = 7;
  try {
    const body = (await request.json().catch(() => null)) as
      | { lookbackDays?: number }
      | null;
    if (body?.lookbackDays && Number.isFinite(body.lookbackDays)) {
      lookbackDays = Math.max(1, Math.min(30, Math.floor(body.lookbackDays)));
    }
  } catch {
    // body が無くても OK
  }

  try {
    const summary = await runDetection({ lookbackDays });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "detection failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
