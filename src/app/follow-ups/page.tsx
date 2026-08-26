import { CalendarCheck } from "lucide-react";
import { ResourceManager, type FieldConfig, type FieldOption } from "@/components/crm/ResourceManager";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { firstParam, getAgentScope, type AgentScope } from "@/lib/auth/agent-scope";
import { canManageAll } from "@/lib/auth/permissions";
import { requireSession, type SessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const typeOptions: FieldOption[] = [
  { label: "تماس", value: "CALL" },
  { label: "واتساپ", value: "WHATSAPP" },
  { label: "ایمیل", value: "EMAIL" },
  { label: "جلسه", value: "MEETING" },
  { label: "بازدید ملک", value: "PROPERTY_VISIT" },
  { label: "سایر", value: "OTHER" },
];
const statusOptions: FieldOption[] = [
  { label: "در انتظار", value: "PENDING" },
  { label: "انجام‌شده", value: "COMPLETED" },
  { label: "لغوشده", value: "CANCELLED" },
];
const bucketOptions: FieldOption[] = [
  { label: "امروز", value: "today" },
  { label: "آینده", value: "upcoming" },
  { label: "عقب‌افتاده", value: "overdue" },
];

export default async function FollowUpsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const session = await requireSession();
  const params = await searchParams;
  const resolved = resolveScope(session, firstParam(params.agentId || params.agent));
  if (!resolved.scope) {
    return (
      <DashboardShell>
        <AccessDenied message="مشاور نمی‌تواند با تغییر پارامتر URL محدوده پیگیری‌ها را عوض کند." />
      </DashboardShell>
    );
  }
  const scope = resolved.scope;
  const canChooseAgent = canManageAll(session);
  const scopedAgentFilter: Record<string, string> = scope.effectiveAgentId ? { agentId: scope.effectiveAgentId } : {};
  const statusFilter = firstParam(params.status);
  const bucketFilter = firstParam(params.bucket);
  const initialFilters: Record<string, string> = {
    ...scopedAgentFilter,
    ...(statusOptions.some((option) => option.value === statusFilter) && statusFilter ? { status: statusFilter } : {}),
    ...(bucketOptions.some((option) => option.value === bucketFilter) && bucketFilter ? { bucket: bucketFilter } : {}),
  };
  const fields: FieldConfig[] = [
    { label: "مشتری", name: "customerId", optionEndpoint: "/api/customers", optionLabel: "fullName", required: true, section: "ارتباط", type: "select" },
    ...(canChooseAgent ? [{ label: "مشاور", name: "agentId", optionEndpoint: "/api/agents", optionLabel: "fullName", section: "ارتباط", type: "select" as const }] : []),
    { label: "نوع", name: "type", options: typeOptions, section: "زمان‌بندی", type: "select" },
    { label: "زمان", name: "scheduledAt", required: true, section: "زمان‌بندی", type: "date" },
    { label: "وضعیت", name: "status", options: statusOptions, section: "زمان‌بندی", type: "select" },
    { label: "یادداشت", name: "note", section: "جزئیات", type: "textarea" },
    { label: "نتیجه", name: "result", section: "جزئیات", type: "textarea" },
    ...(canChooseAgent ? [{
      label: "پیام مدیر برای مشاور",
      name: "managerMessage",
      placeholder: "پیشنهاد، نکته یا دستور لازم برای این پیگیری را بنویسید...",
      section: "پیام مدیریت",
      type: "textarea" as const,
    }] : []),
  ];

  return (
    <DashboardShell>
      <PageHeader
        action={<CalendarCheck className="size-5 text-slate-400" />}
        title={scope.effectiveAgentId ? "پیگیری‌های مشاور" : "پیگیری‌ها"}
        description="مدیریت پیگیری‌ها، اعلان خودکار تغییرات و امکان ارسال پیام مستقیم مدیر به مشاور."
      />
      <ResourceManager
        archivePayload={{ status: "CANCELLED" }}
        columns={[
          { key: "customerId.fullName", label: "مشتری" },
          { key: "agentId.fullName", label: "مشاور" },
          { key: "type", label: "نوع" },
          { key: "scheduledAt", label: "زمان" },
          { key: "status", label: "وضعیت" },
          { key: "note", label: "یادداشت" },
          { key: "result", label: "نتیجه" },
          { key: "managerMessage", label: "پیام مدیر" },
        ]}
        canDelete={session.role === "ADMIN"}
        createDefaults={scope.effectiveAgentId ? scopedAgentFilter : undefined}
        detailBasePath="/follow-ups"
        endpoint="/api/follow-ups"
        fields={fields}
        filters={[
          { label: "دسته", name: "bucket", options: bucketOptions, type: "select" },
          { label: "وضعیت", name: "status", options: statusOptions, type: "select" },
        ]}
        initialFilters={initialFilters}
        primaryLabel="پیگیری"
      />
    </DashboardShell>
  );
}

function resolveScope(session: SessionUser, requestedAgentId?: string): { scope?: AgentScope } {
  try {
    return { scope: getAgentScope(session, requestedAgentId) };
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return {};
    throw error;
  }
}
