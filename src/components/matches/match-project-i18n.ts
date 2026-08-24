import type { AppLocale } from "@/lib/i18n";

const fa = {
  activeStatuses: "همه وضعیت‌های فعال",
  agentScope: "محدوده مشاور",
  allAgents: "همه مشاوران",
  apply: "اعمال",
  area: "متراژ",
  budget: "حداکثر بودجه",
  chooseCustomer: "مشتری را انتخاب کنید",
  chooseCustomerNote: "پیشنهادها بر اساس نیازها و بودجه همین مشتری ساخته می‌شوند.",
  chooseAndSendProperty: "انتخاب و ارسال ملک با واتساپ",
  customer: "مشتری",
  customerAccessDenied: "این مشتری در محدوده کاری شما نیست یا شناسه او معتبر نیست.",
  customerProfile: "پرونده مشتری",
  findProjects: "یافتن پروژه‌های مناسب",
  fullDetails: "جزئیات تطبیق",
  independentProperties: "املاک مستقل",
  lastCalculated: "آخرین محاسبه پیشنهادها",
  location: "موقعیت موردنظر",
  matchReasons: "دلایل تناسب",
  minimumScore: "حداقل امتیاز",
  mismatches: "موارد نامنطبق",
  noMismatches: "مورد نامنطبقی ثبت نشده است.",
  noActiveProperties: "ملک مطابق شرایط مشتری برای ارسال وجود ندارد.",
  noProjectRecord: "این واحدها به پروژه‌ای متصل نشده‌اند.",
  noProjectsDescription: "روی «یافتن پروژه‌های مناسب» بزنید. اگر باز هم نتیجه‌ای نبود، شهر، بودجه، نوع ملک و اطلاعات واحدهای فعال را بررسی کنید.",
  noProjectsTitle: "هنوز پروژه مناسبی پیدا نشده است",
  noReasons: "دلیلی ثبت نشده است.",
  noResultSummary: "برای این مشتری هنوز پیشنهاد قابل نمایشی وجود ندارد.",
  notCalculated: "پیشنهادها برای این مشتری هنوز محاسبه نشده‌اند.",
  notSpecified: "مشخص نشده",
  pageDescription: "ابتدا مشتری را انتخاب کنید؛ سپس پروژه‌ها و واحدهای مناسب را بر اساس نیاز او ببینید.",
  pageTitle: "پیشنهاد پروژه برای مشتری",
  project: "پروژه پیشنهادی",
  property: "واحد پیشنهادی",
  propertyType: "نوع ملک",
  resultSettings: "تنظیم نتایج",
  room: "اتاق",
  rooms: "تعداد اتاق",
  sendWhatsapp: "ارسال این ملک با واتساپ",
  selectedCustomer: "نیازهای مشتری انتخاب‌شده",
  selectCustomerPlaceholder: "انتخاب مشتری...",
  showSuggestions: "نمایش پیشنهادها",
  startDescription: "یک مشتری را از کادر بالا انتخاب کنید تا نیازهای او و پروژه‌های مناسب، مرحله‌به‌مرحله نمایش داده شوند.",
  startTitle: "از انتخاب مشتری شروع کنید",
  status: "وضعیت پیشنهاد",
  suggestedProjects: "پروژه‌ها و واحدهای پیشنهادی",
  suitableUnits: "واحد مناسب",
  whyProject: "دلیل پیشنهاد پروژه",
  whyThisUnit: "چرا این واحد مناسب است؟",
  resultSummary: (projects: number, units: number) => `${projects} پروژه و ${units} واحد مناسب، بر اساس بیشترین امتیاز`,
};

export type MatchProjectDictionary = typeof fa;

const tr: MatchProjectDictionary = {
  activeStatuses: "Tüm aktif durumlar",
  agentScope: "Danışman kapsamı",
  allAgents: "Tüm danışmanlar",
  apply: "Uygula",
  area: "Alan",
  budget: "Maksimum bütçe",
  chooseCustomer: "Müşteriyi seçin",
  chooseCustomerNote: "Öneriler bu müşterinin ihtiyaç ve bütçesine göre hazırlanır.",
  chooseAndSendProperty: "Gayrimenkul seç ve WhatsApp ile gönder",
  customer: "Müşteri",
  customerAccessDenied: "Bu müşteri çalışma alanınızda değil veya kimliği geçersiz.",
  customerProfile: "Müşteri profili",
  findProjects: "Uygun projeleri bul",
  fullDetails: "Eşleşme ayrıntıları",
  independentProperties: "Bağımsız gayrimenkuller",
  lastCalculated: "Son öneri hesaplaması",
  location: "İstenen konum",
  matchReasons: "Uygunluk nedenleri",
  minimumScore: "Minimum puan",
  mismatches: "Uyumsuzluklar",
  noMismatches: "Uyumsuzluk kaydedilmedi.",
  noActiveProperties: "Müşteri kriterlerine uygun gönderilebilir gayrimenkul yok.",
  noProjectRecord: "Bu birimler bir projeye bağlı değil.",
  noProjectsDescription: "“Uygun projeleri bul” düğmesine basın. Sonuç yoksa şehir, bütçe, gayrimenkul türü ve aktif birim bilgilerini kontrol edin.",
  noProjectsTitle: "Henüz uygun proje bulunamadı",
  noReasons: "Neden kaydedilmedi.",
  noResultSummary: "Bu müşteri için henüz gösterilebilir öneri yok.",
  notCalculated: "Bu müşterinin önerileri henüz hesaplanmadı.",
  notSpecified: "Belirtilmedi",
  pageDescription: "Önce müşteriyi seçin; ardından ihtiyacına uygun proje ve birimleri görüntüleyin.",
  pageTitle: "Müşteri için proje önerileri",
  project: "Önerilen proje",
  property: "Önerilen birim",
  propertyType: "Gayrimenkul türü",
  resultSettings: "Sonuç ayarları",
  room: "oda",
  rooms: "Oda sayısı",
  sendWhatsapp: "Bu gayrimenkulü WhatsApp ile gönder",
  selectedCustomer: "Seçilen müşterinin ihtiyaçları",
  selectCustomerPlaceholder: "Müşteri seçin...",
  showSuggestions: "Önerileri göster",
  startDescription: "İhtiyaçları ve uygun projeleri adım adım görmek için yukarıdan bir müşteri seçin.",
  startTitle: "Müşteri seçerek başlayın",
  status: "Öneri durumu",
  suggestedProjects: "Önerilen projeler ve birimler",
  suitableUnits: "uygun birim",
  whyProject: "Projenin önerilme nedeni",
  whyThisUnit: "Bu birim neden uygun?",
  resultSummary: (projects: number, units: number) => `En yüksek puana göre ${projects} proje ve ${units} uygun birim`,
};

export function getMatchProjectDictionary(locale: AppLocale) {
  return locale === "tr" ? tr : fa;
}

export function matchProjectScoreLabel(score: number, locale: AppLocale) {
  if (locale === "tr") {
    if (score >= 90) return "Mükemmel";
    if (score >= 80) return "Güçlü";
    if (score >= 70) return "İyi";
    return "Uygun olabilir";
  }
  if (score >= 90) return "عالی";
  if (score >= 80) return "قوی";
  if (score >= 70) return "خوب";
  return "قابل بررسی";
}
