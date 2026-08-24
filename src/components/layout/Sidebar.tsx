"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  Bell, BrainCircuit, Bot, Building2, CalendarCheck, ChevronLeft, FileUp, Home,
  LineChart, LogOut, Menu, MessageCircle, Settings, Sparkles, Users, UserRoundCog,
  WalletCards, X, type LucideIcon,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { AgentAvatar } from "@/components/crm/AgentAvatar";
import { CRM_REALTIME_EVENT } from "@/components/layout/RealtimeBridge";
import type { UserRole } from "@/lib/auth/roles";
import type { CrmRealtimeEvent } from "@/services/realtime/realtime-bus";

type NavKey = keyof ReturnType<typeof useLanguage>["dictionary"]["nav"];
type NavigationItem = { href: string; icon: LucideIcon; label: NavKey; roles?: readonly UserRole[] };

const navigationGroups: Array<{ label: "overview" | "relationships" | "management"; items: NavigationItem[] }> = [
  { label: "overview", items: [
    { href: "/dashboard", icon: Home, label: "dashboard" },
    { href: "/properties", icon: Building2, label: "properties" },
    { href: "/projects", icon: WalletCards, label: "projects" },
  ] },
  { label: "relationships", items: [
    { href: "/customers", icon: Users, label: "customers" },
    { href: "/matches", icon: Sparkles, label: "matches" },
    { href: "/follow-ups", icon: CalendarCheck, label: "followUps" },
    { href: "/whatsapp", icon: MessageCircle, label: "whatsapp" },
    { href: "/notifications", icon: Bell, label: "notifications" },
  ] },
  { label: "management", items: [
    { href: "/ai", icon: BrainCircuit, label: "ai" },
    { href: "/agents", icon: UserRoundCog, label: "agents", roles: ["ADMIN"] },
    { href: "/import-center", icon: FileUp, label: "importCenter", roles: ["ADMIN"] },
    { href: "/automation", icon: Bot, label: "automation", roles: ["ADMIN"] },
    { href: "/reports", icon: LineChart, label: "reports" },
    { href: "/settings", icon: Settings, label: "settings", roles: ["ADMIN"] },
  ] },
];

