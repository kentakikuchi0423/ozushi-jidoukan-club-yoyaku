import Link from "next/link";
import { fetchListableClubs } from "@/lib/clubs/query";
import {
  deriveClubAvailability,
  hasValidPhotoUrl,
  type ClubAvailability,
  type ClubListing,
} from "@/lib/clubs/types";
import { formatJstDate, formatJstTime } from "@/lib/format";

// クラブ一覧（利用者向けトップページ）。
//
// 並び順・表示項目・状態表示・写真リンクの扱いは CLAUDE.md §固定要件 に準ずる。
// データ取得は server component 側で `list_public_clubs` RPC を呼んで行うので、
// client bundle に secret は一切入らない（publishable key 経由）。

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const clubs = await fetchListableClubs();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
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

      {clubs.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {clubs.map((club) => (
            <li key={club.id}>
              <ClubCard club={club} />
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-12 text-center">
        <p className="text-xs text-zinc-500">
          管理者の方は{" "}
          <Link
            href="/admin/login"
            className="underline underline-offset-4 hover:text-zinc-700"
          >
            ログイン画面
          </Link>
        </p>
      </footer>
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

const AVAILABILITY_LABEL: Record<ClubAvailability, string> = {
  available: "空きあり",
  waitlist: "キャンセル待ち",
  ended: "終了",
};

const AVAILABILITY_CLASS: Record<ClubAvailability, string> = {
  available: "bg-emerald-100 text-emerald-800",
  waitlist: "bg-amber-100 text-amber-800",
  ended: "bg-zinc-200 text-zinc-700",
};

function ClubCard({ club }: { club: ClubListing }) {
  const availability = deriveClubAvailability(club);
  const isEnded = availability === "ended";
  const isReservable = !isEnded;

  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">
          {club.facilityName}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${AVAILABILITY_CLASS[availability]}`}
        >
          {AVAILABILITY_LABEL[availability]}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-700">
          <time dateTime={club.startAt}>{formatJstDate(club.startAt)}</time>
          <span className="mx-2 text-zinc-400">·</span>
          <span>
            {formatJstTime(club.startAt)}〜{formatJstTime(club.endAt)}
          </span>
        </p>
        <h2 className="text-lg leading-tight font-bold">{club.name}</h2>
      </div>

      <dl className="grid grid-cols-2 gap-y-1 text-sm text-zinc-700">
        <dt className="text-zinc-500">対象年齢</dt>
        <dd>
          {formatTargetAge(club.targetAgeMin, club.targetAgeMax) ?? "指定なし"}
        </dd>
        <dt className="text-zinc-500">定員 / 予約</dt>
        <dd>
          {club.capacity}名 / {club.confirmedCount}名
          {club.waitlistedCount > 0 && (
            <span className="ml-1 text-xs text-amber-700">
              （キャンセル待ち {club.waitlistedCount}名）
            </span>
          )}
        </dd>
      </dl>

      <div className="mt-auto flex items-center justify-between pt-2 text-sm">
        {hasValidPhotoUrl(club.photoUrl) ? (
          <a
            href={club.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
          >
            写真を見る
          </a>
        ) : (
          <span className="text-zinc-400">写真：準備中</span>
        )}

        {isReservable ? (
          <Link
            href={`/clubs/${club.id}`}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            予約する
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-500"
          >
            受付終了
          </span>
        )}
      </div>
    </article>
  );
}

function formatTargetAge(
  min: number | null,
  max: number | null,
): string | null {
  if (min === null && max === null) return null;
  if (min === null) return `〜${max}歳`;
  if (max === null) return `${min}歳〜`;
  if (min === max) return `${min}歳`;
  return `${min}歳〜${max}歳`;
}
