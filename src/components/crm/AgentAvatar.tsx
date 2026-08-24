"use client";

import Image from "next/image";
import clsx from "clsx";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type AgentAvatarProps = {
  className?: string;
  name?: string;
  src?: unknown;
};

function initials(name?: string) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) || [];
  if (!parts.length) return "HB";
  return parts.slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase();
}

export function AgentAvatar({ className, name, src }: AgentAvatarProps) {
  const { locale } = useLanguage();
  const imageSource = typeof src === "string" && src.startsWith("data:image/") ? src : undefined;

  return (
    <span
      className={clsx(
        "relative inline-grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-blue-100 to-sky-50 font-black text-blue-700 shadow-sm ring-1 ring-blue-100",
        className,
      )}
      title={name}
    >
      {imageSource ? (
        <Image alt={name ? (locale === "tr" ? `${name} fotoğrafı` : `عکس ${name}`) : (locale === "tr" ? "Danışman fotoğrafı" : "عکس مشاور")} className="object-cover" fill sizes="96px" src={imageSource} unoptimized />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
