import type { NextConfig } from "next";

// 基本的なセキュリティヘッダーを全ルートに適用する（security-review §7 / §3）。
// Content-Security-Policy は Next.js の inline-script / Tailwind inline-style を
// 考慮するとチューニング負荷が大きいため、Phase 6 の詰めで nonce 対応とあわせて
// 導入する。現時点では以下を wire up する:
//
//   * X-Frame-Options: DENY             - clickjacking 防止
//   * X-Content-Type-Options: nosniff   - MIME sniff 防止
//   * Referrer-Policy                   - クロスオリジンへ URL が漏れないよう抑制
//   * Strict-Transport-Security         - HSTS（HTTPS 強制、preload 適格）
//   * Permissions-Policy                - 不要ブラウザ API を明示的に無効化

const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
