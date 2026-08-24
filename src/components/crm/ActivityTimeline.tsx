import {
  CheckCircle2,
  Clock3,
  History,
  ImageIcon,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { localizeActivity, type ActivityKind, type ActivityLike } from "@/lib/activity-i18n";
import { formatGregorianDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/i18n";

type ActivityRecord = ActivityLike & {
  _id: unknown;
  createdAt?: unknown;
};

type ActivityTimelineProps = {
  activities: ActivityRecord[];
  locale: AppLocale;
  title?: string;
  emptyMessage?: string;
};

const visuals: Record<ActivityKind, { icon: LucideIcon; className: string }> = {
  archived: { icon: UserX, className: "bg-amber-50 text-amber-700 ring-amber-100" },
  avatar: { icon: ImageIcon, className: "bg-violet-50 text-violet-700 ring-violet-100" },
  completed: { icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  created: { icon: Plus, className: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  deleted: { icon: Trash2, className: "bg-red-50 text-red-700 ring-red-100" },
  generic: { icon: RefreshCcw, className: "bg-slate-50 text-slate-600 ring-slate-100" },
  imported: { icon: Upload, className: "bg-cyan-50 text-cyan-700 ring-cyan-100" },
  message: { icon: MessageCircle, className: "bg-green-50 text-green-700 ring-green-100" },
  reassigned: { icon: RefreshCcw, className: "bg-blue-50 text-blue-700 ring-blue-100" },
  started: { icon: Play, className: "bg-sky-50 text-sky-700 ring-sky-100" },
  updated: { icon: Pencil, className: "bg-blue-50 text-blue-700 ring-blue-100" },
};

export function ActivityTimeline({ activities, emptyMessage, locale, title }: ActivityTimelineProps) {
  const labels = locale === "tr"
    ? { empty: "Henüz aktivite kaydedilmedi.", events: "kayıt", title: "Aktiviteler" }
    : { empty: "هنوز فعالیتی ثبت نشده است.", events: "رویداد", title: "فعالیت‌ها" };
  const count = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn").format(activities.length);

  return (
    <section className="app-card overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
            <History className="size-5" aria-hidden="true" />
          </span>
          <h2 className="truncate font-extrabold text-slate-950">{title || labels.title}</h2>
        </div>
        {activities.length ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {count} {labels.events}
          </span>
        ) : null}
      </div>

      <div className="p-5 sm:p-6">
        {activities.length ? (
          <ol className="m-0 list-none p-0">
            {activities.map((activity, index) => {
              const localized = localizeActivity(activity, locale);
              const visual = visuals[localized.kind];
              const Icon = visual.icon;

              return (
                <li className="relative flex gap-3 pb-5 last:pb-0" key={String(activity._id)}>
                  {index < activities.length - 1 ? (
                    <span className="absolute bottom-0 start-[17px] top-9 w-px bg-gradient-to-b from-blue-200 to-slate-100" aria-hidden="true" />
                  ) : null}
                  <span className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full ring-4 ${visual.className}`}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 transition-colors hover:border-blue-100 hover:bg-blue-50/40">
                    <p
                      className="text-sm font-bold leading-7 text-slate-800 [unicode-bidi:plaintext]"
                      dir={locale === "fa" ? "rtl" : "ltr"}
                    >
                      {localized.text}
                    </p>
                    <time className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      {formatGregorianDateTime(activity.createdAt, locale)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-medium text-slate-500">
            {emptyMessage || labels.empty}
          </div>
        )}
      </div>
    </section>
  );
}
