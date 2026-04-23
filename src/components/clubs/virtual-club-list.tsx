"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { ClubListing } from "@/lib/clubs/types";
import { ClubCard } from "./club-card";

// 公開 `/` と管理 `/admin/clubs` の両方で使う仮想スクロール対応リスト。
// @tanstack/react-virtual の `useWindowVirtualizer` を使い、ブラウザ自体の
// スクロール位置に追従して表示する行だけを描画する。件数が少ないときは
// 全件が viewport に入るので実質通常レンダリングになる。
//
// サーバ側で filter 済みの `clubs` 配列を受け取り、カード間に 12px の gap を
// 設けつつ絶対配置する。初期推定高さは最近のカード実測値から 170px としたが、
// React が描画した時点で measureElement が本物のサイズに差し替える。

interface Props {
  readonly clubs: ReadonlyArray<ClubListing>;
  readonly variant: "public" | "admin";
}

const GAP_PX = 12;

export function VirtualClubList({ clubs, variant }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // リストが body のどこから始まるかを `useWindowVirtualizer` に教える。
  // サーバ SSR 時点では 0、クライアントでレイアウト後に `offsetTop` を取る。
  useLayoutEffect(() => {
    if (parentRef.current) {
      setScrollMargin(parentRef.current.offsetTop);
    }
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: clubs.length,
    estimateSize: () => 170 + GAP_PX,
    overscan: 5,
    scrollMargin,
  });

  // viewport リサイズ時（モバイル → 横向き等）に再計測する。
  useEffect(() => {
    const handler = () => virtualizer.measure();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [virtualizer]);

  const totalSize = virtualizer.getTotalSize();
  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="relative" data-testid="virtual-club-list">
      <ul
        style={{
          height: `${totalSize}px`,
          position: "relative",
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {items.map((virtualItem) => {
          const club = clubs[virtualItem.index];
          return (
            <li
              key={club.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start - scrollMargin}px)`,
                paddingBottom: `${GAP_PX}px`,
              }}
            >
              <ClubCard club={club} variant={variant} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
