import "server-only";

// 「作成前の有効館を全て持っていた admin」= 現時点の super_admin を洗い出す。
// admin_facilities の join 結果を入力に受け、純粋関数として処理する。
// こうすることで、Supabase のネットワーク呼び出しなしでテスト可能にする。

export interface AdminFacilityRow {
  readonly adminId: string;
  readonly facilityId: number;
  /** 対応する facility の deleted_at。null なら有効。 */
  readonly facilityDeletedAt: string | null;
}

/**
 * 作成前の有効館をすべて持っていた admin の ID を返す。
 * 新館挿入の直後に、`totalActiveBefore` を比較閾値にして呼ぶ想定。
 *
 * @param rows           admin_facilities + facilities!inner(id, deleted_at) の join 結果
 * @param totalActiveBefore 作成直前の非削除 facility 総数
 * @param newFacilityId  今回作成した facility の id（集計から除外）
 */
export function findSuperAdminIdsToGrant(
  rows: ReadonlyArray<AdminFacilityRow>,
  totalActiveBefore: number,
  newFacilityId: number,
): string[] {
  if (totalActiveBefore <= 0) return [];
  const activeByAdmin = new Map<string, Set<number>>();
  for (const row of rows) {
    if (row.facilityDeletedAt) continue;
    if (row.facilityId === newFacilityId) continue;
    const existing = activeByAdmin.get(row.adminId);
    if (existing) {
      existing.add(row.facilityId);
    } else {
      activeByAdmin.set(row.adminId, new Set([row.facilityId]));
    }
  }
  const result: string[] = [];
  for (const [adminId, set] of activeByAdmin.entries()) {
    if (set.size >= totalActiveBefore) result.push(adminId);
  }
  return result;
}
