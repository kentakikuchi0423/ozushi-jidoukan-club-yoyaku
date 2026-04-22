"use client";

import { useEffect, useState, useTransition } from "react";

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
        <p
          role={formMessage.kind === "error" ? "alert" : "status"}
          className={`rounded-md p-3 text-sm ${
            formMessage.kind === "error"
              ? "bg-red-50 text-red-800"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {formMessage.message}
        </p>
      )}

      <Field
        id="current"
        label="現在のパスワード"
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
      />
      <Field
        id="new"
        label="新しいパスワード"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        hint="10 文字以上。英字以外（数字・記号）を 1 文字以上含めてください。"
      />
      <Field
        id="confirm"
        label="新しいパスワード（確認用）"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "更新中…" : "パスワードを更新する"}
      </button>
    </form>
  );
}

function Field({
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
  const hintId = `${inputId}-hint`;
  return (
    <div className="space-y-1">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-zinc-700"
      >
        {label}
      </label>
      <input
        id={inputId}
        type="password"
        required
        aria-required="true"
        autoComplete={autoComplete}
        aria-describedby={hint ? hintId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
      />
      {hint && (
        <p id={hintId} className="text-xs text-zinc-500">
          {hint}
        </p>
      )}
    </div>
  );
}
