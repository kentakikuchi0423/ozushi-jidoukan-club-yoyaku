"use client";

import { useEffect, useState, useTransition } from "react";

import {
  FACILITY_CODES,
  FACILITY_NAMES,
  type FacilityCode,
} from "@/lib/facility";
import { addAdminAction } from "./actions";

const EMPTY_FIELD_ERRORS: Record<string, string> = {};

export function InviteAdminForm() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
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
        facilityCodes,
      });
      if (result.ok) {
        setEmail("");
        setDisplayName("");
        setFacilityCodes([]);
        setFormMessage({
          kind: "success",
          message:
            "招待メールを送信しました。相手がパスワードを設定すると、指定した館の管理者としてログインできるようになります。",
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

      <div className="space-y-1">
        <label
          htmlFor="invite-email"
          className="block text-sm font-medium text-zinc-700"
        >
          招待するメールアドレス
        </label>
        <input
          id="invite-email"
          type="email"
          required
          aria-required="true"
          autoComplete="off"
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={
            fieldErrors.email ? "invite-email-error" : undefined
          }
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass(fieldErrors.email)}
        />
        {fieldErrors.email && (
          <p id="invite-email-error" className="text-xs text-red-700">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="invite-display-name"
          className="block text-sm font-medium text-zinc-700"
        >
          表示名（任意）
        </label>
        <input
          id="invite-display-name"
          type="text"
          maxLength={100}
          aria-invalid={fieldErrors.displayName ? true : undefined}
          aria-describedby={
            fieldErrors.displayName ? "invite-display-name-error" : undefined
          }
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass(fieldErrors.displayName)}
        />
        {fieldErrors.displayName && (
          <p id="invite-display-name-error" className="text-xs text-red-700">
            {fieldErrors.displayName}
          </p>
        )}
      </div>

      <fieldset className="space-y-1">
        <legend className="block text-sm font-medium text-zinc-700">
          館の権限（複数選択可、1 つ以上）
        </legend>
        <div className="space-y-1 pt-1">
          {FACILITY_CODES.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={facilityCodes.includes(code)}
                onChange={() => toggleFacility(code)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>{FACILITY_NAMES[code]}</span>
            </label>
          ))}
        </div>
        {fieldErrors.facilityCodes && (
          <p className="text-xs text-red-700">{fieldErrors.facilityCodes}</p>
        )}
        <p className="text-xs text-zinc-500">
          3 館すべてを付与すると super_admin
          として扱われ、アカウント追加も可能になります。
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "招待送信中…" : "招待を送信する"}
      </button>
    </form>
  );
}

function inputClass(error?: string): string {
  return `w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none ${
    error
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-300 focus:border-zinc-500"
  }`;
}
