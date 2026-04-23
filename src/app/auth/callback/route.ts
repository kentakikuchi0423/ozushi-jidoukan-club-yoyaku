import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Supabase Auth のメール確認リンク（signup / magiclink / recovery）から
// 戻ってきたときに、`?code=...` を session に交換してクッキーに書き込む。
// その後、`next` パラメータで指定された admin 配下のパスにリダイレクトする。
// `next` は Open Redirect を防ぐため `/admin*` に限定する。

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next =
    typeof nextParam === "string" && /^\/admin(\/.*)?$/.test(nextParam)
      ? nextParam
      : "/admin/clubs";

  if (!code) {
    // 異常系: code が無い場合はログインページに遷移し、メッセージを表示。
    return NextResponse.redirect(
      new URL("/admin/login?error=callback_missing_code", origin),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth.callback] exchange failed", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.redirect(
      new URL(
        `/admin/login?error=callback_${encodeURIComponent(error.code ?? "unknown")}`,
        origin,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, origin));
}
