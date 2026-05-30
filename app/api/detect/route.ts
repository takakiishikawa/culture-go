import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDetection } from "@/lib/detect/run";
import { runHcmcDetection } from "@/lib/detect/run-hcmc";
import { runLivingDetection } from "@/lib/detect/run-living";

export const dynamic = "force-dynamic";
// Vercel Hobby は最大 60s。fast mode に絞ってこの枠に収める。
export const maxDuration = 60;

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
  let channel: "global" | "hcmc" | "hcmc_living" = "global";
  try {
    const body = (await request.json().catch(() => null)) as
      | { lookbackDays?: number; channel?: string }
      | null;
    if (body?.lookbackDays && Number.isFinite(body.lookbackDays)) {
      lookbackDays = Math.max(1, Math.min(60, Math.floor(body.lookbackDays)));
    }
    if (body?.channel === "hcmc") {
      channel = "hcmc";
    } else if (body?.channel === "hcmc_living") {
      channel = "hcmc_living";
    }
  } catch {
    // body が無くても OK
  }

  try {
    let summary;
    if (channel === "hcmc_living") {
      summary = await runLivingDetection(supabase, {
        lookbackDays,
        mode: "fast",
      });
    } else if (channel === "hcmc") {
      summary = await runHcmcDetection(supabase, { lookbackDays, mode: "fast" });
    } else {
      summary = await runDetection(supabase, { lookbackDays, mode: "fast" });
    }
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "detection failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
