"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { FACILITY_NAMES, type FacilityCode } from "@/lib/facility";
import type { ClubAvailability } from "@/lib/clubs/types";

const STATUS_LABEL: Record<ClubAvailability, string> = {
  available: "空きあり",
  waitlist: "キャンセル待ち",
  ended: "終了",
};

interface Props {
  /** admin の担当館。ここから選択できる選択肢を組み立てる。 */
  readonly facilities: readonly FacilityCode[];
  readonly initialFacility: FacilityCode | "";
  readonly initialStatus: ClubAvailability | "";
}

export function FilterBar({
  facilities,
  initialFacility,
  initialStatus,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (key: "facility" | "status", value: string) => {
      const next = new URLSearchParams(params?.toString() ?? "");
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `/admin/clubs?${qs}` : "/admin/clubs", {
          scroll: false,
        });
      });
    },
    [params, router],
  );

  const clearAll = useCallback(() => {
    startTransition(() => {
      router.replace("/admin/clubs", { scroll: false });
    });
  }, [router]);

  const hasFilter = Boolean(initialFacility || initialStatus);

  return (
    <section
      aria-label="クラブの絞り込み"
      className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"
    >
      {facilities.length > 1 && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-facility"
            className="text-xs font-medium text-zinc-600"
          >
            館
          </label>
          <select
            id="filter-facility"
            value={initialFacility}
            onChange={(e) => update("facility", e.target.value)}
            disabled={pending}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:opacity-60"
          >
            <option value="">すべて</option>
            {facilities.map((code) => (
              <option key={code} value={code}>
                {FACILITY_NAMES[code]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor="filter-status"
          className="text-xs font-medium text-zinc-600"
        >
          ステータス
        </label>
        <select
          id="filter-status"
          value={initialStatus}
          onChange={(e) => update("status", e.target.value)}
          disabled={pending}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:opacity-60"
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
          className="ml-auto self-end rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
        >
          絞り込みをクリア
        </button>
      )}
    </section>
  );
}
