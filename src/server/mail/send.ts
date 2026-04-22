import "server-only";

import { Resend } from "resend";

import { serverEnv } from "@/server/env";

// メール送信の低レベルラッパ。
//
// Resend のキーが未設定の場合は console に「スキップした」旨を記録し no-op
// で帰る。これにより devcontainer / CI / テスト実行環境など、本物のメール
// を送りたくない場合でもアプリ側のエラーにはならない。
//
// PII 保護のため、ログには `tag`（呼び出し側が付けるテンプレ識別子）しか
// 書かない。宛先・本文・件名はログに出さない。

let client: Resend | null = null;

function getClient(): Resend | null {
  if (client) return client;
  if (!serverEnv.resendApiKey) return null;
  client = new Resend(serverEnv.resendApiKey);
  return client;
}

export interface SendEmailArgs {
  readonly tag: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const resend = getClient();
  const from = serverEnv.resendFromAddress;

  if (!resend || !from) {
    console.warn("[mail] skipped (resend env missing)", { tag: args.tag });
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
    });
    if (error) {
      console.error("[mail] send failed", {
        tag: args.tag,
        error: error.message,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mail] send threw", { tag: args.tag, error: message });
  }
}
