import Link from "next/link";

import { fetchListableClubs } from "@/lib/clubs/query";
import { ClubCard } from "@/components/clubs/club-card";
import { ClubFilterBar } from "@/components/clubs/filter-bar";
import {
  applyClubFilters,
  parseFacilityFilter,
  parseStatusFilter,
} from "@/components/clubs/filter-utils";
import { FACILITY_CODES } from "@/lib/facility";

// クラブ一覧（利用者向けトップページ）。
//
// 並び順・表示項目・状態表示・写真リンクの扱いは CLAUDE.md §固定要件 に準ずる。
// データ取得は server component 側で `list_public_clubs` RPC を呼んで行うので、
// client bundle に secret は一切入らない（publishable key 経由）。
// 絞り込みは URL `?facility=...&status=...` で持ち、管理画面と同じ UI を使う。

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ facility?: string; status?: string }>;
}

export default async function HomePage({ searchParams }: Props) {
  const { facility: facilityParam, status: statusParam } = await searchParams;
  const facilityFilter = parseFacilityFilter(facilityParam, FACILITY_CODES);
  const statusFilter = parseStatusFilter(statusParam);

  const allClubs = await fetchListableClubs();
  const filtered = applyClubFilters(allClubs, facilityFilter, statusFilter);
  const hasFilter = Boolean(facilityFilter || statusFilter);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-4 flex justify-end text-xs">
        <Link
          href="/admin/login"
          className="text-zinc-500 underline underline-offset-4 hover:text-zinc-700"
        >
          管理者の方はこちら
        </Link>
      </div>

      <header className="mb-8 space-y-2 text-center sm:text-left">
        <p className="text-sm font-medium tracking-wide text-zinc-500">
          大洲市児童館クラブ予約
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          クラブを探して予約する
        </h1>
        <p className="text-sm leading-7 text-zinc-600">
          大洲児童館・喜多児童館・徳森児童センターのクラブをまとめて表示しています。
          <br />
          気になるクラブを選ぶと、予約の手続きに進めます。
        </p>
      </header>

      <ClubFilterBar
        facilities={FACILITY_CODES}
        initialFacility={facilityFilter}
        initialStatus={statusFilter}
        basePath="/"
      />

      {allClubs.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div
          role="status"
          className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-600"
        >
          {hasFilter
            ? "絞り込み条件に一致するクラブはありません。"
            : "現在予約できるクラブはありません。"}
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {filtered.map((club) => (
            <li key={club.id}>
              <ClubCard club={club} variant="public" />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div
      role="status"
      className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-600"
    >
      現在予約できるクラブはありません。
      <br />
      しばらくしてから再度ご確認ください。
    </div>
  );
}
