"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import type { AutomationJobType } from "@/services/automation/automation.types";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { automationStatusLabel } from "@/lib/automation-i18n";

type AutomationRunButtonProps = {
  heavy?: boolean;
  label?: string;
  type: AutomationJobType;
};

export function AutomationRunButton({ heavy, label, type }: AutomationRunButtonProps) {
  const { locale } = useLanguage();
  const t = locale === "tr" ? {
    confirm: "Bu işlem çok sayıda kaydı işleyebilir. Devam etmek istiyor musunuz?", failed: "Otomasyon çalıştırılamadı.",
    processed: "kayıt işlendi", run: "Şimdi çalıştır", running: "Çalıştırılıyor...",
  } : {
    confirm: "این عملیات ممکن است تعداد زیادی رکورد را پردازش کند. ادامه می‌دهید؟", failed: "اجرای اتوماسیون ناموفق بود.",
    processed: "رکورد پردازش شد", run: "اجرای اکنون", running: "در حال اجرا...",
  };
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    if (heavy && !window.confirm(t.confirm)) return;
    setIsRunning(true);
    setMessage("");

    try {
      const response = await fetch("/api/automation/run", {
        body: JSON.stringify({ type }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(t.failed);
        return;
      }
      setMessage(`${automationStatusLabel(String(result.data.status), locale)}: ${result.data.processed} ${t.processed}`);
      router.refresh();
    } catch {
      setMessage(t.failed);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isRunning}
        onClick={run}
        type="button"
      >
        <Play className="size-4" aria-hidden="true" />
        {isRunning ? t.running : label || t.run}
      </button>
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
