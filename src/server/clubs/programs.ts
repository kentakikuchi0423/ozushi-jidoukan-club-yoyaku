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
 * クラブ・事業マスター一覧を取得する。
 *   * `orderBy`: `"name"`（既定、ドロップダウン用）または `"created_at"`
 *     （管理一覧ページで古い順に並べる）
 *   * `includeDeleted`: ソフト削除済みを含むかどうか。既定は false
 */
export async function fetchClubPrograms(
  options: {
    includeDeleted?: boolean;
    orderBy?: "name" | "created_at";
  } = {},
): Promise<ClubProgramListItem[]> {
  const orderBy = options.orderBy ?? "name";
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("club_programs")
    .select("id, name, target_age, summary, deleted_at")
    .order(orderBy, { ascending: true });
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
