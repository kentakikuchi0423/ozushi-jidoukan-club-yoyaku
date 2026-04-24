"use client";

import { useEffect, useState, useTransition } from "react";

import {
  Button,
  Field,
  FormMessage,
  Input,
  fieldAriaProps,
} from "@/components/ui";
import type { FacilityCode } from "@/lib/facility";
import { PASSWORD_HINT } from "@/lib/auth/password";
import type { Facility } from "@/server/facilities/list";
import { addAdminAction } from "./actions";

const EMPTY_FIELD_ERRORS: Record<string, string> = {};

interface Props {
  readonly facilities: ReadonlyArray<Facility>;
}

export function InviteAdminForm({ facilities }: Props) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [facilityCodes, setFacilityCodes] = useState<FacilityCode[]>([]);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_FIELD_ERRORS);
  const [formMessage, setFormMessage] = useState<
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
    | null
  >(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    document.documentElement.dataset.inviteFormReady = "true";
    return () => {
      delete document.documentElement.dataset.inviteFormReady;
    };
  }, []);

  function toggleFacility(code: FacilityCode) {
    setFacilityCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors(EMPTY_FIELD_ERRORS);
    setFormMessage(null);
    startTransition(async () => {
      const result = await addAdminAction({
        email,
        displayName,
        password,
        confirmPassword,
        facilityCodes,
      });
      if (result.ok) {
        setEmail("");
        setDisplayName("");
        setPassword("");
        setConfirmPassword("");
        setFacilityCodes([]);
        setFormMessage({
          kind: "success",
          message:
            "招待メールを送信しました。\n相手がメール内のリンクを開くと、設定したパスワードでログインできるようになります。",
        });
        return;
      }
      if (result.kind === "input") {
        setFieldErrors(result.fieldErrors);
        setFormMessage({
          kind: "error",
          message: "入力内容を確認してください。",
        });
        return;
      }
      setFormMessage({ kind: "error", message: result.message });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formMessage && (
        <FormMessage tone={formMessage.kind === "error" ? "danger" : "success"}>
          {formMessage.message}
        </FormMessage>
      )}

      <Field
        id="invite-email"
        label="招待するメールアドレス"
        error={fieldErrors.email}
        required
      >
        <Input
          id="invite-email"
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={Boolean(fieldErrors.email)}
          {...fieldAriaProps({
            id: "invite-email",
            error: fieldErrors.email,
            required: true,
          })}
        />
      </Field>

      <Field
        id="invite-display-name"
        label="表示名（任意）"
        error={fieldErrors.displayName}
      >
        <Input
          id="invite-display-name"
          type="text"
          maxLength={100}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          invalid={Boolean(fieldErrors.displayName)}
          {...fieldAriaProps({
            id: "invite-display-name",
            error: fieldErrors.displayName,
          })}
        />
      </Field>

      <Field
        id="invite-password"
        label="初期パスワード"
        hint={PASSWORD_HINT}
        error={fieldErrors.password}
        required
      >
        <Input
          id="invite-password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={Boolean(fieldErrors.password)}
          {...fieldAriaProps({
            id: "invite-password",
            error: fieldErrors.password,
            hint: PASSWORD_HINT,
            required: true,
          })}
        />
      </Field>

      <Field
        id="invite-password-confirm"
        label="初期パスワード（確認用）"
        error={fieldErrors.confirmPassword}
        required
      >
        <Input
          id="invite-password-confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          invalid={Boolean(fieldErrors.confirmPassword)}
          {...fieldAriaProps({
            id: "invite-password-confirm",
            error: fieldErrors.confirmPassword,
            required: true,
          })}
        />
      </Field>

      <fieldset className="space-y-1">
        <legend className="block text-sm font-medium text-[var(--color-foreground,theme(colors.zinc.700))]">
          館の権限（複数選択可、1 つ以上）
        </legend>
        <div className="space-y-1 pt-1">
          {facilities.length === 0 ? (
            <p className="text-xs text-[var(--color-muted,theme(colors.zinc.500))]">
              有効な館がありません。先に「館の管理」で登録してください。
            </p>
          ) : (
            facilities.map((f) => (
              <label
                key={f.code}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={facilityCodes.includes(f.code)}
                  onChange={() => toggleFacility(f.code)}
                  className="h-4 w-4 rounded border-[var(--color-border,theme(colors.zinc.300))]"
                />
                <span>{f.name}</span>
              </label>
            ))
          )}
        </div>
        {fieldErrors.facilityCodes && (
          <p className="text-xs text-[var(--color-danger,theme(colors.red.700))]">
            {fieldErrors.facilityCodes}
          </p>
        )}
        <p className="text-xs text-[var(--color-muted,theme(colors.zinc.500))]">
          有効な館をすべて付与すると全館管理者として扱われ、アカウント追加や館の管理も可能になります。
        </p>
      </fieldset>

      <Button type="submit" disabled={pending} fullWidth>
        {pending ? "招待送信中…" : "招待を送信する"}
      </Button>
    </form>
  );
}
