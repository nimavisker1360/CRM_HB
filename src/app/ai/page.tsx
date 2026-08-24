import { AccessDenied } from "@/components/layout/AccessDenied";
import { AIChat } from "@/components/ai/AIChat";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Activity, Bot, CircleCheck, CircleX } from "lucide-react";
import { firstParam, getAgentScope } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { getServerLocale } from "@/lib/i18n-server";
import { publicAIStatus } from "@/services/ai/ai.config";
import { listAIConversations } from "@/services/ai/ai.conversation";
import { getAIUsageSummary } from "@/services/ai/ai.usage";

export const dynamic = "force-dynamic";
type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AIPage({ searchParams }: { searchParams: PageSearchParams }) {
  const session = await requireSession();
  const locale = await getServerLocale();
  const t = locale === "tr" ? {
    accessDenied: "Akıllı asistanın kapsamı başka bir danışmanla değiştirilemez.",
    adminSuggestions: ["En fazla gecikmiş takibi olan danışman kim?", "Danışmanların bu ayki performansını karşılaştır.", "En çok talep hangi ilçede?", "Son 30 günde kaç yeni fırsat kaydedildi?"],
    agentDescription: "Bu danışmanın çalışma alanı ve izin verilen verileriyle sınırlı akıllı asistan.",
    agentSuggestions: ["Bugün takip edilmesi gereken müşterilerimi göster.", "En iyi yeni eşleşmelerim hangileri?", "Hangi müşterilerim müzakere aşamasında?", "Henüz gayrimenkul gönderilmeyen müşterilerimi göster."],
    allUsers: "Tüm kullanıcılar", configured: "Yapılandırıldı", failedMonth: "Bu ay başarısız", failedNote: "Ham sağlayıcı hatası gösterilmez",
    monthRequests: "Bu ayki istekler", notConfigured: "Yapılandırılmadı", providerStatus: "Sağlayıcı durumu",
    requests: "istek", requestsToday: "Bugünkü istekler", unsuccessful: "başarısız", usageByAgent: "Danışmana göre asistan kullanımı — bu ay",
    usageNote: "Başarılı ve başarısız istekler dahil", companyDescription: "Kontrollü araçlara ve gerçek CRM verilerine dayalı şirket içi asistan.",
  } : {
    accessDenied: "امکان تغییر محدوده دستیار هوشمند به مشاور دیگر وجود ندارد.",
    adminSuggestions: ["کدام مشاور بیشترین پیگیری عقب‌افتاده را دارد؟", "عملکرد مشاوران این ماه را مقایسه کن.", "بیشترین تقاضا برای کدام منطقه است؟", "چند سرنخ جدید در ۳۰ روز گذشته ثبت شده؟"],
    agentDescription: "دستیار هوشمند محدود به فضای کاری همین مشاور و داده‌های مجاز او.",
    agentSuggestions: ["مشتری‌های من که امروز نیاز به پیگیری دارند را نشان بده.", "بهترین تطبیق‌های جدید من چیست؟", "کدام مشتری‌های من در مرحله مذاکره هستند؟", "مشتری‌هایی که هنوز ملکی برایشان ارسال نشده را نشان بده."],
    allUsers: "تمام کاربران", configured: "تنظیم‌شده", failedMonth: "ناموفق این ماه", failedNote: "بدون نمایش خطای خام ارائه‌دهنده",
    monthRequests: "درخواست‌های این ماه", notConfigured: "تنظیم‌نشده", providerStatus: "وضعیت ارائه‌دهنده",
    requests: "درخواست", requestsToday: "درخواست‌های امروز", unsuccessful: "ناموفق", usageByAgent: "مصرف دستیار بر اساس مشاور — این ماه",
    usageNote: "شامل موفق و ناموفق", companyDescription: "دستیار داخلی شرکت بر پایه ابزارهای کنترل‌شده و داده واقعی CRM.",
  };
  const params = await searchParams;
  let scope;
  try { scope = getAgentScope(session, firstParam(params.agentId || params.agent)); }
  catch { return <DashboardShell><AccessDenied message={t.accessDenied} /></DashboardShell>; }
  const [conversations, usage] = await Promise.all([listAIConversations(session), session.role !== "AGENT" ? getAIUsageSummary() : Promise.resolve(null)]);
  const status = publicAIStatus();
  return <DashboardShell>
    <PageHeader title="HB AI Assistant" description={scope.effectiveAgentId ? t.agentDescription : t.companyDescription} />
    <div className="space-y-5 p-4 sm:p-6">
      {session.role !== "AGENT" && usage ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={status.configured ? CircleCheck : CircleX} label={t.providerStatus} value={status.configured ? t.configured : t.notConfigured} note={`${status.provider} · ${status.model}`} />
        <StatCard icon={Bot} label={t.requestsToday} value={usage.today.toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")} note={t.allUsers} />
        <StatCard icon={Activity} label={t.monthRequests} value={usage.thisMonth.toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")} note={t.usageNote} />
        <StatCard icon={CircleX} label={t.failedMonth} value={usage.failedThisMonth.toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")} note={t.failedNote} />
      </section> : null}
      {session.role !== "AGENT" && usage?.byAgent.length ? <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-950">{t.usageByAgent}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{usage.byAgent.map((item) => <div className="rounded-md border border-slate-100 bg-slate-50 p-3" key={item.agentId || "admin"}><p className="truncate text-sm font-medium text-slate-800">{String(item.agentName)}</p><p className="mt-1 text-xs text-slate-500">{Number(item.requests).toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")} {t.requests} · {Number(item.failures).toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")} {t.unsuccessful}</p></div>)}</div>
      </section> : null}
      <AIChat configured={status.configured} conversations={conversations} initialPrompt={firstParam(params.q) || ""} role={session.role} suggestions={session.role === "AGENT" ? t.agentSuggestions : t.adminSuggestions} workspaceAgentId={scope.effectiveAgentId} />
    </div>
  </DashboardShell>;
}
