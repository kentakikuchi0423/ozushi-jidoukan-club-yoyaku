import { describe, expect, it } from "vitest";
import { findSuperAdminIdsToGrant, type AdminFacilityRow } from "./super-admin";

function row(
  adminId: string,
  facilityId: number,
  deleted = false,
): AdminFacilityRow {
  return {
    adminId,
    facilityId,
    facilityDeletedAt: deleted ? "2026-01-01T00:00:00Z" : null,
  };
}

describe("findSuperAdminIdsToGrant", () => {
  it("returns admins who already own every active facility", () => {
    // 有効館: 1, 2, 3（3 館）。新設: 4。
    // admin-a は 1/2/3 全部 → super
    // admin-b は 1/2 → not super
    // admin-c は 1/2/3/4 → super（4 は新設なので除外、残り 1/2/3 で 3 件）
    const rows: AdminFacilityRow[] = [
      row("admin-a", 1),
      row("admin-a", 2),
      row("admin-a", 3),
      row("admin-b", 1),
      row("admin-b", 2),
      row("admin-c", 1),
      row("admin-c", 2),
      row("admin-c", 3),
      row("admin-c", 4),
    ];
    const result = findSuperAdminIdsToGrant(rows, 3, 4);
    expect(new Set(result)).toEqual(new Set(["admin-a", "admin-c"]));
  });

  it("ignores rows whose facility is soft-deleted", () => {
    // facility 3 が削除済み → admin-a は実質 1/2 のみ → not super
    const rows: AdminFacilityRow[] = [
      row("admin-a", 1),
      row("admin-a", 2),
      row("admin-a", 3, true),
    ];
    expect(findSuperAdminIdsToGrant(rows, 3, 99)).toEqual([]);
  });

  it("returns empty when there are no active facilities yet", () => {
    // 初回 facility を作成している状況では totalActiveBefore = 0
    const rows: AdminFacilityRow[] = [row("admin-a", 1)];
    expect(findSuperAdminIdsToGrant(rows, 0, 1)).toEqual([]);
  });

  it("treats duplicate rows as a single facility membership", () => {
    // 万一同じ (admin, facility) が 2 行入っていても Set で集約される
    const rows: AdminFacilityRow[] = [
      row("admin-a", 1),
      row("admin-a", 1),
      row("admin-a", 2),
      row("admin-a", 3),
    ];
    expect(findSuperAdminIdsToGrant(rows, 3, 99)).toEqual(["admin-a"]);
  });

  it("excludes the newly-inserted facility id from the count", () => {
    // admin-a は既に 1/2/3 持ちで、新設 facility=4 を作った直後。
    // 新 facility のメンバーシップはまだ無い/あってもカウント外。
    const rows: AdminFacilityRow[] = [
      row("admin-a", 1),
      row("admin-a", 2),
      row("admin-a", 3),
    ];
    expect(findSuperAdminIdsToGrant(rows, 3, 4)).toEqual(["admin-a"]);
  });
});