export function Sidebar({ agentAvatar, agentName, role }: { agentAvatar?: string; agentName?: string; role: UserRole }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dictionary, locale } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const workspaceAgentId = useMemo(() => {
    const match = pathname.match(/^\/agents\/([^/]+)\/dashboard/);
    return match?.[1] || searchParams.get("agentId") || searchParams.get("agent");
  }, [pathname, searchParams]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadUnreadCount() {
      const params = new URLSearchParams();
      if (workspaceAgentId) params.set("agentId", workspaceAgentId);
      try {
        const response = await fetch(`/api/notifications/unread-count${params.size ? `?${params.toString()}` : ""}`, { signal: controller.signal });
        const result = await response.json();
        if (active && result.success) setUnreadCount(Number(result.data.count || 0));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setUnreadCount(null);
      }
    }
    void loadUnreadCount();
    function handleRealtime(event: Event) {
      const detail = (event as CustomEvent<CrmRealtimeEvent>).detail;
      if (detail?.type === "notification.created") void loadUnreadCount();
    }
    window.addEventListener(CRM_REALTIME_EVENT, handleRealtime);
    const interval = window.setInterval(loadUnreadCount, 45_000);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener(CRM_REALTIME_EVENT, handleRealtime);
      window.clearInterval(interval);
    };
  }, [workspaceAgentId]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[84px] shrink-0 items-center gap-3 border-b border-sky-100 px-5">
        <Brand />
        <button aria-label={dictionary.shell.closeMenu} className="ms-auto rounded-xl p-2 text-slate-500 transition hover:bg-white hover:text-blue-700 lg:hidden" onClick={() => setMobileOpen(false)} type="button">
          <X className="size-5" />
        </button>
      </div>
      <div className="mx-3 mt-4 shrink-0 rounded-2xl border border-sky-100 bg-white/70 p-3 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-blue-500" /></span>
          {dictionary.shell.online}
        </div>
        <LanguageSwitcher />
      </div>
      {role === "AGENT" ? (
        <div className="mx-3 mt-4 flex items-center gap-3 rounded-2xl border border-blue-100 bg-white/80 p-3 shadow-sm">
          <AgentAvatar className="size-14 text-sm" name={agentName} src={agentAvatar} />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-slate-950">{agentName || "مشاور"}</p>
            <p className="mt-1 text-[11px] font-semibold text-blue-700">{locale === "tr" ? "Danışman profili" : "پروفایل مشاور"}</p>
          </div>
        </div>
      ) : null}
      <nav className="sidebar-scroll min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navigationGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.roles || item.roles.includes(role));
          if (!visibleItems.length) return null;

          return <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{dictionary.nav[group.label]}</p>
            <div className="space-y-1">
              {visibleItems.map((item) => {
                const keepsWorkspaceScope = item.href === "/notifications" || item.href === "/reports" || item.href === "/ai";
                const href = keepsWorkspaceScope && workspaceAgentId ? `${item.href}?agentId=${workspaceAgentId}` : item.href;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link aria-current={isActive ? "page" : undefined} className={clsx("sidebar-link group", isActive && "is-active")} href={href} key={item.href} onClick={() => setMobileOpen(false)}>
                    <span className="sidebar-icon"><Icon className="size-[18px]" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1 truncate">{dictionary.nav[item.label]}</span>
                    {item.href === "/notifications" && unreadCount ? (
                      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950">
                        {unreadCount > 99 ? "99+" : unreadCount.toLocaleString(locale === "fa" ? "fa-IR" : "tr-TR")}
                      </span>
                    ) : isActive ? <ChevronLeft className="size-4 opacity-60 rtl:rotate-0 ltr:rotate-180" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>;
        })}
      </nav>
      <div className="shrink-0 border-t border-sky-100 p-3">
        <button className={clsx("sidebar-link logout-button w-full", locale === "tr" && "flex-row-reverse justify-end")} onClick={logout} type="button">
          <span className="sidebar-icon"><LogOut className="size-[18px]" /></span><span>{dictionary.shell.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <header className="mobile-bar sticky top-0 z-40 flex h-16 items-center justify-between px-4 lg:hidden">
        <button aria-label={dictionary.shell.menu} className="grid size-10 place-items-center rounded-xl border border-slate-200/80 bg-white text-slate-700 shadow-sm" onClick={() => setMobileOpen(true)} type="button"><Menu className="size-5" /></button>
        <div className="flex items-center gap-2.5">
          <div className="text-end"><p className="text-xs font-extrabold text-slate-950">HB Real Estate</p><p className="text-[10px] text-slate-500">{dictionary.shell.workspace}</p></div>
          {role === "AGENT" ? <AgentAvatar className="size-10 text-[10px]" name={agentName} src={agentAvatar} /> : <div className="brand-mark size-9 text-[11px]">HB</div>}
        </div>
        <div className="rounded-xl bg-sky-50 p-1"><LanguageSwitcher compact /></div>
      </header>
      <aside className="sidebar-panel hidden h-screen w-[280px] shrink-0 lg:sticky lg:top-0 lg:block">{content}</aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" aria-label={dictionary.shell.closeMenu} onClick={() => setMobileOpen(false)} type="button" />
          <aside className="sidebar-panel absolute inset-y-0 start-0 w-[min(86vw,320px)] shadow-2xl">{content}</aside>
        </div>
      ) : null}
    </>
  );
}

function Brand() {
  const { dictionary } = useLanguage();
  return <div className="flex min-w-0 items-center gap-3"><div className="brand-mark">HB<span /></div><div className="min-w-0"><p className="truncate text-sm font-extrabold tracking-tight text-slate-900">HB Real Estate</p><p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{dictionary.shell.product}</p></div></div>;
}
