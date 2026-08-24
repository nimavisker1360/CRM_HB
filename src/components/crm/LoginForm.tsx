"use client";

import { useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type ApiResponse =
  | { success: true; data: unknown }
  | { success: false; error: { message: string } };

function getOAuthErrorMessage(error: string | null, messages: { missing: string; failed: string }) {
  if (error === "google_user_not_found") {
    return messages.missing;
  }

  if (error?.startsWith("google_")) {
    return messages.failed;
  }

  return "";
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const { dictionary } = useLanguage();
  const [error, setError] = useState(() => getOAuthErrorMessage(searchParams.get("error"), {
    failed: dictionary.login.googleFailed,
    missing: dictionary.login.googleMissing,
  }));
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json()) as ApiResponse;

    setPending(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    const requestedPath = searchParams.get("next");
    const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/dashboard";
    window.location.replace(destination);
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="email">
          {dictionary.login.email}
        </label>
        <input
          autoComplete="email"
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/8"
          id="email"
          name="email"
          placeholder={dictionary.login.emailPlaceholder}
          required
          type="email"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="password">
          {dictionary.login.password}
        </label>
        <input
          autoComplete="current-password"
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/8"
          id="password"
          name="password"
          placeholder={dictionary.login.passwordPlaceholder}
          required
          type="password"
        />
      </div>
      {error ? <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(37,99,235,0.2)] transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        <LogIn className="size-4" />
        {pending ? dictionary.login.pending : dictionary.login.submit}
      </button>
    </form>
  );
}
