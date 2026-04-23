import "server-only";

import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type { ClubProgram } from "@/lib/clubs/types";

interface ProgramRow {
  id: string;
  name: string;
  target_age: string;
  summary: string;
  deleted_at: string | null;
}

function toProgram(
  row: ProgramRow,
): ClubProgram & { deletedAt: string | null } {
  return {
    id: row.id,
    name: row.name,
    targetAge: row.target_age,
    summary: row.summary,
    deletedAt: row.deleted_at,
  };
}

export type ClubProgramListItem = ClubProgram & { deletedAt: string | null };

/**
 * クラブ・事業マスター一覧を name 昇順で取得する。
 * `includeDeleted` が true なら soft delete 済みのものも含める（マスター管理画面向け）。
 * デフォルト（false）ではクラブ作成フォームのドロップダウン用途で、有効な行のみ返す。
 */
export async function fetchClubPrograms(
  options: { includeDeleted?: boolean } = {},
): Promise<ClubProgramListItem[]> {
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("club_programs")
    .select("id, name, target_age, summary, deleted_at")
    .order("name", { ascending: true });
  if (!options.includeDeleted) {
    query = query.is("deleted_at", null);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`failed to list club programs: ${error.message}`);
  }
  return ((data ?? []) as ProgramRow[]).map(toProgram);
}

export async function fetchClubProgramById(
  id: string,
): Promise<ClubProgramListItem | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("club_programs")
    .select("id, name, target_age, summary, deleted_at")
    .eq("id", id)
    .maybeSingle<ProgramRow>();
  if (error) {
    throw new Error(`failed to fetch club program: ${error.message}`);
  }
  return data ? toProgram(data) : null;
}

/** この program を参照しているクラブが何件あるか（ソフト削除済み含む）。 */
export async function countClubsUsingProgram(
  programId: string,
): Promise<number> {
  const admin = getSupabaseAdminClient();
  const { count, error } = await admin
    .from("clubs")
    .select("id", { count: "exact", head: true })
    .eq("program_id", programId);
  if (error) {
    throw new Error(`failed to count clubs: ${error.message}`);
  }
  return count ?? 0;
}
