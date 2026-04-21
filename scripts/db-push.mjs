// `pnpm db:push` 経由で呼ばれるラッパ。
//
// 目的:
//   Supabase Personal Access Token（アカウント全権限）を使わず、
//   プロジェクト固有の DB 接続文字列で migration を反映する。
//   詳細は docs/decisions.md の ADR-0013。
//
// 前提:
//   リポジトリ直下の .env.local に SUPABASE_DB_URL が設定されていること。
//
// Supabase CLI は --workdir 配下の `.env` / `.env.local` を自動で読む。
// しかし CLI の godotenv ベースのパーサは値にバックスラッシュや未終端クォート
// が含まれると即座にエラーにする（本プロジェクトでも実際に発生した）。
// そこで CLI を **リポジトリ外の scratch ディレクトリ** から起動し、そこへ
// `supabase/` だけをシンボリックリンクしておく。これで CLI は migration と
// config は見える一方、`.env.local` は一切パースしなくなる。

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENV_FILE = join(ROOT, ".env.local");
const SUPABASE_BIN = join(ROOT, "node_modules", "supabase", "bin", "supabase");

if (!existsSync(ENV_FILE)) {
  console.error(
    `error: ${ENV_FILE} が見つかりません。.env.example を複製してください。`,
  );
  process.exit(1);
}

if (!existsSync(SUPABASE_BIN)) {
  console.error(
    `error: ${SUPABASE_BIN} が見つかりません。"pnpm install" を実行してください。`,
  );
  process.exit(1);
}

function parseEnv(text) {
  const result = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line
      .slice(eq + 1)
      .replace(/^\s+/, "")
      .replace(/\s+$/, "");
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const env = parseEnv(readFileSync(ENV_FILE, "utf8"));
const dbUrl = env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error("error: SUPABASE_DB_URL が .env.local に設定されていません。");
  console.error(
    "       .env.example のコメントを参照し、Project Settings > Database",
  );
  console.error("       の接続文字列を貼り付けてください。");
  process.exit(1);
}

const scratchDir = mkdtempSync(join(tmpdir(), "supabase-push-"));
try {
  symlinkSync(join(ROOT, "supabase"), join(scratchDir, "supabase"));
} catch (e) {
  rmSync(scratchDir, { recursive: true, force: true });
  console.error(
    `error: scratch ディレクトリの準備に失敗しました: ${e.message}`,
  );
  process.exit(1);
}

const extraArgs = process.argv.slice(2);
const child = spawn(
  SUPABASE_BIN,
  ["db", "push", "--db-url", dbUrl, ...extraArgs],
  { stdio: "inherit", cwd: scratchDir },
);

// Ctrl-C / kill を受け取ったら子プロセスに転送し、scratch dir は `exit` ハンドラ
// 側で片付ける。親だけが signal を受けて先に exit すると orphan になるため、
// ここでは exit せずに子の終了を待つ。
function forward(signal) {
  if (!child.killed) child.kill(signal);
}
process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));

child.on("exit", (code, signal) => {
  rmSync(scratchDir, { recursive: true, force: true });
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  rmSync(scratchDir, { recursive: true, force: true });
  console.error(`error: supabase CLI の起動に失敗しました: ${err.message}`);
  process.exit(1);
});
