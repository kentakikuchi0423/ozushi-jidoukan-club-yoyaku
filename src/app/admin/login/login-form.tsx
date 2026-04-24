"use client";

import { useEffect, useState, useTransition } from "react";

import { Button, Field, FormMessage, Input } from "@/components/ui";

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
      {error && <FormMessage tone="danger">{error}</FormMessage>}

      <Field id="admin-login-email" label="メールアドレス" required>
        <Input
          id="admin-login-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={Boolean(error)}
        />
      </Field>

      <Field id="admin-login-password" label="パスワード" required>
        <Input
          id="admin-login-password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={Boolean(error)}
        />
      </Field>

      <Button type="submit" disabled={pending} fullWidth>
        {pending ? "ログイン中…" : "ログインする"}
      </Button>
    </form>
  );
}
