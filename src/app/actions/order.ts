"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function reorderApps(orderedIds: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: false, error: "no_ids" };
  }
  const admin = supabaseAdmin();
  // Assign display_order in steps of 10 so future inserts can squeeze in
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      admin.from("apps").update({ display_order: (i + 1) * 10 }).eq("id", id)
    )
  );
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) return { ok: false, error: firstError.message };
  revalidatePath("/");
  return { ok: true };
}
