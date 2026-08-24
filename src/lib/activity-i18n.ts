import type { AppLocale } from "@/lib/i18n";

export type ActivityKind =
  | "archived"
  | "avatar"
  | "completed"
  | "created"
  | "deleted"
  | "imported"
  | "message"
  | "reassigned"
  | "started"
  | "updated"
  | "generic";

export type ActivityLike = {
  action?: unknown;
  description?: unknown;
  entityType?: unknown;
  metadata?: unknown;
};

export type LocalizedActivity = {
  kind: ActivityKind;
  text: string;
};

type ActivityDetails = {
  actor?: string;
  subject?: string;
};

const structuredKinds: Record<string, ActivityKind> = {
  AGENT_CREATED: "created",
  AGENT_UPDATED: "updated",
  AGENT_SUSPENDED: "archived",
  AGENT_AVATAR_UPDATED: "avatar",
  AGENT_DELETED: "deleted",
};

export function localizeActivity(activity: ActivityLike, locale: AppLocale): LocalizedActivity {
  const metadata = asRecord(activity.metadata);
  const activityKey = stringValue(metadata?.activityKey);
  const structuredKind = activityKey ? structuredKinds[activityKey] : undefined;

  if (structuredKind && activityKey) {
    return {
      kind: structuredKind,
      text: structuredActivityText(
        activityKey,
        {
          actor: stringValue(metadata?.actorName),
          subject: stringValue(metadata?.subjectName),
        },
        locale,
      ),
    };
  }

  const description = stringValue(activity.description)?.trim();
  if (description) {
    const legacy = localizeLegacyDescription(description, locale);
    if (legacy) return legacy;
  }

  const action = stringValue(activity.action)?.toUpperCase() || "";
  return genericActivity(action, locale);
}

function structuredActivityText(key: string, details: ActivityDetails, locale: AppLocale) {
  const actor = details.actor || (locale === "tr" ? "Bir yönetici" : "یکی از مدیران");
  const subject = details.subject || (locale === "tr" ? "danışman" : "مشاور");

  if (locale === "tr") {
    const messages: Record<string, string> = {
      AGENT_CREATED: `${actor}, ${subject} adlı danışmanı oluşturdu`,
      AGENT_UPDATED: `${actor}, ${subject} adlı danışmanın bilgilerini güncelledi`,
      AGENT_SUSPENDED: `${actor}, ${subject} adlı danışmanın hesabını askıya aldı`,
      AGENT_AVATAR_UPDATED: `${actor}, ${subject} adlı danışmanın profil fotoğrafını güncelledi`,
      AGENT_DELETED: `${actor}, ${subject} adlı danışmanı kalıcı olarak sildi`,
    };
    return messages[key] || genericActivity("", locale).text;
  }

  const messages: Record<string, string> = {
    AGENT_CREATED: `${actor}، مشاور ${subject} را ایجاد کرد`,
    AGENT_UPDATED: `${actor}، اطلاعات مشاور ${subject} را به‌روزرسانی کرد`,
    AGENT_SUSPENDED: `${actor}، حساب مشاور ${subject} را به حالت تعلیق درآورد`,
    AGENT_AVATAR_UPDATED: `${actor}، عکس پروفایل مشاور ${subject} را به‌روزرسانی کرد`,
    AGENT_DELETED: `${actor}، مشاور ${subject} را برای همیشه حذف کرد`,
  };
  return messages[key] || genericActivity("", locale).text;
}

