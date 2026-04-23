import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchClubDetail } from "@/lib/clubs/query";
import {
  deriveClubAvailability,
  hasValidPhotoUrl,
  type ClubAvailability,
} from "@/lib/clubs/types";
import { formatJstDate, formatJstTime } from "@/lib/format";
import { ReservationForm } from "./reservation-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const club = await fetchClubDetail(id);
  if (!club) return { title: "クラブが見つかりません" };
  return { title: `${club.name} | ${club.facilityName}` };
}

export default async function ClubDetailPage({ params }: Props) {
  const { id } = await params;
  const club = await fetchClubDetail(id);
  if (!club) notFound();

  const availability = deriveClubAvailability(club);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
        >
          ← クラブ一覧に戻る
        </Link>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">
            {club.facilityName}
          </span>
          <AvailabilityBadge value={availability} />
        </div>
        <h1 className="text-2xl leading-tight font-bold sm:text-3xl">
          {club.name}
        </h1>
      </header>

      <section className="mt-6 space-y-4 rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm text-zinc-700">
          <dt className="text-zinc-500">日時</dt>
          <dd>
            <time dateTime={club.startAt}>{formatJstDate(club.startAt)}</time>
            <span className="mx-2 text-zinc-400">·</span>
            <span>
              {formatJstTime(club.startAt)}〜{formatJstTime(club.endAt)}
            </span>
          </dd>
          <dt className="text-zinc-500">対象年齢</dt>
          <dd>
            {formatTargetAge(club.targetAgeMin, club.targetAgeMax) ??
              "指定なし"}
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
          <dt className="text-zinc-500">写真</dt>
          <dd>
            {hasValidPhotoUrl(club.photoUrl) ? (
              <a
                href={club.photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-700 underline underline-offset-4 hover:text-zinc-900"
              >
                写真を見る
              </a>
            ) : (
              <span className="text-zinc-400">準備中</span>
            )}
          </dd>
        </dl>

        {club.description && (
          <div className="rounded-md bg-zinc-50 p-4 text-sm whitespace-pre-wrap text-zinc-700">
            {club.description}
          </div>
        )}
      </section>

      <section
        aria-labelledby="reserve-heading"
        className="mt-8 space-y-4 rounded-lg border border-zinc-200 bg-white p-4 sm:p-6"
      >
        <h2 id="reserve-heading" className="text-lg font-bold">
          予約のお申込み
        </h2>

        {availability === "ended" ? (
          <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700">
            このクラブは受付を終了しました。
          </p>
        ) : (
          <>
            {availability === "waitlist" && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                定員に達しています。
                <br />
                お申込みいただくとキャンセル待ちとして受け付け、キャンセルが発生した場合に自動で繰り上がります。
              </p>
            )}
            <ReservationForm clubId={club.id} />
          </>
        )}
      </section>
    </main>
  );
}

function AvailabilityBadge({ value }: { value: ClubAvailability }) {
  const LABEL: Record<ClubAvailability, string> = {
    available: "空きあり",
    waitlist: "キャンセル待ち",
    ended: "終了",
  };
  const CLASS: Record<ClubAvailability, string> = {
    available: "bg-emerald-100 text-emerald-800",
    waitlist: "bg-amber-100 text-amber-800",
    ended: "bg-zinc-200 text-zinc-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${CLASS[value]}`}>
      {LABEL[value]}
    </span>
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
