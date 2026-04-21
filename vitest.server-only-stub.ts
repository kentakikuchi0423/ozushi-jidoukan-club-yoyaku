// Vitest 用の `server-only` スタブ。
//
// 本番ビルドでは Next.js の bundler が `server-only` を以下のように差し替える:
//   * サーバー向けバンドル -> 空モジュール
//   * クライアント向けバンドル -> throw する本体
// これで「server-only」ファイルが client component に混入したら build エラーになる。
//
// Vitest は Next.js の bundler を通さないため、`import "server-only"` が
// そのまま評価されて即座に throw してしまう。ここを alias で空モジュールに
// 差し替えることで、server-only 付きのドメインロジックも jsdom 環境の単体
// テストから import できるようにする。
export {};
