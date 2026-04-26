# マニュアル索引

本システムの使い方をまとめたマニュアルの入口です。

| 対象 | マニュアル | 内容 |
| --- | --- | --- |
| 保護者・利用者 | [`user-manual.md`](user-manual.md) | クラブの探し方、予約のお申し込み、キャンセル方法、繰り上がりの仕組み |
| 児童館・児童センターの職員 | [`admin-manual.md`](admin-manual.md) | ログイン、クラブ CRUD、クラブ・事業マスター、予約者一覧と管理者キャンセル、パスワード変更 |
| 全館管理者（super_admin） | [`admin-manual.md` §8](admin-manual.md#8-全館管理者のみの機能) | アカウント追加・削除、館の管理 |

## あわせて読みたいもの

- 運用手順（本番デプロイ、retention、監査ログ tail 等）: [`operations.md`](operations.md)
- リリース前の受入テスト: [`acceptance-tests.md`](acceptance-tests.md)
- セキュリティ上の配慮: [`security-review.md`](security-review.md)
- 要件定義・仕様: [`requirements.md`](requirements.md)
- システム設計（DB、認証、RLS 等）: [`architecture.md`](architecture.md)

## スクリーンショットについて

画像は運用開始後に順次追加予定です。

- 利用者向け: `docs/images/user/`
- 管理者向け: `docs/images/admin/`

各画像は Markdown の `![alt 文](images/...)` で参照してください。
