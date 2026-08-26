"use client";

import { MessageCircle, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildFollowUpPreview,
  buildMatchPreview,
  buildPropertyPreview,
} from "@/services/whatsapp/whatsapp.templates";
import { useLanguage } from "@/components/i18n/LanguageProvider";

function normalizePropertySearch(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

function propertySearchValue(property: WhatsAppPropertyOption) {
  return normalizePropertySearch([
    property.propertyCode,
    property.title,
    property.city,
    property.district,
  ].filter(Boolean).join(" "));
}

function propertyOptionLabel(property: WhatsAppPropertyOption) {
  const location = [property.city, property.district].filter(Boolean).join(" / ");
  return [property.title, property.propertyCode, location].filter(Boolean).join(" — ");
}

function propertyOptionFromApi(property: Record<string, unknown>): WhatsAppPropertyOption {
  return {
    city: property.city ? String(property.city) : undefined,
    currency: property.currency ? String(property.currency) : undefined,
    district: property.district ? String(property.district) : undefined,
    grossArea: property.grossArea === undefined ? undefined : Number(property.grossArea),
    id: String(property._id || ""),
    images: Array.isArray(property.images) ? property.images.map(String) : [],
    price: property.price === undefined ? undefined : Number(property.price),
    propertyCode: property.propertyCode ? String(property.propertyCode) : undefined,
    rooms: property.rooms === undefined ? undefined : Number(property.rooms),
    title: String(property.title || property.propertyCode || "Property"),
    videoUrl: property.videoUrl ? String(property.videoUrl) : undefined,
  };
}

export type WhatsAppPropertyOption = {
  city?: string;
  currency?: string;
  district?: string;
  grossArea?: number;
  id: string;
  images?: string[];
  price?: number;
  propertyCode?: string;
  rooms?: number;
  title: string;
  videoUrl?: string;
};

export type WhatsAppMatchOption = {
  id: string;
  property: WhatsAppPropertyOption;
  score: number;
};

type Props = {
  agent?: { fullName?: string; name?: string };
  buttonLabel?: string;
  customer: { fullName: string; id: string; phone?: string; whatsapp?: string };
  followUp?: { id: string; note?: string };
  includeActivePropertyCatalog?: boolean;
  matches?: WhatsAppMatchOption[];
  onSent?: () => void;
  preselectedMatchId?: string;
  preselectedPropertyId?: string;
  preselectedType?: "TEMPLATE" | "PROPERTY" | "MATCH" | "FOLLOWUP" | "TEXT";
  properties?: WhatsAppPropertyOption[];
};

type PublicConfig = {
  configured: boolean;
  mode: string;
  templateLanguage: string;
  templateName: string | null;
  testMode: boolean;
  webhookConfigured: boolean;
};

function createRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `wa_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function WhatsAppComposer({
  agent,
  buttonLabel,
  customer,
  followUp,
  includeActivePropertyCatalog = false,
  matches = [],
  onSent,
  preselectedMatchId,
  preselectedPropertyId,
  preselectedType = "TEMPLATE",
  properties = [],
}: Props) {
  const { locale } = useLanguage();
  const t = useMemo(() => locale === "tr" ? {
    close: "Kapat", confirm: "Mesajı onayla", confirmPrompt: "Bu mesaj şu numaraya gönderilsin mi?", confirmSend: "Onayla ve gönder",
    connectionError: "WhatsApp bağlantı durumu alınamadı.", defaultButton: "WhatsApp mesajı gönder", duplicate: "Bu istek daha önce kaydedildi ve tekrar gönderilmedi.",
    failedBefore: "Bu deneme daha önce başarısız olarak kaydedildi.", followUp: "Takip", freeText: "Serbest metin (yalnızca 24 saatlik pencere)",
    internalPreview: "Bu dahili bir önizlemedir; gerçek gönderim yapılandırılmış Meta şablonuyla yapılır.", match: "Eşleşme", matchOffer: "Eşleşme önerisi",
    media: "fotoğraf/video dosyası bu mesajla gönderilecek.", mediaRule: "Medya yalnızca müşteri son 24 saat içinde WhatsApp üzerinden mesaj gönderdiyse gönderilebilir.",
    messageSent: "Mesaj Meta tarafından kabul edildi; teslimat henüz onaylanmadı.", messageType: "Mesaj türü", notConfigured: "Yapılandırılmadı", phone: "Telefon numarası", property: "Gayrimenkul",
    prepareStartTemplate: "Proje olmadan sohbet şablonunu gönder",
    activeProperties: "Tüm aktif gayrimenkuller", catalogError: "Aktif gayrimenkuller yüklenemedi.", catalogLoading: "Aktif gayrimenkuller yükleniyor...",
    noPropertyResult: "Aramanızla eşleşen aktif gayrimenkul bulunamadı.", propertyIntro: "Gayrimenkul tanıtımı", propertySearch: "Kod, başlık, şehir veya bölge ara",
    recipient: "Alıcı", recommendedProperties: "Önerilen gayrimenkuller", sendError: "WhatsApp mesajı gönderilemedi.", sending: "Gönderiliyor...", templateMissing: "Meta test şablonu henüz yapılandırılmadı.",
    templatePreview: (name: string, language: string) => `${name} adlı onaylı Meta şablonu ${language} dilinde gönderilecek.`, templateTest: "Meta test şablonu", text: "Metin",
    startTemplateSent: "hello_world şablonu kabul edildi; bu mesaj projeyi içermez. Alıcı yanıt verdikten sonra projeyi yeniden gönderin.", title: "WhatsApp mesajı gönder", whatsapp: "WhatsApp numarası",
  } : {
    close: "بستن", confirm: "تأیید پیام", confirmPrompt: "این پیام به شماره زیر ارسال شود؟", confirmSend: "تأیید و ارسال",
    connectionError: "وضعیت اتصال واتساپ دریافت نشد.", defaultButton: "ارسال پیام واتساپ", duplicate: "این درخواست قبلاً ثبت شده بود و دوباره ارسال نشد.",
    failedBefore: "این تلاش قبلاً ناموفق ثبت شده است.", followUp: "پیگیری", freeText: "متن آزاد (فقط پنجره ۲۴ ساعته)",
    internalPreview: "این یک پیش‌نمایش داخلی است؛ ارسال واقعی با قالب تنظیم‌شده Meta انجام می‌شود.", match: "تطبیق", matchOffer: "پیشنهاد تطبیق",
    media: "فایل عکس/ویدیو همراه این پیام ارسال می‌شود.", mediaRule: "ارسال رسانه زمانی مجاز است که مشتری در ۲۴ ساعت اخیر در واتساپ پیام داده باشد.",
    messageSent: "درخواست پیام توسط Meta پذیرفته شد؛ تحویل هنوز تأیید نشده است.", messageType: "نوع پیام", notConfigured: "تنظیم نشده", phone: "شماره تلفن", property: "ملک",
    prepareStartTemplate: "ارسال قالب گفتگو بدون پروژه",
    activeProperties: "همه املاک فعال", catalogError: "دریافت فهرست املاک فعال ناموفق بود.", catalogLoading: "در حال دریافت املاک فعال...",
    noPropertyResult: "ملک فعالی مطابق جست‌وجوی شما پیدا نشد.", propertyIntro: "معرفی ملک", propertySearch: "جست‌وجوی کد، عنوان، شهر یا منطقه",
    recipient: "گیرنده", recommendedProperties: "املاک پیشنهادی", sendError: "ارسال پیام واتساپ ناموفق بود.", sending: "در حال ارسال...", templateMissing: "قالب آزمایشی Meta هنوز تنظیم نشده است.",
    templatePreview: (name: string, language: string) => `قالب تأییدشده Meta با نام «${name}» و زبان ${language} ارسال می‌شود.`, templateTest: "قالب تست Meta", text: "متن",
    startTemplateSent: "قالب hello_world پذیرفته شد؛ این پیام شامل پروژه نیست. پس از پاسخ مخاطب، پروژه را دوباره ارسال کنید.", title: "ارسال پیام واتساپ", whatsapp: "شماره واتساپ",
  }, [locale]);
  const sessionPreviewNotice = locale === "tr"
    ? "Bu içerik, müşteri yanıt verdikten sonra gerçek metin ve medya olarak gönderilir."
    : "این محتوا پس از پاسخ مشتری به‌صورت متن و رسانه واقعی ارسال می‌شود.";
  const webhookMissing = locale === "tr"
    ? "Müşteri yanıtlarını almak için webhook, localhost yerine herkese açık bir HTTPS adresine bağlanmalıdır."
    : "برای دریافت پاسخ مخاطب، webhook باید به یک آدرس HTTPS عمومی متصل باشد؛ localhost برای Meta قابل دسترسی نیست.";
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [messageType, setMessageType] = useState(preselectedType);
  const [propertyId, setPropertyId] = useState(preselectedPropertyId || properties[0]?.id || "");
  const [propertySearch, setPropertySearch] = useState("");
  const [catalogProperties, setCatalogProperties] = useState<WhatsAppPropertyOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [matchId, setMatchId] = useState(preselectedMatchId || matches[0]?.id || "");
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [success, setSuccess] = useState("");
  const [requestId, setRequestId] = useState(createRequestId);

  useEffect(() => {
    if (!open || config) return;
    fetch("/api/whatsapp/config")
      .then((response) => response.json())
      .then((result) => result.success && setConfig(result.data))
      .catch(() => setError(t.connectionError));
  }, [config, open, t.connectionError]);

  useEffect(() => {
    if (!open || !includeActivePropertyCatalog || messageType !== "PROPERTY") return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const params = new URLSearchParams({ limit: "100", status: "ACTIVE" });
        const query = propertySearch.trim();
        if (query) params.set("q", query);
        const response = await fetch(`/api/properties?${params.toString()}`, { signal: controller.signal });
        const result = (await response.json()) as {
          data?: { items?: Array<Record<string, unknown>> };
          success: boolean;
        };
        if (!response.ok || !result.success) throw new Error(t.catalogError);
        setCatalogProperties((result.data?.items || []).map(propertyOptionFromApi));
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setCatalogError(t.catalogError);
      } finally {
        if (!controller.signal.aborted) setCatalogLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [includeActivePropertyCatalog, messageType, open, propertySearch, t.catalogError]);

  const availableProperties = useMemo(() => {
    const options = new Map<string, WhatsAppPropertyOption>();
    for (const property of [...properties, ...catalogProperties]) {
      if (property.id && !options.has(property.id)) options.set(property.id, property);
    }
    return Array.from(options.values());
  }, [catalogProperties, properties]);
  const recommendedPropertyIds = useMemo(
    () => new Set(matches.map((match) => match.property.id)),
    [matches],
  );
  const visibleProperties = useMemo(() => {
    const query = normalizePropertySearch(propertySearch);
    if (!query) return availableProperties;
    return availableProperties.filter((property) => propertySearchValue(property).includes(query));
  }, [availableProperties, propertySearch]);
  const recommendedProperties = visibleProperties.filter((property) => recommendedPropertyIds.has(property.id));
  const activeProperties = visibleProperties.filter((property) => !recommendedPropertyIds.has(property.id));
  const selectedPropertyId = visibleProperties.some((property) => property.id === propertyId)
    ? propertyId
    : visibleProperties[0]?.id || "";

  const recipient = customer.whatsapp || customer.phone || "";
  const recipientSource = customer.whatsapp ? t.whatsapp : t.phone;
  const selectedProperty = availableProperties.find((item) => item.id === selectedPropertyId)
    || matches.find((item) => item.property.id === selectedPropertyId)?.property;
  const selectedMatch = matches.find((item) => item.id === matchId);
  const selectedMediaProperty = messageType === "MATCH" ? selectedMatch?.property : selectedProperty;
  const selectedMediaCount = (selectedMediaProperty?.images?.length || 0) + (selectedMediaProperty?.videoUrl ? 1 : 0);
  const preview = useMemo(() => {
    if (messageType === "PROPERTY" && selectedProperty) return buildPropertyPreview(customer, selectedProperty, agent);
    if (messageType === "MATCH" && selectedMatch) return buildMatchPreview(customer, selectedMatch.property, selectedMatch.score, agent);
    if (messageType === "FOLLOWUP") return buildFollowUpPreview(customer, followUp?.note, agent);
    if (messageType === "TEXT") return text;
    return config?.templateName
      ? t.templatePreview(config.templateName, config.templateLanguage)
      : t.templateMissing;
  }, [agent, config, customer, followUp?.note, messageType, selectedMatch, selectedProperty, t, text]);

  function showModal() {
    setOpen(true);
    setConfirming(false);
    setError("");
    setErrorCode("");
    setSuccess("");
    setPropertySearch("");
    setCatalogError("");
    setRequestId(createRequestId());
  }

  async function send(typeOverride?: typeof messageType) {
    if (sending) return;
    const outgoingType = typeOverride || messageType;
    const outgoingRequestId = typeOverride ? createRequestId() : requestId;
    setSending(true);
    setError("");
    setErrorCode("");
    setSuccess("");
    try {
      const response = await fetch("/api/whatsapp/messages", {
        body: JSON.stringify({
          clientRequestId: outgoingRequestId,
          customerId: customer.id,
          followUpId: outgoingType === "FOLLOWUP" ? followUp?.id : undefined,
          language: outgoingType === "TEMPLATE" ? config?.templateLanguage : undefined,
          matchId: outgoingType === "MATCH" ? matchId : undefined,
          messageType: outgoingType,
          propertyId: outgoingType === "PROPERTY" ? selectedPropertyId : undefined,
          templateName: outgoingType === "TEMPLATE" ? config?.templateName || undefined : undefined,
          text: outgoingType === "TEXT" ? text : outgoingType === "TEMPLATE" ? undefined : preview,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        data?: { deduplicated?: boolean; message?: { status?: string } };
        error?: { code?: string; message?: string };
        success: boolean;
      };
      if (!response.ok || !result.success) {
        setErrorCode(result.error?.code || "");
        throw new Error(result.error?.message || t.sendError);
      }
      if (result.data?.message?.status === "FAILED") throw new Error(t.failedBefore);
      setSuccess(result.data?.deduplicated ? t.duplicate : typeOverride === "TEMPLATE" ? t.startTemplateSent : t.messageSent);
      setConfirming(false);
      onSent?.();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : t.sendError);
      setRequestId(createRequestId());
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
        onClick={showModal}
        type="button"
      >
        <MessageCircle className="size-4" />
        {buttonLabel || t.defaultButton}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-950">{t.title}</h2>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">TEST MODE</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Meta WhatsApp Cloud API Test Number</p>
              </div>
              <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setOpen(false)} type="button">
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-700">{t.recipient}
                <input className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-slate-50 px-3" disabled value={customer.fullName} />
              </label>
              <label className="text-sm text-slate-700">شماره ({recipientSource})
                <input className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-slate-50 px-3" disabled dir="ltr" value={recipient} />
              </label>
              <label className="text-sm text-slate-700">{t.messageType}
                <select
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3"
                  onChange={(event) => { setMessageType(event.target.value as typeof messageType); setConfirming(false); }}
                  value={messageType}
                >
                  <option value="TEMPLATE">{t.templateTest}</option>
                  {properties.length || includeActivePropertyCatalog ? <option value="PROPERTY">{t.propertyIntro}</option> : null}
                  {matches.length ? <option value="MATCH">{t.matchOffer}</option> : null}
                  {followUp ? <option value="FOLLOWUP">{t.followUp}</option> : null}
                  <option value="TEXT">{t.freeText}</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">Template
                <input className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-slate-50 px-3" disabled value={config?.templateName || t.notConfigured} />
              </label>
              {messageType === "PROPERTY" ? (
                <label className="text-sm text-slate-700 sm:col-span-2">{t.property}
                  {includeActivePropertyCatalog ? (
                    <input
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3"
                      onChange={(event) => setPropertySearch(event.target.value)}
                      placeholder={t.propertySearch}
                      type="search"
                      value={propertySearch}
                    />
                  ) : null}
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 disabled:bg-slate-50"
                    disabled={!visibleProperties.length}
                    onChange={(event) => setPropertyId(event.target.value)}
                    value={selectedPropertyId}
                  >
                    {recommendedProperties.length ? (
                      <optgroup label={t.recommendedProperties}>
                        {recommendedProperties.map((property) => <option key={property.id} value={property.id}>{propertyOptionLabel(property)}</option>)}
                      </optgroup>
                    ) : null}
                    {activeProperties.length ? (
                      <optgroup label={t.activeProperties}>
                        {activeProperties.map((property) => <option key={property.id} value={property.id}>{propertyOptionLabel(property)}</option>)}
                      </optgroup>
                    ) : null}
                  </select>
                  {catalogLoading ? <span className="mt-1 block text-xs text-slate-500">{t.catalogLoading}</span> : null}
                  {catalogError ? <span className="mt-1 block text-xs text-red-600">{catalogError}</span> : null}
                  {!catalogLoading && !catalogError && !visibleProperties.length ? <span className="mt-1 block text-xs text-amber-700">{t.noPropertyResult}</span> : null}
                </label>
              ) : null}
              {messageType === "MATCH" ? (
                <label className="text-sm text-slate-700 sm:col-span-2">{t.match}
                  <select className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3" onChange={(event) => setMatchId(event.target.value)} value={matchId}>
                    {matches.map((match) => <option key={match.id} value={match.id}>{match.property.title} — %{match.score}</option>)}
                  </select>
                </label>
              ) : null}
              {messageType === "TEXT" ? (
                <label className="text-sm text-slate-700 sm:col-span-2">{t.text}
                  <textarea className="mt-1 min-h-28 w-full rounded-md border border-slate-300 p-3" maxLength={4096} onChange={(event) => setText(event.target.value)} value={text} />
                </label>
              ) : null}
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Preview</p>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{preview}</pre>
              {messageType === "TEMPLATE" ? <p className="mt-3 text-xs text-amber-700">{t.internalPreview}</p> : null}
              {messageType !== "TEMPLATE" && messageType !== "TEXT" ? <p className="mt-3 text-xs text-emerald-700">{sessionPreviewNotice}</p> : null}
              {(messageType === "PROPERTY" || messageType === "MATCH") && selectedMediaCount ? (
                <div className="mt-2 text-xs">
                  <p className="font-medium text-emerald-700">{selectedMediaCount.toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")} {t.media}</p>
                  <p className="mt-1 text-slate-500">{t.mediaRule}</p>
                </div>
              ) : null}
            </div>

            {confirming ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {t.confirmPrompt} <b dir="ltr">{recipient}</b>
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <p>{error}</p>
                {errorCode === "WHATSAPP_MEDIA_WINDOW_REQUIRED" || errorCode === "WHATSAPP_CONVERSATION_WINDOW_REQUIRED" ? (
                  config?.webhookConfigured ? (
                    <button
                      className="mt-3 h-9 rounded-md border border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-100"
                      disabled={sending}
                      onClick={() => void send("TEMPLATE")}
                      type="button"
                    >
                      {sending ? t.sending : t.prepareStartTemplate}
                    </button>
                  ) : <p className="mt-3 rounded-md bg-white p-2 font-medium">{webhookMissing}</p>
                ) : null}
              </div>
            ) : null}
            {success ? <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className="h-10 rounded-md border border-slate-300 px-4 text-sm" onClick={() => setOpen(false)} type="button">{t.close}</button>
              {!confirming ? (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-50"
                  disabled={!recipient || !config?.configured || (messageType === "PROPERTY" && !selectedPropertyId) || (messageType === "TEXT" && !text.trim())}
                  onClick={() => setConfirming(true)}
                  type="button"
                >
                  <ShieldCheck className="size-4" /> {t.confirm}
                </button>
              ) : (
                <button
                  className="h-10 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-50"
                  disabled={sending}
                  onClick={() => void send()}
                  type="button"
                >
                  {sending ? t.sending : t.confirmSend}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
