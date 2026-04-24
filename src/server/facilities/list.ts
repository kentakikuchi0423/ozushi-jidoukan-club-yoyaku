import "server-only";

import type { FacilityCode } from "@/lib/facility";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

/** DB 上の館マスター 1 行。 */
export interface Facility {
  readonly id: number;
  readonly code: FacilityCode;
  readonly name: string;
  readonly phone: string;
  readonly deletedAt: string | null;
}

interface FacilityRow {
  id: number;
  code: string;
  name: string;
  phone: string;
  deleted_at: string | null;
}

function toFacility(row: FacilityRow): Facility {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    deletedAt: row.deleted_at,
  };
}

/**
 * 館マスターを name 昇順で取得する。`includeDeleted` を指定すれば soft delete 済みも含む。
 * RLS をバイパスする admin client を使うので、管理画面からの CRUD / フォームの
 * ドロップダウン用途で使える。
 */
export async function fetchFacilities(
  options: { includeDeleted?: boolean } = {},
): Promise<Facility[]> {
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("facilities")
    .select("id, code, name, phone, deleted_at")
    .order("name", { ascending: true });
  if (!options.includeDeleted) {
    query = query.is("deleted_at", null);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`failed to list facilities: ${error.message}`);
  }
  return ((data ?? []) as FacilityRow[]).map(toFacility);
}

export async function fetchFacilityByCode(
  code: string,
): Promise<Facility | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("facilities")
    .select("id, code, name, phone, deleted_at")
    .eq("code", code)
    .maybeSingle<FacilityRow>();
  if (error) {
    throw new Error(`failed to fetch facility: ${error.message}`);
  }
  return data ? toFacility(data) : null;
}

export async function fetchFacilityById(id: number): Promise<Facility | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("facilities")
    .select("id, code, name, phone, deleted_at")
    .eq("id", id)
    .maybeSingle<FacilityRow>();
  if (error) {
    throw new Error(`failed to fetch facility: ${error.message}`);
  }
  return data ? toFacility(data) : null;
}

/** 非削除の facility 件数（super_admin 判定用）。 */
export async function countActiveFacilities(): Promise<number> {
  const admin = getSupabaseAdminClient();
  const { count, error } = await admin
    .from("facilities")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (error) {
    throw new Error(`failed to count facilities: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * メールフッター等、連絡先だけが欲しい場面で使う軽量版。
 * `fetchFacilities({includeDeleted:false}).map(...)` の重複を一箇所に寄せる。
 */
export async function fetchActiveFacilityContacts(): Promise<
  ReadonlyArray<{ readonly name: string; readonly phone: string }>
> {
  const rows = await fetchFacilities({ includeDeleted: false });
  return rows.map((r) => ({ name: r.name, phone: r.phone }));
}
