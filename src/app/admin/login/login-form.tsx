"use client";

import { useEffect, useState, useTransition } from "react";

import { loginAction } from "./actions";

interface Props {
  next?: string;
}

export function LoginForm({ next }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    document.documentElement.dataset.adminLoginReady = "true";
    return () => {
      delete document.documentElement.dataset.adminLoginReady;
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await loginAction({ email, password, next });
        if (result && !result.ok) {
          setError(result.message);
        }
        // success: loginAction が redirect() するので通常ここには戻らない
      } catch (err) {
        // NEXT_REDIRECT は Next.js 側で再スローされ、navigation が起きた直後に
        // このハンドラが終わる想定。ただし hydration エラーや環境変数未設定など
        // 予期しない例外は transition に飲まれ画面が無反応になるため、ここで
        // 日本語のメッセージを表示して無言失敗を防ぐ。
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("NEXT_REDIRECT")) return;
        console.error("[admin.login] unexpected error", err);
        setError(
          "ログイン処理で問題が発生しました。\nしばらくしてからもう一度お試しください。",
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <p
          role="alert"
          id="admin-login-error"
          className="rounded-md bg-red-50 p-3 text-sm whitespace-pre-line text-red-800"
        >
          {error}
        </p>
      )}

      <div className="space-y-1">
        <label
          htmlFor="admin-login-email"
          className="block text-sm font-medium text-zinc-700"
        >
          メールアドレス
        </label>
        <input
          id="admin-login-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "admin-login-error" : undefined}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="admin-login-password"
          className="block text-sm font-medium text-zinc-700"
        >
          パスワード
        </label>
        <input
          id="admin-login-password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "admin-login-error" : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "ログイン中…" : "ログインする"}
      </button>
    </form>
  );
}
