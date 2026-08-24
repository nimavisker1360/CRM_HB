import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  accent?: "emerald" | "amber" | "blue" | "violet";
};

const accentClasses = {
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  blue: "bg-sky-50 text-sky-700 ring-sky-100",
  emerald: "bg-cyan-50 text-sky-700 ring-sky-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
};

export function StatCard({ accent = "emerald", icon: Icon, label, note, value }: StatCardProps) {
  return (
    <div className="app-card group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="absolute -end-8 -top-10 size-24 rounded-full bg-slate-100/60 transition-transform duration-500 group-hover:scale-125" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-600">{label}</p>
        <span className={`relative flex size-10 items-center justify-center rounded-xl ring-1 ${accentClasses[accent]}`}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-[28px] font-black tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500">{note}</p>
    </div>
  );
}
