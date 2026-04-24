import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { isReservationNumber } from "@/lib/reservations/number";
import { isReservationStatus } from "@/lib/reservations/status";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ご予約ありがとうございました",
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    r?: string;
    t?: string;
    s?: string;
    p?: string;
  }>;
}

export default async function ReservationDonePage({ searchParams }: Props) {
  const { r, t, s, p } = await searchParams;

  if (!r || !t || !s) notFound();
  if (!isReservationNumber(r)) notFound();
  if (!isReservationStatus(s) || s === "canceled") notFound();
  // status が 'canceled' で done ページに来ることはないため弾く

  const confirmUrl = buildConfirmUrl(r, t);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <div className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <header className="space-y-2">
          <p className="text-sm font-medium text-[var(--color-success)]">
            {s === "confirmed"
              ? "お申込みが完了しました"
              : "キャンセル待ちで受け付けました"}
          </p>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            {s === "confirmed"
              ? "ご予約ありがとうございました"
              : "キャンセル待ちリストに追加しました"}
          </h1>
        </header>

        {s === "waitlisted" && p && (
          <p className="rounded-xl bg-[var(--color-warning-soft)] p-3 text-sm text-[var(--color-warning)]">
            現在のキャンセル待ち順位は <strong>{p} 番目</strong> です。
            <br />
            キャンセルが発生した場合は、先頭の方から順にご連絡差し上げます。
          </p>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
            予約番号
          </h2>
          <p className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-lg">
            {r}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
            予約内容の確認・キャンセル用 URL
          </h2>
          <p className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-xs break-all">
            {confirmUrl}
          </p>
          <p className="text-xs leading-5 text-[var(--color-muted)]">
            この URL
            は、ご本人がご予約内容を確認・キャンセルするためのものです。
            <br />
            第三者に共有しないようご注意ください。
            <br />
            メールでもお送りしますので、大切に保管してください。
          </p>
        </section>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
          >
            クラブ一覧に戻る
          </Link>
        </div>
      </div>
    </main>
  );
}

function buildConfirmUrl(reservationNumber: string, token: string): string {
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ r: reservationNumber, t: token });
  return `${base}/reservations?${params.toString()}`;
}