function localizeLegacyDescription(description: string, locale: AppLocale): LocalizedActivity | undefined {
  const patterns: Array<{
    kind: ActivityKind;
    pattern: RegExp;
    text: (actor: string, subject: string, locale: AppLocale) => string;
  }> = [
    {
      kind: "avatar",
      pattern: /^(.+?) updated the profile photo for (.+?)\.?$/i,
      text: (actor, subject, language) => language === "tr"
        ? `${actor}, ${subject} adlı danışmanın profil fotoğrafını güncelledi`
        : `${actor}، عکس پروفایل مشاور ${subject} را به‌روزرسانی کرد`,
    },
    {
      kind: "deleted",
      pattern: /^(.+?) permanently deleted agent (.+?)\.?$/i,
      text: (actor, subject, language) => language === "tr"
        ? `${actor}, ${subject} adlı danışmanı kalıcı olarak sildi`
        : `${actor}، مشاور ${subject} را برای همیشه حذف کرد`,
    },
    {
      kind: "archived",
      pattern: /^(.+?) suspended agent (.+?)\.?$/i,
      text: (actor, subject, language) => language === "tr"
        ? `${actor}, ${subject} adlı danışmanın hesabını askıya aldı`
        : `${actor}، حساب مشاور ${subject} را به حالت تعلیق درآورد`,
    },
    {
      kind: "created",
      pattern: /^(.+?) created agent (.+?)\.?$/i,
      text: (actor, subject, language) => language === "tr"
        ? `${actor}, ${subject} adlı danışmanı oluşturdu`
        : `${actor}، مشاور ${subject} را ایجاد کرد`,
    },
    {
      kind: "updated",
      pattern: /^(.+?) updated agent (.+?)\.?$/i,
      text: (actor, subject, language) => language === "tr"
        ? `${actor}, ${subject} adlı danışmanın bilgilerini güncelledi`
        : `${actor}، اطلاعات مشاور ${subject} را به‌روزرسانی کرد`,
    },
    {
      kind: "reassigned",
      pattern: /^(.+?) reassigned customer (.+?)\.?$/i,
      text: (actor, subject, language) => language === "tr"
        ? `${actor}, ${subject} adlı müşteriyi başka bir danışmana atadı`
        : `${actor}، مشاور مسئول مشتری ${subject} را تغییر داد`,
    },
    {
      kind: "message",
      pattern: /^(.+?) sent a WhatsApp message to (.+?)\.?$/i,
      text: (actor, subject, language) => language === "tr"
        ? `${actor}, ${subject} adlı müşteriye WhatsApp mesajı gönderdi`
        : `${actor}، برای مشتری ${subject} پیام واتساپ فرستاد`,
    },
    ...entityPatterns("customer", "مشتری", "müşteri"),
    ...entityPatterns("property", "ملک", "gayrimenkul"),
    ...entityPatterns("project", "پروژه", "proje"),
  ];

  for (const entry of patterns) {
    const match = description.match(entry.pattern);
    if (match) return { kind: entry.kind, text: entry.text(match[1], match[2], locale) };
  }

  const followUp = description.match(/^(.+?) (created|updated|completed|deleted) a follow-up\.?$/i);
  if (followUp) {
    const action = followUp[2].toLowerCase();
    const kind: ActivityKind = action === "created" ? "created" : action === "deleted" ? "deleted" : action === "completed" ? "completed" : "updated";
    const faActions: Record<string, string> = { created: "ایجاد کرد", updated: "به‌روزرسانی کرد", completed: "تکمیل کرد", deleted: "حذف کرد" };
    const trActions: Record<string, string> = { created: "oluşturdu", updated: "güncelledi", completed: "tamamladı", deleted: "sildi" };
    return {
      kind,
      text: locale === "tr"
        ? `${followUp[1]}, bir takibi ${trActions[action]}`
        : `${followUp[1]}، یک پیگیری را ${faActions[action]}`,
    };
  }

  return undefined;
}

function entityPatterns(entity: string, faEntity: string, trEntity: string) {
  return (["created", "updated", "deleted"] as const).map((action) => ({
    kind: action === "created" ? "created" as const : action === "deleted" ? "deleted" as const : "updated" as const,
    pattern: new RegExp(`^(.+?) ${action} ${entity} (.+?)\\.?$`, "i"),
    text: (actor: string, subject: string, locale: AppLocale) => {
      if (locale === "tr") {
        const verb = action === "created" ? "oluşturdu" : action === "updated" ? "güncelledi" : "sildi";
        return `${actor}, ${subject} adlı ${trEntity} kaydını ${verb}`;
      }
      const verb = action === "created" ? "ایجاد کرد" : action === "updated" ? "به‌روزرسانی کرد" : "حذف کرد";
      return `${actor}، ${faEntity} ${subject} را ${verb}`;
    },
  }));
}

function genericActivity(action: string, locale: AppLocale): LocalizedActivity {
  const kindByAction: Record<string, ActivityKind> = {
    ARCHIVED: "archived",
    COMPLETED: "completed",
    CREATED: "created",
    DELETED: "deleted",
    IMPORTED: "imported",
    STARTED: "started",
    UPDATED: "updated",
    WHATSAPP_SENT: "message",
  };
  const kind = kindByAction[action] || "generic";
  const fa: Record<ActivityKind, string> = {
    archived: "یک رکورد به حالت تعلیق درآمد",
    avatar: "عکس پروفایل به‌روزرسانی شد",
    completed: "یک فعالیت تکمیل شد",
    created: "یک رکورد جدید ایجاد شد",
    deleted: "یک رکورد حذف شد",
    generic: "یک فعالیت در سیستم ثبت شد",
    imported: "عملیات ورود اطلاعات انجام شد",
    message: "یک پیام واتساپ ارسال شد",
    reassigned: "مسئول یک رکورد تغییر کرد",
    started: "یک فعالیت آغاز شد",
    updated: "اطلاعات یک رکورد به‌روزرسانی شد",
  };
  const tr: Record<ActivityKind, string> = {
    archived: "Bir kayıt askıya alındı",
    avatar: "Profil fotoğrafı güncellendi",
    completed: "Bir aktivite tamamlandı",
    created: "Yeni bir kayıt oluşturuldu",
    deleted: "Bir kayıt silindi",
    generic: "Sisteme bir aktivite kaydedildi",
    imported: "Veri aktarımı tamamlandı",
    message: "Bir WhatsApp mesajı gönderildi",
    reassigned: "Bir kaydın sorumlusu değiştirildi",
    started: "Bir aktivite başlatıldı",
    updated: "Bir kaydın bilgileri güncellendi",
  };
  return { kind, text: locale === "tr" ? tr[kind] : fa[kind] };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
