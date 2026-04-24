"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import type { FacilityCode } from "@/lib/facility";
import type { ClubAvailability } from "@/lib/clubs/types";

// 公開ページ `/` と管理画面 `/admin/clubs` で共有するフィルタバー。
// URL の検索パラメータ `?facility=...&status=...` を駆動する。

const STATUS_LABEL: Record<ClubAvailability, string> = {
  available: "空きあり",
  waitlist: "キャンセル待ち",
  ended: "終了",
};

export interface FilterFacility {
  readonly code: FacilityCode;
  readonly name: string;
}

interface Props {
  /** 表示・指定可能な館（コード + 表示名）。公開画面なら全非削除館、管理画面なら担当館のみ。 */
  readonly facilities: ReadonlyArray<FilterFacility>;
  readonly initialFacility: FacilityCode | "";
  readonly initialStatus: ClubAvailability | "";
  /** URL 置換時のベースパス（`/` または `/admin/clubs`）。 */
  readonly basePath: string;
}

export function ClubFilterBar({
  facilities,
  initialFacility,
  initialStatus,
  basePath,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (key: "facility" | "status", value: string) => {
      const next = new URLSearchParams(params?.toString() ?? "");
      if (value) next.set(key, value);
      else next.delete(key);
      // 絞り込み条件が変わったら必ず先頭ページに戻す。
      next.delete("page");
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
      });
    },
    [params, router, basePath],
  );

  const clearAll = useCallback(() => {
    startTransition(() => {
      router.replace(basePath, { scroll: false });
    });
  }, [router, basePath]);

  const hasFilter = Boolean(initialFacility || initialStatus);

  return (
    <section
      aria-label="クラブの絞り込み"
      className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"
    >
      {facilities.length > 1 && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-facility"
            className="text-xs font-medium text-[var(--color-muted)]"
          >
            館
          </label>
          <select
            id="filter-facility"
            value={initialFacility}
            onChange={(e) => update("facility", e.target.value)}
            disabled={pending}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-60"
          >
            <option value="">すべて</option>
            {facilities.map((f) => (
              <option key={f.code} value={f.code}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor="filter-status"
          className="text-xs font-medium text-[var(--color-muted)]"
        >
          ステータス
        </label>
        <select
          id="filter-status"
          value={initialStatus}
          onChange={(e) => update("status", e.target.value)}
          disabled={pending}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-60"
        >
          <option value="">すべて</option>
          {(Object.keys(STATUS_LABEL) as ClubAvailability[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {hasFilter && (
        <button
          type="button"
          onClick={clearAll}
          disabled={pending}
          className="ml-auto self-end rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-60"
        >
          絞り込みをクリア
        </button>
      )}
    </section>
  );
}
