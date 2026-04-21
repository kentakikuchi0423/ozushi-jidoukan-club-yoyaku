import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "管理者ログイン",
};

// Phase 2 時点では middleware の遷移先として存在させるだけ。
// 実フォーム・supabase.auth.signInWithPassword 呼び出し・失敗時の
// エラーメッセージ等は Phase 4（管理画面）で実装する。
export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-bold">管理者ログイン</h1>
        <p className="text-sm leading-7 text-zinc-600">
          このページはまだ準備中です。ログイン機能は Phase
          4（管理画面）で実装予定です。
        </p>
        <p className="text-xs text-zinc-500">
          先に進みたい場合は、Supabase Studio から直接ログインしてください。
        </p>
      </div>
    </main>
  );
}
