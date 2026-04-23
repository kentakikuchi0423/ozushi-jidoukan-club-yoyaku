-- admin 削除を安全に行うための FK 調整。
--
-- 旧構成:
--   audit_logs.admin_id -> admins(id)  ... 削除時の挙動未指定（= NO ACTION）
--   clubs.created_by    -> admins(id)  ... 同上
--
-- 全館管理者が「アカウント追加」画面から不要な管理者を削除できるようにしたい。
-- `admin.auth.admin.deleteUser(id)` は auth.users を消し、ON DELETE CASCADE で
-- `admins` 行まで伝播するが、audit_logs / clubs.created_by の FK が残っていると
-- FK 違反で cascade が失敗する。
--
-- 方針: 履歴は消さずに残したいので `ON DELETE SET NULL` に切り替える。
-- 監査ログ・クラブのレコードは保持され、作成者だけ `NULL` に置き換わる。

alter table public.audit_logs
  drop constraint audit_logs_admin_id_fkey,
  add  constraint audit_logs_admin_id_fkey
    foreign key (admin_id) references public.admins(id) on delete set null;

alter table public.clubs
  drop constraint clubs_created_by_fkey,
  add  constraint clubs_created_by_fkey
    foreign key (created_by) references public.admins(id) on delete set null;
