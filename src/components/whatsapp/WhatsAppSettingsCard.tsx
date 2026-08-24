"use client";

import { PlugZap } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type Config = {
  accessTokenConfigured: boolean;
  apiVersionConfigured: boolean;
  businessAccountConfigured: boolean;
  configured: boolean;
  maxMessagesPerAgentPerDay: number;
  mode: string;
  phoneNumberIdConfigured: boolean;
  provider: string;
  templateLanguage: string;
  templateName: string | null;
  testAllowedRecipientCount: number;
  webhookAppSecretConfigured: boolean;
  webhookConfigured: boolean;
  webhookVerifyTokenConfigured: boolean;
};

export function WhatsAppSettingsCard({ config }: { config: Config }) {
  const { locale } = useLanguage();
  const t = locale === "tr" ? {
    configured: "Yapılandırıldı", description: "Mesaj göndermeden Meta Cloud API ayarlarını doğrulayın.", failed: "Bağlantı testi başarısız oldu.",
    missing: "Eksik", notConfigured: "Yapılandırılmadı", recipients: "alıcı", security: "Bu sayfada hiçbir belirteç, gizli anahtar veya yetkilendirme başlığı gösterilmez.",
    test: "WhatsApp bağlantısını test et", testing: "Denetleniyor...",
  } : {
    configured: "تنظیم‌شده", description: "اعتبارسنجی تنظیمات Meta Cloud API بدون ارسال پیام.", failed: "آزمایش اتصال ناموفق بود.",
    missing: "موارد ناقص", notConfigured: "تنظیم‌نشده", recipients: "گیرنده", security: "هیچ توکن، کلید محرمانه یا سربرگ مجوزی در این صفحه نمایش داده نمی‌شود.",
    test: "تست اتصال واتساپ", testing: "در حال بررسی...",
  };
  const state = (value: boolean) => value ? t.configured : t.notConfigured;
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ message: string; missing?: string[]; valid: boolean } | null>(null);

  async function testConnection() {
    setTesting(true);
    setResult(null);
    try {
      const response = await fetch("/api/whatsapp/test-connection", { method: "POST" });
      const body = await response.json();
      setResult(body.success ? body.data : { message: t.failed, valid: false });
    } catch {
      setResult({ message: t.failed, valid: false });
    } finally {
      setTesting(false);
    }
  }

  const rows = [
    ["Provider", config.provider], ["Mode", config.mode], ["Phone Number ID", state(config.phoneNumberIdConfigured)],
    ["Business Account", state(config.businessAccountConfigured)], ["Access Token", state(config.accessTokenConfigured)],
    ["API Version", state(config.apiVersionConfigured)], ["Webhook", state(config.webhookConfigured)],
    ["Webhook Verify Token", state(config.webhookVerifyTokenConfigured)], ["Meta App Secret", state(config.webhookAppSecretConfigured)],
    ["Template", config.templateName || t.notConfigured], ["Template Language", config.templateLanguage],
    ["Test Recipient Allowlist", `${config.testAllowedRecipientCount} ${t.recipients}`], ["Daily Limit", String(config.maxMessagesPerAgentPerDay)],
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><h2 className="font-semibold text-slate-950">WhatsApp Integration</h2><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">TEST MODE</span></div><p className="mt-1 text-sm text-slate-500">{t.description}</p></div>
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-50" disabled={testing} onClick={testConnection} type="button"><PlugZap className="size-4" />{testing ? t.testing : t.test}</button>
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map(([label, value]) => <div className="rounded-lg bg-slate-50 p-3" key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value}</dd></div>)}</dl>
      <p className="mt-4 text-xs text-slate-500">{t.security}</p>
      {result ? <div className={`mt-4 rounded-md p-3 text-sm ${result.valid ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}><p>{result.message}</p>{result.missing?.length ? <p className="mt-1" dir="ltr">{t.missing}: {result.missing.join(", ")}</p> : null}</div> : null}
    </section>
  );
}
