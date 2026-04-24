"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import type { ClubListing } from "@/lib/clubs/types";
import { ClubCard } from "./club-card";

// 公開 `/` と管理 `/admin/clubs` の双方で使う、ページネーション対応のクラブ一覧。
// 画面幅ごとに最適な件数を出し分けるため、PC / モバイルで 1 ページあたりの
// 件数を変える（`matchMedia` で hydration 後に検知）。
// 現在ページは URL 検索パラメータ `?page=N` で保持するので、ブラウザの戻る /
// 共有にも耐える。ページが 1 つしかない場合もコントロールを常に表示する。

const DESKTOP_PER_PAGE = 10;
const MOBILE_PER_PAGE = 5;
// Tailwind の sm ブレークポイント（640px）で PC / モバイルを切り替える。
const DESKTOP_MEDIA_QUERY = "(min-width: 640px)";

interface Props {
  readonly clubs: ReadonlyArray<ClubListing>;
  readonly variant: "public" | "admin";
}

export function PaginatedClubList({ clubs, variant }: Props) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 初回レンダリングでは PC 想定の件数でレンダリングし、hydration 後に
  // 実際の viewport 幅でスイッチする。SSR と CSR の出力差は最初の 1 フレーム
  // だけに収まり、ユーザへの影響は小さい。
  const [perPage, setPerPage] = useState(DESKTOP_PER_PAGE);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const apply = () => {
      setPerPage(mql.matches ? DESKTOP_PER_PAGE : MOBILE_PER_PAGE);
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  const rawPage = Number.parseInt(params?.get("page") ?? "1", 10);
  const totalPages = Math.max(1, Math.ceil(clubs.length / perPage));
  const currentPage = Math.min(
    totalPages,
    Math.max(1, Number.isFinite(rawPage) ? rawPage : 1),
  );
  const start = (currentPage - 1) * perPage;
  const visible = useMemo(
    () => clubs.slice(start, start + perPage),
    [clubs, start, perPage],
  );

  const goTo = useCallback(
    (page: number) => {
      const next = new URLSearchParams(params?.toString() ?? "");
      if (page <= 1) next.delete("page");
      else next.set("page", String(page));
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.replace(url, { scroll: true });
      });
    },
    [params, pathname, router],
  );

  return (
    <div className="space-y-4">
      <ul className="flex flex-col gap-3">
        {visible.map((club) => (
          <li key={club.id}>
            <ClubCard club={club} variant={variant} />
          </li>
        ))}
      </ul>
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        goTo={goTo}
        disabled={pending}
        totalCount={clubs.length}
      />
    </div>
  );
}

interface PaginationControlsProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly goTo: (page: number) => void;
  readonly disabled: boolean;
  readonly totalCount: number;
}

function PaginationControls({
  currentPage,
  totalPages,
  goTo,
  disabled,
  totalCount,
}: PaginationControlsProps) {
  // 総ページ数が 7 以下なら全ページボタンを並べる。それ以上なら現在ページ周辺 +
  // 先頭/末尾を表示し、間隔が空く箇所に「…」を置く。
  const pages = buildPageList(currentPage, totalPages);
  const prevDisabled = disabled || currentPage <= 1;
  const nextDisabled = disabled || currentPage >= totalPages;

  return (
    <nav
      aria-label="クラブ一覧のページ送り"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3 text-sm"
    >
      <p className="text-xs text-zinc-500">
        {totalCount === 0
          ? "0 件"
          : `${currentPage} / ${totalPages} ページ（全 ${totalCount} 件）`}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => goTo(currentPage - 1)}
          disabled={prevDisabled}
          aria-label="前のページへ"
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          前へ
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`gap-${i}`}
              aria-hidden="true"
              className="px-1 text-xs text-zinc-400"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              disabled={disabled || p === currentPage}
              aria-label={`${p} ページ目へ`}
              aria-current={p === currentPage ? "page" : undefined}
              className={
                p === currentPage
                  ? "inline-flex min-w-[2rem] items-center justify-center rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white"
                  : "inline-flex min-w-[2rem] items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              }
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => goTo(currentPage + 1)}
          disabled={nextDisabled}
          aria-label="次のページへ"
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          次へ
        </button>
      </div>
    </nav>
  );
}

/**
 * 表示するページ番号のリストを作る。総ページ数が 7 以下なら全ページ、
 * それ以上なら先頭・末尾 + 現在ページ付近 + 省略記号 "…" を挟む。
 * 戻り値は `number | "…"`。
 */
function buildPageList(
  currentPage: number,
  totalPages: number,
): Array<number | "…"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: Array<number | "…"> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);
  if (windowStart > 2) pages.push("…");
  for (let p = windowStart; p <= windowEnd; p += 1) pages.push(p);
  if (windowEnd < totalPages - 1) pages.push("…");
  pages.push(totalPages);
  return pages;
}
