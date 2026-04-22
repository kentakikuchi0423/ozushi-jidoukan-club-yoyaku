import "server-only";

import {
  FACILITY_CODE_BY_ID,
  isFacilityCode,
  type FacilityCode,
} from "@/lib/facility";
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
 * admin の数は通常 10 件程度のため、`listUsers` は 1 ページで十分。Phase 6
 * 以降で 50 人以上運用したい場合はページネーションを追加する。
 */
export async function fetchAdminsList(): Promise<AdminSummary[]> {
  const admin = getSupabaseAdminClient();

  const [rowsRes, usersRes] = await Promise.all([
    admin
      .from("admins")
      .select("id, display_name, admin_facilities(facility_id)")
      .order("display_name", { ascending: true, nullsFirst: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 100 }),
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

  const rows = (rowsRes.data ?? []) as AdminRow[];
  return rows.map((row) => {
    const codes: FacilityCode[] = [];
    for (const { facility_id } of row.admin_facilities) {
      const code = FACILITY_CODE_BY_ID[facility_id];
      if (code && isFacilityCode(code)) codes.push(code);
    }
    return {
      id: row.id,
      email: emailById.get(row.id) ?? null,
      displayName: row.display_name,
      facilities: codes,
    };
  });
}
