import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { Button, FormMessage } from "@/components/ui";
import { formatJstDate, formatJstTime } from "@/lib/format";
import {
  AuthenticationRequiredError,
  FacilityPermissionDeniedError,
  requireFacilityPermission,
} from "@/server/auth/guards";
import { fetchAdminReservationDetail } from "@/server/reservations/admin-detail";

import { adminCancelReservationFormAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "予約キャンセル確認",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}

const STATUS_LABEL = {
  confirmed: "予約完了",
  waitlisted: "キャンセル待ち",
  canceled: "キャンセル済み",
} as const;

export default async function AdminReservationCancelPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { error, message } = await searchParams;

  const detail = await fetchAdminReservationDetail(id);
  if (!detail) notFound();

  // 確認画面表示時点でも認可を確認。Server Action 側でも再チェックする。
  try {
    await requireFacilityPermission(detail.club.facilityCode);
  } catch (e) {
    if (e instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    if (e instanceof FacilityPermissionDeniedError) {
      // 権限なしは 404 と同等扱い（情報露出を避ける）
      notFound();
    }
    throw e;
  }

  const isAlreadyCanceled = detail.status === "canceled";
  const wasConfirmed = detail.status === "confirmed";

  // FormData の第二引数バインドで reservationId を確定
  const formAction = adminCancelReservationFormAction.bind(null, detail.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href={`/admin/clubs/${detail.club.id}/reservations`}
          className="text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
        >
          ← 予約者一覧に戻る
        </Link>
      </nav>

      <header className="mb-6 space-y-1">
        <p className="text-sm font-medium tracking-wide text-[var(--color-muted)]">
          管理画面
        </p>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          予約キャンセル確認
        </h1>
        <p className="text-xs leading-6 text-[var(--color-muted)]">
          以下の予約をキャンセルします。内容をご確認のうえ、最下部のボタンを押してください。
        </p>
      </header>

      {error && message && (
        <div className="mb-4">
          <FormMessage tone="danger">{message}</FormMessage>
        </div>
      )}

      {isAlreadyCanceled && (
        <div className="mb-4">
          <FormMessage tone="info">
            この予約はすでにキャンセル済みです。これ以上の操作は不要です。
          </FormMessage>
        </div>
      )}

      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-[var(--color-foreground)]">
          予約内容
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--color-muted)]">状態</dt>
          <dd>
            {STATUS_LABEL[detail.status]}
            {detail.status === "waitlisted" &&
              detail.waitlistPosition !== null && (
                <> （{detail.waitlistPosition} 番目）</>
              )}
          </dd>

          <dt className="text-[var(--color-muted)]">予約番号</dt>
          <dd className="font-mono">{detail.reservationNumber}</dd>

          <dt className="text-[var(--color-muted)]">クラブ名</dt>
          <dd>{detail.club.programName}</dd>

          <dt className="text-[var(--color-muted)]">館</dt>
          <dd>{detail.club.facilityName}</dd>

          <dt className="text-[var(--color-muted)]">開催日時</dt>
          <dd>
            <time dateTime={detail.club.startAt}>
              {formatJstDate(detail.club.startAt)}{" "}
              {formatJstTime(detail.club.startAt)}
            </time>
            〜{formatJstTime(detail.club.endAt)}
          </dd>

          <dt className="text-[var(--color-muted)]">お子さま</dt>
          <dd>
            {detail.children.map((c, i) => (
              <span key={i}>
                {i > 0 && (
                  <span className="mx-1 text-[var(--color-border)]">/</span>
                )}
                {c.name}（{c.kana}）
              </span>
            ))}
          </dd>

          {detail.parents.length > 0 && (
            <>
              <dt className="text-[var(--color-muted)]">保護者</dt>
              <dd>
                {detail.parents.map((p, i) => (
                  <span key={i}>
                    {i > 0 && (
                      <span className="mx-1 text-[var(--color-border)]">/</span>
                    )}
                    {p.name}（{p.kana}）
                  </span>
                ))}
              </dd>
            </>
          )}

          <dt className="text-[var(--color-muted)]">メール</dt>
          <dd className="break-all">{detail.email}</dd>

          <dt className="text-[var(--color-muted)]">電話</dt>
          <dd>{detail.phone}</dd>
        </dl>
      </section>

      {!isAlreadyCanceled && (
        <section className="mt-4 rounded-2xl border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] p-4 text-sm text-[var(--color-warning)]">
          <p className="font-medium">
            キャンセルすると、以下の処理が行われます。
          </p>
          <ul className="mt-2 list-disc pl-5 leading-6">
            <li>
              この予約のメールアドレス宛てに「キャンセルを承りました」メールが自動送信されます
            </li>
            {wasConfirmed && (
              <li>
                キャンセル待ちの先頭の方が予約完了に繰り上がり、繰り上げ通知メールが送信されます
              </li>
            )}
            <li>この操作は取り消せません</li>
          </ul>
        </section>
      )}

      <form action={formAction} className="mt-6 flex flex-wrap gap-3">
        <input type="hidden" name="intent" value="cancel" />
        <Button type="submit" variant="danger" disabled={isAlreadyCanceled}>
          キャンセルを確定する
        </Button>
        <Link
          href={`/admin/clubs/${detail.club.id}/reservations`}
          className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
        >
          戻る
        </Link>
      </form>
    </main>
  );
}
