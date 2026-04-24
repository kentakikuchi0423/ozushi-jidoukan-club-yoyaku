import "server-only";

import type { FacilityCode } from "@/lib/facility";
import { fetchFacilities } from "@/server/facilities/list";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export interface AdminSummary {
  readonly id: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly facilities: readonly FacilityCode[];
}

interface AdminRow {
  id: string;
  display_name: string | null;
  admin_facilities: ReadonlyArray<{ facility_id: number }>;
}

/**
 * 管理画面「アカウント一覧」用に、`admins` の全レコードと対応する email
 * （`auth.users` 経由）を結合して返す。super_admin しか呼ばない想定。
 *
 * 館 id → code の変換は facilities マスターから引く（削除済みも含めて引く
 * ことで、既存 admin 行の ID が孤立しないように備える）。
 */
export async function fetchAdminsList(): Promise<AdminSummary[]> {
  const admin = getSupabaseAdminClient();

  const [rowsRes, usersRes, facilities] = await Promise.all([
    admin
      .from("admins")
      .select("id, display_name, admin_facilities(facility_id)")
      .order("display_name", { ascending: true, nullsFirst: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 100 }),
    fetchFacilities({ includeDeleted: true }),
  ]);

  if (rowsRes.error) {
    throw new Error(`failed to list admins: ${rowsRes.error.message}`);
  }
  if (usersRes.error) {
    throw new Error(`failed to list users: ${usersRes.error.message}`);
  }

  const emailById = new Map(
    usersRes.data.users.map((u) => [u.id, u.email ?? null] as const),
  );
  const codeByFacilityId = new Map(facilities.map((f) => [f.id, f.code]));

  const rows = (rowsRes.data ?? []) as AdminRow[];
  return rows.map((row) => {
    const codes: FacilityCode[] = [];
    for (const { facility_id } of row.admin_facilities) {
      const code = codeByFacilityId.get(facility_id);
      if (code) codes.push(code);
    }
    return {
      id: row.id,
      email: emailById.get(row.id) ?? null,
      displayName: row.display_name,
      facilities: codes,
    };
  });
}
