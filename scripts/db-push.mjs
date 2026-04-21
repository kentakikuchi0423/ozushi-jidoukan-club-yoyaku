// `pnpm db:push` 経由で呼ばれるラッパ。
//
// 目的:
//   Supabase Personal Access Token（アカウント全権限）を使わず、
//   プロジェクト固有の DB 接続文字列で migration を反映する。
//   詳細は docs/decisions.md の ADR-0013。
//
// 前提:
//   リポジトリ直下の .env.local に SUPABASE_DB_URL が設定されていること。
//   bash の `source` だと値に含まれる特殊文字（"、$、` など）で破綻する
//   ため、ここではミニ dotenv パーサで読み取る。

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENV_FILE = join(ROOT, ".env.local");

if (!existsSync(ENV_FILE)) {
  console.error(
    `error: ${ENV_FILE} が見つかりません。.env.example を複製してください。`,
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
    let value = line.slice(eq + 1);
    // 値の前後の空白を削る（値の中身の空白は保持）
    value = value.replace(/^\s+/, "").replace(/\s+$/, "");
    // シングル/ダブルクォートで囲まれていれば 1 セットだけ剥がす
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

const extraArgs = process.argv.slice(2);
const child = spawn(
  "pnpm",
  ["exec", "supabase", "db", "push", "--db-url", dbUrl, ...extraArgs],
  { stdio: "inherit", cwd: ROOT },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
