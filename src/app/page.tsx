import Link from "next/link";

import { CardDashed } from "@/components/ui";
import { fetchListableClubs } from "@/lib/clubs/query";
import { ClubFilterBar } from "@/components/clubs/filter-bar";
import {
  applyClubFilters,
  parseDateFilter,
  parseFacilityFilter,
  parseStatusFilter,
} from "@/components/clubs/filter-utils";
import { PaginatedClubList } from "@/components/clubs/paginated-club-list";
import { fetchFacilities } from "@/server/facilities/list";

// クラブ一覧（利用者向けトップページ）。
//
// 並び順・表示項目・状態表示・写真リンクの扱いは CLAUDE.md §固定要件 に準ずる。
// データ取得は server component 側で `list_public_clubs` RPC を呼んで行うので、
// client bundle に secret は一切入らない（publishable key 経由）。
// 絞り込みは URL `?facility=...&status=...` で持ち、管理画面と同じ UI を使う。

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    facility?: string;
    status?: string;
    dates?: string;
  }>;
}

export default async function HomePage({ searchParams }: Props) {
  const {
    facility: facilityParam,
    status: statusParam,
    dates: datesParam,
  } = await searchParams;
  const [allClubs, activeFacilities] = await Promise.all([
    fetchListableClubs(),
    fetchFacilities({ includeDeleted: false }),
  ]);
  const facilityCodes = activeFacilities.map((f) => f.code);
  const facilityFilter = parseFacilityFilter(facilityParam, facilityCodes);
  const statusFilter = parseStatusFilter(statusParam);
  const dateFilter = parseDateFilter(datesParam);

  const filtered = applyClubFilters(
    allClubs,
    facilityFilter,
    statusFilter,
    dateFilter,
  );
  const hasFilter = Boolean(
    facilityFilter || statusFilter || dateFilter.length > 0,
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-4 flex justify-end text-xs">
        <Link
          href="/admin/login"
          className="text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
        >
          管理者の方はこちら
        </Link>
      </div>

      <header className="mb-8 space-y-2">
        <p className="text-sm font-medium tracking-wide text-[var(--color-muted)]">
          大洲市児童館クラブ予約
        </p>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          クラブを探して予約する
        </h1>
        <p className="text-sm leading-7 text-[var(--color-foreground)]/80">
          「予約する」からクラブを申し込みいただけます。
          <br />
          撮影したお写真は準備後に公開し、一定期間後に掲載を終了します。
        </p>
      </header>

      <ClubFilterBar
        facilities={activeFacilities.map((f) => ({
          code: f.code,
          name: f.name,
        }))}
        initialFacility={facilityFilter}
        initialStatus={statusFilter}
        initialDates={dateFilter}
        basePath="/"
      />

      {allClubs.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <CardDashed role="status">
          {hasFilter
            ? "絞り込み条件に一致するクラブはありません。"
            : "現在お申し込みいただけるクラブはありません。"}
        </CardDashed>
      ) : (
        <PaginatedClubList clubs={filtered} variant="public" />
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <CardDashed role="status">
      現在お申し込みいただけるクラブはありません。
      <br />
      しばらく経ってから、もう一度ご確認ください。
    </CardDashed>
  );
}
