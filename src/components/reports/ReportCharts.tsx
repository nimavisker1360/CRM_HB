"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AgentPerformance, DemandItem, FunnelStage, LeadSourcePerformance, TimeSeriesPoint } from "@/services/reports/report.types";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const COLORS = ["#0f172a", "#0284c7", "#059669", "#d97706", "#7c3aed", "#dc2626", "#64748b"];

type ReportChartsProps = {
  agents: AgentPerformance[];
  districts: DemandItem[];
  funnel: FunnelStage[];
  leadSources: LeadSourcePerformance[];
  timeSeries: TimeSeriesPoint[];
};

export function ReportCharts({ agents, districts, funnel, leadSources, timeSeries }: ReportChartsProps) {
  const { locale } = useLanguage();
  const t = locale === "tr" ? {
    agentDescription: "Başarılı satışları, görüşmeleri ve tamamlanan takipleri karşılaştırır", agentPerformance: "Danışman performansı",
    chartSummary: "Grafiğin sayısal özetini görüntüle", completedFollowUp: "Tamamlanan takip", count: "Sayı", demand: "talep",
    districts: "En çok talep edilen ilçeler", districtsDescription: "Müşterilerin en çok talep ettiği ilçeler", empty: "Grafiği göstermek için henüz yeterli veri yok.",
    followUp: "takip", funnel: "Satış hunisi", funnelDescription: "Seçilen gruptaki her müşteri durumunun sayısı", lead: "fırsat",
    leadSourceDescription: "Seçilen aralıktaki müşteri kaynaklarının payı", leadSources: "Fırsat kaynakları", meeting: "Görüşme", newLead: "Yeni fırsat",
    trend: "Fırsat ve işlem eğilimi", trendDescription: "Yeni fırsatlar, görüşmeler, başarılı satışlar ve tamamlanan takipler", won: "Başarılı",
  } : {
    agentDescription: "مقایسه فروش موفق، جلسات و پیگیری‌های تکمیل‌شده", agentPerformance: "عملکرد مشاوران",
    chartSummary: "مشاهده خلاصه عددی نمودار", completedFollowUp: "پیگیری تکمیل‌شده", count: "تعداد", demand: "درخواست",
    districts: "مناطق پرتقاضا", districtsDescription: "بیشترین منطقه‌های درخواستی مشتریان", empty: "هنوز داده کافی برای نمایش نمودار وجود ندارد.",
    followUp: "پیگیری", funnel: "قیف فروش", funnelDescription: "تعداد مشتریان در هر وضعیت از گروه انتخاب‌شده", lead: "سرنخ",
    leadSourceDescription: "سهم منابع ورودی مشتریان در بازه انتخاب‌شده", leadSources: "منابع سرنخ", meeting: "جلسه", newLead: "سرنخ جدید",
    trend: "روند سرنخ‌ها و عملیات", trendDescription: "سرنخ‌های جدید، جلسات، فروش‌های موفق و پیگیری‌های تکمیل‌شده", won: "موفق",
  };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ChartCard title={t.trend} description={t.trendDescription}>
        {timeSeries.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeSeries} accessibilityLayer margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0284c7" stopOpacity={0.35} /><stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="newLeads" name={t.newLead} stroke="#0284c7" fill="url(#leadsFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="meetings" name={t.meeting} stroke="#d97706" fill="transparent" strokeWidth={2} />
              <Area type="monotone" dataKey="won" name={t.won} stroke="#059669" fill="transparent" strokeWidth={2} />
              <Area type="monotone" dataKey="completedFollowUps" name={t.completedFollowUp} stroke="#7c3aed" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <EmptyChart text={t.empty} />}
        <AccessibleSummary label={t.chartSummary} rows={timeSeries.map((item) => `${item.label}: ${item.newLeads} ${t.lead}, ${item.meetings} ${t.meeting}, ${item.won} ${t.won}, ${item.completedFollowUps} ${t.followUp}`)} />
      </ChartCard>

      <ChartCard title={t.funnel} description={t.funnelDescription}>
        {funnel.some((item) => item.count) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnel} layout="vertical" accessibilityLayer margin={{ top: 4, right: 24, left: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={105} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name={t.count} fill="#0f172a" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart text={t.empty} />}
        <AccessibleSummary label={t.chartSummary} rows={funnel.map((item) => `${item.label}: ${item.count}`)} />
      </ChartCard>

      {agents.length ? <ChartCard title={t.agentPerformance} description={t.agentDescription}>
        {agents.some((item) => item.won || item.meetings || item.completedFollowUps) ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={agents.slice(0, 10)} accessibilityLayer margin={{ top: 8, right: 8, left: 0, bottom: 44 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="agentName" angle={-25} textAnchor="end" interval={0} height={72} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={36} />
              <Tooltip />
              <Legend />
              <Bar dataKey="won" name={t.won} fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="meetings" name={t.meeting} fill="#d97706" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completedFollowUps" name={t.completedFollowUp} fill="#0284c7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart text={t.empty} />}
        <AccessibleSummary label={t.chartSummary} rows={agents.map((item) => `${item.agentName}: ${item.won} ${t.won}, ${item.meetings} ${t.meeting}, ${item.completedFollowUps} ${t.followUp}`)} />
      </ChartCard> : null}

      <ChartCard title={t.leadSources} description={t.leadSourceDescription}>
        {leadSources.some((item) => item.leads) ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart accessibilityLayer>
              <Pie data={leadSources.slice(0, 8)} dataKey="leads" nameKey="source" innerRadius={58} outerRadius={96} paddingAngle={2}>
                {leadSources.slice(0, 8).map((item, index) => <Cell key={item.source} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : <EmptyChart text={t.empty} />}
        <AccessibleSummary label={t.chartSummary} rows={leadSources.map((item) => `${item.source}: ${item.leads} ${t.lead}, ${item.won} ${t.won}`)} />
      </ChartCard>

      <ChartCard title={t.districts} description={t.districtsDescription} wide>
        {districts.some((item) => item.count) ? (
          <ResponsiveContainer width="100%" height={Math.max(260, districts.slice(0, 10).length * 34)}>
            <BarChart data={districts.slice(0, 10)} layout="vertical" accessibilityLayer margin={{ top: 4, right: 24, left: 20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name={t.demand} fill="#0284c7" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart text={t.empty} />}
        <AccessibleSummary label={t.chartSummary} rows={districts.map((item) => `${item.label}: ${item.count} ${t.demand}`)} />
      </ChartCard>
    </div>
  );
}

function ChartCard({ children, description, title, wide = false }: { children: React.ReactNode; description: string; title: string; wide?: boolean }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${wide ? "xl:col-span-2" : ""}`} aria-label={title}>
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-5 min-h-72 direction-ltr" dir="ltr">{children}</div>
    </section>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 text-center text-sm text-slate-500">{text}</div>;
}

function AccessibleSummary({ label, rows }: { label: string; rows: string[] }) {
  if (!rows.length) return null;
  return (
    <details className="mt-3 text-start text-xs text-slate-500">
      <summary className="cursor-pointer font-medium text-slate-600">{label}</summary>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {rows.map((row, index) => <li key={`${row}-${index}`}>{row}</li>)}
      </ul>
    </details>
  );
}
