import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { Badge, Card, CardBody, FormMessage } from "@/components/ui";
import { fetchAdminsList } from "@/server/auth/admin-list";
import {
  AuthenticationRequiredError,
  requireSuperAdmin,
  SuperAdminRequiredError,
} from "@/server/auth/guards";
import { fetchFacilities } from "@/server/facilities/list";

import { DeleteAdminButton } from "./delete-admin-button";
import { InviteAdminForm } from "./invite-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "アカウント追加・削除",
  robots: { index: false, follow: false },
};

export default async function AdminAccountsPage() {
  let ctx;
  try {
    ctx = await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    if (error instanceof SuperAdminRequiredError) {
      return (
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
          <FormMessage tone="warning">
            このページは全館管理者のみ利用できます。
          </FormMessage>
        </main>
      );
    }
    throw error;
  }

  const [admins, allFacilities] = await Promise.all([
    fetchAdminsList(),
    fetchFacilities({ includeDeleted: false }),
  ]);
  const currentAdminId = ctx.adminId;
  const totalActive = allFacilities.length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/admin/clubs"
          className="text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
        >
          ← クラブ一覧に戻る
        </Link>
      </nav>

      <header className="mb-6 space-y-1">
        <p className="text-sm font-medium tracking-wide text-[var(--color-muted)]">
          管理画面
        </p>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          アカウント追加・削除
        </h1>
        <p className="text-xs leading-6 text-[var(--color-muted)]">
          新しい管理者を招待します。
          <br />
          ここで設定した初期パスワードを相手に伝え、招待メール内のリンクをクリックしてもらうと、メール確認が完了して指定した館の管理者としてログインできるようになります。
        </p>
      </header>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-foreground)]">
            新しい管理者を招待
          </h2>
          <InviteAdminForm facilities={allFacilities} />
        </CardBody>
      </Card>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">
          現在の管理者 ({admins.length})
        </h2>
        {admins.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted)]">
            登録されている管理者はいません。
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            {admins.map((a) => {
              const activeOwnedCount = a.facilities.filter((code) =>
                allFacilities.some((f) => f.code === code),
              ).length;
              const isSuper =
                totalActive > 0 && activeOwnedCount >= totalActive;
              const isSelf = a.id === currentAdminId;
              const label = a.displayName ?? a.email ?? "(表示名未設定)";
              return (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">
                        {a.displayName ?? "(表示名未設定)"}
                        {isSelf && (
                          <span className="ml-2">
                            <Badge tone="success">あなた</Badge>
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-[var(--color-muted)]">
                        {a.email ?? "(email 取得失敗)"}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      {isSuper && <Badge tone="info">全館管理者</Badge>}
                      {!isSelf && (
                        <DeleteAdminButton
                          targetAdminId={a.id}
                          targetLabel={label}
                        />
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {allFacilities.map((f) => {
                      const has = a.facilities.includes(f.code);
                      return has ? (
                        <Badge key={f.code} tone="neutral">
                          {f.name}
                        </Badge>
                      ) : (
                        <Badge key={f.code} tone="muted">
                          <span className="line-through">{f.name}</span>
                        </Badge>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
