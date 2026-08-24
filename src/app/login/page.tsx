import { LoginForm } from "@/components/crm/LoginForm";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const dictionary = getDictionary(await getServerLocale());

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#eff6ff] lg:grid-cols-[1.05fr_0.95fr]">
      <div className="pointer-events-none absolute -start-40 top-1/3 size-[460px] rounded-full bg-sky-200/55 blur-[100px]" />
      <section className="relative hidden overflow-hidden bg-[#172d52] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(96,165,250,0.25),transparent_34%),radial-gradient(circle_at_90%_80%,rgba(191,219,254,0.12),transparent_30%)]" />
        <div className="relative flex items-center gap-3">
          <div className="brand-mark">HB<span /></div>
          <div><p className="text-sm font-extrabold">HB Real Estate</p><p className="text-xs text-white/45">{dictionary.shell.product}</p></div>
        </div>
        <div className="relative max-w-xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-sky-200">
            <Sparkles className="size-4" />{dictionary.login.eyebrow}
          </div>
          <h1 className="text-4xl font-black leading-[1.25] tracking-tight xl:text-5xl">{dictionary.login.headline}</h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-white/55">{dictionary.login.description}</p>
          <div className="mt-9 space-y-4 text-sm text-white/75">
            <p className="flex items-center gap-3"><CheckCircle2 className="size-5 text-sky-300" />{dictionary.login.benefitOne}</p>
            <p className="flex items-center gap-3"><CheckCircle2 className="size-5 text-sky-300" />{dictionary.login.benefitTwo}</p>
          </div>
        </div>
        <p className="relative text-xs text-white/30">© {new Date().getFullYear()} HB Real Estate</p>
      </section>

      <section className="relative flex min-h-screen items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="absolute end-5 top-5 rounded-2xl bg-blue-50 p-1.5 sm:end-8 sm:top-8"><LanguageSwitcher /></div>
        <div className="w-full max-w-[470px]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <div className="brand-mark">HB<span /></div>
            <div><p className="text-sm font-extrabold text-slate-950">HB Real Estate</p><p className="text-xs text-slate-500">{dictionary.shell.product}</p></div>
          </div>
          <div className="app-card border-white/70 p-6 shadow-[0_30px_80px_rgba(15,45,36,0.12)] sm:p-9">
            <div className="mb-8">
              <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><ShieldCheck className="size-6" /></div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">{dictionary.login.welcome}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{dictionary.login.subtitle}</p>
            </div>
            <LoginForm />
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400"><ShieldCheck className="size-3.5" />{dictionary.login.secure}</p>
        </div>
      </section>
    </main>
  );
}
