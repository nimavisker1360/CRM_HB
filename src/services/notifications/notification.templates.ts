import type { IdLike } from "@/services/notifications/notification.types";
import { formatGregorianTime } from "@/lib/format";

type MatchTemplateInput = {
  customerName?: string;
  matchId: IdLike;
  propertyTitle?: string;
  score: number;
};

type FollowUpTemplateInput = {
  actorName?: string;
  customerName?: string;
  dueAt?: Date | string;
  followUpId: IdLike;
  managerMessage?: string;
};

function timeLabel(value?: Date | string) {
  if (!value) return "";
  const formatted = formatGregorianTime(value);
  return formatted === "-" ? "" : formatted;
}

export function buildNewMatchNotification(input: MatchTemplateInput) {
  const customer = input.customerName || "مشتری";
  const property = input.propertyTitle || "ملک";
  return {
    actionUrl: `/matches/${String(input.matchId)}`,
    message: `برای ${customer} ملک ${property} با تطبیق ${input.score}% پیدا شد.`,
    title: "تطبیق جدید",
  };
}

export function buildFollowUpCreatedNotification(input: FollowUpTemplateInput) {
  const time = timeLabel(input.dueAt);
  const managerMessage = input.managerMessage?.trim();
  return {
    actionUrl: `/follow-ups/${String(input.followUpId)}`,
    message: `پیگیری جدید${time ? ` برای ساعت ${time}` : ""} برای ${input.customerName || "مشتری"} به شما اختصاص داده شد.${managerMessage ? ` پیام ${input.actorName || "مدیر"}: ${managerMessage}` : ""}`,
    title: managerMessage ? "پیگیری جدید همراه با پیام مدیر" : "پیگیری جدید برای شما ثبت شد",
  };
}

export function buildFollowUpUpdatedNotification(input: FollowUpTemplateInput) {
  const managerMessage = input.managerMessage?.trim();
  const actor = input.actorName || "مدیریت";
  return {
    actionUrl: `/follow-ups/${String(input.followUpId)}`,
    message: managerMessage
      ? `پیام ${actor} درباره پیگیری ${input.customerName || "مشتری"}: ${managerMessage}`
      : `پیگیری ${input.customerName || "مشتری"} توسط ${actor} به‌روزرسانی شد.`,
    title: managerMessage ? "پیام جدید مدیر درباره پیگیری" : "پیگیری به‌روزرسانی شد",
  };
}

export function buildFollowUpDueNotification(input: FollowUpTemplateInput) {
  const time = timeLabel(input.dueAt);
  return {
    actionUrl: `/follow-ups/${String(input.followUpId)}`,
    message: `امروز${time ? ` ساعت ${time}` : ""} باید با ${input.customerName || "مشتری"} تماس بگیرید.`,
    title: "پیگیری امروز",
  };
}

export function buildFollowUpOverdueNotification(input: FollowUpTemplateInput) {
  return {
    actionUrl: `/follow-ups/${String(input.followUpId)}`,
    message: `پیگیری مشتری ${input.customerName || "مشتری"} هنوز انجام نشده است.`,
    title: "پیگیری عقب‌افتاده",
  };
}

export function buildCustomerAssignedNotification(customerName?: string) {
  return {
    message: `مشتری ${customerName || "جدید"} به شما اختصاص داده شد.`,
    title: "مشتری جدید به شما اختصاص داده شد",
  };
}

export function buildCustomerReassignedInNotification(customerName?: string) {
  return {
    message: `مشتری ${customerName || "جدید"} به پنل شما منتقل شد.`,
    title: "یک مشتری جدید به شما منتقل شد",
  };
}

export function buildCustomerReassignedOutNotification(customerName?: string) {
  return {
    message: `مشتری ${customerName || "مورد نظر"} از پنل شما منتقل شد.`,
    title: "مشتری از پنل شما منتقل شد",
  };
}
