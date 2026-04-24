"use client";

import { useEffect, useState, useTransition } from "react";

import {
  Button,
  Field as UIField,
  FormMessage,
  Input,
  fieldAriaProps,
} from "@/components/ui";

import { changePasswordAction } from "./actions";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formMessage, setFormMessage] = useState<
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
    | null
  >(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    document.documentElement.dataset.passwordFormReady = "true";
    return () => {
      delete document.documentElement.dataset.passwordFormReady;
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormMessage(null);
    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (result.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setFormMessage({
          kind: "success",
          message: "パスワードを更新しました。",
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

      <PasswordField
        id="current"
        label="現在のパスワード"
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
      />
      <PasswordField
        id="new"
        label="新しいパスワード"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        hint={"8 文字以上。\n英字と数字を 1 文字以上含めてください。"}
      />
      <PasswordField
        id="confirm"
        label="新しいパスワード（確認用）"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />

      <Button type="submit" disabled={pending} fullWidth>
        {pending ? "更新中…" : "パスワードを更新する"}
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  const inputId = `password-${id}`;
  return (
    <UIField id={inputId} label={label} hint={hint} required>
      <Input
        id={inputId}
        type="password"
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...fieldAriaProps({ id: inputId, hint, required: true })}
      />
    </UIField>
  );
}
