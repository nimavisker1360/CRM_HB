"use client";

import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { AlertTriangle, Archive, Check, Edit, Eye, ImageUp, LayoutDashboard, Plus, RefreshCw, Search, Trash2, UserCheck, UserX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AgentAvatar } from "@/components/crm/AgentAvatar";
import { CRM_REALTIME_EVENT } from "@/components/layout/RealtimeBridge";
import type { CrmRealtimeEvent } from "@/services/realtime/realtime-bus";
import { formatGregorianDateTime } from "@/lib/format";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { translateLiteral, type AppLocale } from "@/lib/i18n";

type ApiListResponse = {
  success: boolean;
  data?: {
    items: CrmRecord[];
    pagination: {
      limit: number;
      page: number;
      pages: number;
      total: number;
    };
  };
  error?: { message: string };
};

type ApiItemResponse = {
  success: boolean;
  data?: CrmRecord;
  error?: { code?: string; message: string };
};

export type CrmRecord = Record<string, unknown> & { _id?: string };

export type FieldOption = {
  label: string;
  value: string;
};

type LocationApiResponse = {
  success: boolean;
  data?: FieldOption[];
};

export type FieldConfig = {
  label: string;
  name: string;
  optionEndpoint?: string;
  optionLabel?: string;
  options?: FieldOption[];
  required?: boolean;
  section?: string;
  type?: "checkbox" | "date" | "image-upload" | "number" | "select" | "textarea" | "text" | "video-upload";
  uploadDirectory?: "projects/images" | "properties/images" | "properties/videos";
};

export type ColumnConfig = {
  key: string;
  label: string;
};

type ResourceManagerProps = {
  activationPayload?: Record<string, unknown>;
  archivePayload?: Record<string, unknown>;
  columns: ColumnConfig[];
  detailBasePath?: string;
  endpoint: string;
  fields: FieldConfig[];
  filters: FieldConfig[];
  createDefaults?: Record<string, unknown>;
  canArchive?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  canPermanentlyDelete?: boolean;
  deleteConfirmationField?: string;
  initialFilters?: Record<string, string>;
  imageUpload?: {
    field: string;
    path: string;
  };
  primaryLabel: string;
  workspaceBasePath?: string;
};

type LookupState = Record<string, FieldOption[]>;

type LocationLevel = "province" | "district" | "neighborhood";

function locationLevel(name: string): LocationLevel | undefined {
  if (name === "city" || name === "interestedCity") return "province";
  if (name === "district" || name === "interestedDistrict") return "district";
  if (name === "neighborhood") return "neighborhood";
  return undefined;
}

function isPhoneField(name: string) {
  return name === "phone" || name === "whatsapp";
}

async function fetchLocationOptions(params: URLSearchParams, signal: AbortSignal) {
  const response = await fetch(`/api/locations?${params.toString()}`, {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  const payload = (await response.json()) as LocationApiResponse;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error("LOCATION_OPTIONS_UNAVAILABLE");
  }
  return payload.data;
}

function getNestedValue(record: CrmRecord, key: string) {
  return key.split(".").reduce<unknown>((value, part) => {
    if (value && typeof value === "object" && part in value) {
      return (value as Record<string, unknown>)[part];
    }
    return undefined;
  }, record);
}

function displayValue(value: unknown, locale: AppLocale = "fa") {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? (locale === "tr" ? "Evet" : "بله") : (locale === "tr" ? "Hayır" : "خیر");
  if (typeof value === "number") return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn").format(value);
  if (Array.isArray(value)) return value.map((item) => translateLiteral(String(item), locale)).join(", ");
  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return String(objectValue.fullName || objectValue.name || objectValue.title || objectValue._id || "-");
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) {
    return formatGregorianDateTime(value, locale);
  }
  return translateLiteral(String(value), locale);
}

function toInputValue(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return String((value as CrmRecord)._id || "");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 16);
  return String(value);
}

const AVATAR_SOURCE_MAX_BYTES = 10 * 1024 * 1024;
const AVATAR_MAX_DIMENSION = 512;
const PROPERTY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROPERTY_VIDEO_MAX_BYTES = 16 * 1024 * 1024;
const PROPERTY_IMAGE_TYPES = ["image/jpeg", "image/png"];
const PROPERTY_VIDEO_TYPES = ["video/mp4", "video/3gpp"];

function isMediaUploadField(field: FieldConfig) {
  return field.type === "image-upload" || field.type === "video-upload";
}

function isManagedBlobUrl(value: string) {
  try {
    return new URL(value).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function mediaUrls(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function safeBlobFilename(filename: string) {
  return filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "media";
}

async function prepareAvatar(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("INVALID_AVATAR_TYPE");
  }
  if (file.size <= 0 || file.size > AVATAR_SOURCE_MAX_BYTES) {
    throw new Error("AVATAR_TOO_LARGE");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("AVATAR_PROCESSING_FAILED");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (!blob) throw new Error("AVATAR_PROCESSING_FAILED");
  return new File([blob], "avatar.webp", { type: "image/webp" });
}

export function ResourceManager({
  activationPayload,
  archivePayload,
  columns,
  detailBasePath,
  endpoint,
  fields,
  filters,
  createDefaults,
  canArchive = true,
  canCreate = true,
  canDelete = true,
  canEdit = true,
  canPermanentlyDelete = false,
  deleteConfirmationField,
  imageUpload,
  initialFilters,
  primaryLabel,
  workspaceBasePath,
}: ResourceManagerProps) {
  const { dictionary, locale } = useLanguage();
  const ui = dictionary.common;
  const localize = (value: string) => translateLiteral(value, locale);
  const [items, setItems] = useState<CrmRecord[]>([]);
  const [pagination, setPagination] = useState({ limit: 20, page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(initialFilters || {});
  const [editing, setEditing] = useState<CrmRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrmRecord | null>(null);
  const [deleteMode, setDeleteMode] = useState<"permanent" | "suspend">("suspend");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingItemId, setUploadingItemId] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lookups, setLookups] = useState<LookupState>({});
  const [provinceOptions, setProvinceOptions] = useState<FieldOption[]>([]);
  const [provinceOptionsError, setProvinceOptionsError] = useState(false);
  const [provinceOptionsLoading, setProvinceOptionsLoading] = useState(true);
  const [provinceOptionsReload, setProvinceOptionsReload] = useState(0);
  const [formDistrictOptions, setFormDistrictOptions] = useState<FieldOption[]>([]);
  const [formNeighborhoodOptions, setFormNeighborhoodOptions] = useState<FieldOption[]>([]);
  const [filterDistrictOptions, setFilterDistrictOptions] = useState<FieldOption[]>([]);
  const [formLocationValues, setFormLocationValues] = useState<Record<string, string>>({});

  const formLocationFields = useMemo(() => fields.filter((field) => locationLevel(field.name)), [fields]);
  const filterLocationFields = useMemo(() => filters.filter((field) => locationLevel(field.name)), [filters]);
  const formCityField = formLocationFields.find((field) => locationLevel(field.name) === "province");
  const formDistrictField = formLocationFields.find((field) => locationLevel(field.name) === "district");
  const formNeighborhoodField = formLocationFields.find((field) => locationLevel(field.name) === "neighborhood");
  const filterCityField = filterLocationFields.find((field) => locationLevel(field.name) === "province");
  const formCityValue = formCityField ? formLocationValues[formCityField.name] || "" : "";
  const formDistrictValue = formDistrictField ? formLocationValues[formDistrictField.name] || "" : "";
  const filterCityValue = filterCityField ? filterValues[filterCityField.name] || "" : "";

  const groupedFields = useMemo(() => {
    return fields.reduce<Record<string, FieldConfig[]>>((groups, field) => {
      const section = field.section || ui.information;
      groups[section] = [...(groups[section] || []), field];
      return groups;
    }, {});
  }, [fields, ui.information]);

  useEffect(() => {
    if (!formLocationFields.length && !filterLocationFields.length) return;
    const controller = new AbortController();
    void fetchLocationOptions(new URLSearchParams({ level: "provinces" }), controller.signal)
      .then((options) => {
        setProvinceOptions(options);
        setProvinceOptionsError(options.length === 0);
      })
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") {
          setProvinceOptions([]);
          setProvinceOptionsError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setProvinceOptionsLoading(false);
      });
    return () => controller.abort();
  }, [formLocationFields.length, filterLocationFields.length, provinceOptionsReload]);

  function reloadProvinceOptions() {
    setProvinceOptionsLoading(true);
    setProvinceOptionsError(false);
    setProvinceOptionsReload((current) => current + 1);
  }

  useEffect(() => {
    if (!isFormOpen || !formCityValue || !formDistrictField) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ level: "districts", province: formCityValue });
    void fetchLocationOptions(params, controller.signal).then(setFormDistrictOptions).catch((requestError) => {
      if ((requestError as Error).name !== "AbortError") setFormDistrictOptions([]);
    });
    return () => controller.abort();
  }, [formCityValue, formDistrictField, isFormOpen]);

  useEffect(() => {
    if (!isFormOpen || !formCityValue || !formDistrictValue || !formNeighborhoodField) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ level: "neighborhoods", province: formCityValue, district: formDistrictValue });
    void fetchLocationOptions(params, controller.signal).then(setFormNeighborhoodOptions).catch((requestError) => {
      if ((requestError as Error).name !== "AbortError") setFormNeighborhoodOptions([]);
    });
    return () => controller.abort();
  }, [formCityValue, formDistrictValue, formNeighborhoodField, isFormOpen]);

  useEffect(() => {
    const filterDistrictField = filterLocationFields.find((field) => locationLevel(field.name) === "district");
    if (!filterCityValue || !filterDistrictField) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ level: "districts", province: filterCityValue });
    void fetchLocationOptions(params, controller.signal).then(setFilterDistrictOptions).catch((requestError) => {
      if ((requestError as Error).name !== "AbortError") setFilterDistrictOptions([]);
    });
    return () => controller.abort();
  }, [filterCityValue, filterLocationFields]);

  function openForm(item?: CrmRecord) {
    const record = item || createDefaults || {};
    if (!provinceOptions.length && !provinceOptionsLoading) {
      reloadProvinceOptions();
    }
    setEditing(item || null);
    setFormDistrictOptions([]);
    setFormNeighborhoodOptions([]);
    setFormLocationValues(Object.fromEntries(
      formLocationFields.map((field) => [field.name, String(getNestedValue(record as CrmRecord, field.name) || "")]),
    ));
    setIsFormOpen(true);
  }

  function updateFormLocation(field: FieldConfig, value: string) {
    const level = locationLevel(field.name);
    if (level === "province") {
      setFormDistrictOptions([]);
      setFormNeighborhoodOptions([]);
    } else if (level === "district") {
      setFormNeighborhoodOptions([]);
    }
    setFormLocationValues((current) => {
      const next = { ...current, [field.name]: value };
      if (level === "province") {
        if (formDistrictField) next[formDistrictField.name] = "";
        if (formNeighborhoodField) next[formNeighborhoodField.name] = "";
      }
      if (level === "district" && formNeighborhoodField) next[formNeighborhoodField.name] = "";
      return next;
    });
  }

  function formOptionsFor(field: FieldConfig) {
    const level = locationLevel(field.name);
    if (level === "province") return provinceOptions;
    if (level === "district") return formDistrictOptions;
    if (level === "neighborhood") return formNeighborhoodOptions;
    return undefined;
  }

  function filterOptionsFor(field: FieldConfig) {
    const level = locationLevel(field.name);
    if (level === "province") return provinceOptions;
    if (level === "district") return filterDistrictOptions;
    return undefined;
  }

  function updateFilter(field: FieldConfig, value: string) {
    const level = locationLevel(field.name);
    if (level === "province") setFilterDistrictOptions([]);
    setFilterValues((current) => {
      const next = { ...current, [field.name]: value };
      if (level === "province") {
        for (const candidate of filterLocationFields) {
          if (locationLevel(candidate.name) === "district" || locationLevel(candidate.name) === "neighborhood") next[candidate.name] = "";
        }
      }
      return next;
    });
  }

  async function fetchItems(nextPage = page) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(nextPage), limit: "20" });

    for (const [key, value] of Object.entries(filterValues)) {
      if (value) params.set(key, value);
    }

    const url = new URL(endpoint, window.location.origin);
    params.forEach((value, key) => url.searchParams.set(key, value));
    const response = await fetch(`${url.pathname}?${url.searchParams.toString()}`, { cache: "no-store" });
    const result = (await response.json()) as ApiListResponse;

    setLoading(false);

    if (!result.success || !result.data) {
      setError(locale === "tr" ? "Bilgiler alınamadı." : result.error?.message || "خطا در دریافت اطلاعات.");
      return;
    }

    setItems(result.data.items);
    setPagination(result.data.pagination);
    setPage(result.data.pagination.page);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchItems(1);
    }, 0);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  useEffect(() => {
    function handleRealtime(event: Event) {
      const detail = (event as CustomEvent<CrmRealtimeEvent>).detail;
      if (detail?.resource && endpoint.includes(`/${detail.resource}`)) {
        void fetchItems(page);
      }
    }

    window.addEventListener(CRM_REALTIME_EVENT, handleRealtime);
    return () => window.removeEventListener(CRM_REALTIME_EVENT, handleRealtime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, JSON.stringify(filterValues)]);

  useEffect(() => {
    const lookupFields = fields.filter((field) => field.optionEndpoint);
    if (!lookupFields.length) return;

    async function loadLookups() {
      const nextLookups: LookupState = {};
      await Promise.all(
        lookupFields.map(async (field) => {
          if (!field.optionEndpoint) return;
          const response = await fetch(`${field.optionEndpoint}?limit=100`, { cache: "no-store" });
          const result = (await response.json()) as ApiListResponse;
          if (!result.success || !result.data) return;
          nextLookups[field.name] = result.data.items.map((item) => ({
            label: displayValue(getNestedValue(item, field.optionLabel || "fullName"), locale),
            value: String(item._id),
          }));
        }),
      );
      setLookups(nextLookups);
    }

    void loadLookups();
  }, [fields, locale]);

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setMessage("");
    setError("");
    setSaving(true);
    setUploadProgress(0);

    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = editing ? {} : { ...(createDefaults || {}) };
    const uploadedUrls: string[] = [];

    try {
      for (const field of fields) {
        if (isMediaUploadField(field)) {
          const existingUrls = formData.getAll(field.name).filter((value): value is string => typeof value === "string" && Boolean(value));
          const files = formData
            .getAll(`${field.name}Upload`)
            .filter((value): value is File => value instanceof File && value.size > 0);
          const fieldUploadedUrls: string[] = [];

          if (field.type === "image-upload" && existingUrls.length + files.length > 10) {
            throw new Error("PROPERTY_IMAGE_COUNT_EXCEEDED");
          }
          if (field.type === "video-upload" && files.length > 1) {
            throw new Error("PROPERTY_VIDEO_COUNT_EXCEEDED");
          }

          for (const [fileIndex, file] of files.entries()) {
            const isImage = field.type === "image-upload";
            const allowedTypes = isImage ? PROPERTY_IMAGE_TYPES : PROPERTY_VIDEO_TYPES;
            const maximumSize = isImage ? PROPERTY_IMAGE_MAX_BYTES : PROPERTY_VIDEO_MAX_BYTES;
            if (!allowedTypes.includes(file.type)) throw new Error(isImage ? "INVALID_PROPERTY_IMAGE_TYPE" : "INVALID_PROPERTY_VIDEO_TYPE");
            if (file.size > maximumSize) throw new Error(isImage ? "PROPERTY_IMAGE_TOO_LARGE" : "PROPERTY_VIDEO_TOO_LARGE");

            const uploadDirectory = field.uploadDirectory || (isImage ? "properties/images" : "properties/videos");
            const pathname = `${uploadDirectory}/${crypto.randomUUID()}-${safeBlobFilename(file.name)}`;
            const blob = await upload(pathname, file, {
              access: "public",
              clientPayload: JSON.stringify({
                kind: isImage ? "image" : "video",
                scope: uploadDirectory.startsWith("projects/") ? "project" : "property",
              }),
              contentType: file.type,
              handleUploadUrl: "/api/uploads/property-media",
              multipart: file.size > 4 * 1024 * 1024,
              onUploadProgress: ({ percentage }) => {
                const completed = fieldUploadedUrls.length;
                const total = Math.max(1, files.length);
                setUploadProgress(Math.round(((completed + percentage / 100) / total) * 100));
              },
            });
            uploadedUrls.push(blob.url);
            fieldUploadedUrls.push(blob.url);
            setUploadProgress(Math.round(((fileIndex + 1) / files.length) * 100));
          }

          payload[field.name] = field.type === "image-upload"
            ? [...existingUrls, ...fieldUploadedUrls]
            : fieldUploadedUrls.at(-1) || existingUrls[0] || "";
        } else if (field.type === "checkbox") {
          payload[field.name] = formData.get(field.name) === "on";
        } else {
          payload[field.name] = formData.get(field.name);
        }
      }
      if (!editing && createDefaults) {
        for (const [key, value] of Object.entries(createDefaults)) {
          if (payload[key] === "" || payload[key] === undefined || payload[key] === null) {
            payload[key] = value;
          }
        }
      }

      const url = editing?._id ? `${endpoint}/${editing._id}` : endpoint;
      const response = await fetch(url, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: editing?._id ? "PATCH" : "POST",
      });
      const result = (await response.json()) as ApiItemResponse;

      if (!result.success) {
        if (uploadedUrls.length) {
          void fetch("/api/uploads/property-media", {
            body: JSON.stringify({ urls: uploadedUrls }),
            headers: { "Content-Type": "application/json" },
            method: "DELETE",
          });
        }
        setError(locale === "tr" ? ui.failed : result.error?.message || ui.failed);
        return;
      }

      const removedUrls = fields
        .filter(isMediaUploadField)
        .flatMap((field) => {
          const previous = editing ? mediaUrls(getNestedValue(editing, field.name)) : [];
          const current = mediaUrls(payload[field.name]);
          return previous.filter((url) => !current.includes(url) && isManagedBlobUrl(url));
        });
      if (removedUrls.length) {
        void fetch("/api/uploads/property-media", {
          body: JSON.stringify({ urls: removedUrls }),
          headers: { "Content-Type": "application/json" },
          method: "DELETE",
        });
      }

      setMessage(editing ? ui.updated : ui.created);
      setEditing(null);
      setIsFormOpen(false);
      await fetchItems(page);
    } catch (submitError) {
      if (uploadedUrls.length) {
        void fetch("/api/uploads/property-media", {
          body: JSON.stringify({ urls: uploadedUrls }),
          headers: { "Content-Type": "application/json" },
          method: "DELETE",
        });
      }
      const code = submitError instanceof Error ? submitError.message : "";
      const faErrors: Record<string, string> = {
        INVALID_PROPERTY_IMAGE_TYPE: "فقط عکس JPEG یا PNG انتخاب کنید.",
        INVALID_PROPERTY_VIDEO_TYPE: "فقط ویدیوی MP4 یا 3GP انتخاب کنید.",
        PROPERTY_IMAGE_COUNT_EXCEEDED: "حداکثر ۱۰ عکس قابل ذخیره است.",
        PROPERTY_IMAGE_TOO_LARGE: "حجم هر عکس باید حداکثر ۵ مگابایت باشد.",
        PROPERTY_VIDEO_COUNT_EXCEEDED: "برای هر ملک فقط یک ویدیو قابل ذخیره است.",
        PROPERTY_VIDEO_TOO_LARGE: "حجم ویدیو باید حداکثر ۱۶ مگابایت باشد.",
      };
      const trErrors: Record<string, string> = {
        INVALID_PROPERTY_IMAGE_TYPE: "Yalnızca JPEG veya PNG görsel seçin.",
        INVALID_PROPERTY_VIDEO_TYPE: "Yalnızca MP4 veya 3GP video seçin.",
        PROPERTY_IMAGE_COUNT_EXCEEDED: "En fazla 10 görsel yüklenebilir.",
        PROPERTY_IMAGE_TOO_LARGE: "Her görsel en fazla 5 MB olabilir.",
        PROPERTY_VIDEO_COUNT_EXCEEDED: "Her gayrimenkul için yalnızca bir video yüklenebilir.",
        PROPERTY_VIDEO_TOO_LARGE: "Video en fazla 16 MB olabilir.",
      };
      setError((locale === "tr" ? trErrors : faErrors)[code] || (locale === "tr" ? "Dosyalar yüklenemedi." : "آپلود فایل‌ها انجام نشد."));
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  }

  async function mutateItem(item: CrmRecord, action: "activate" | "archive" | "delete" | "permanent-delete" | "complete", confirmedValue?: string) {
    if (!item._id) return;

    if ((action === "delete" || action === "permanent-delete") && deleteConfirmationField && confirmedValue === undefined) {
      setDeleteTarget(item);
      setDeleteMode(action === "permanent-delete" ? "permanent" : "suspend");
      setDeleteConfirmation("");
      setError("");
      return;
    }

    const isDeleteAction = action === "delete" || action === "permanent-delete";
    const confirmation = isDeleteAction && !deleteConfirmationField ? window.confirm(ui.deleteConfirm) : true;
    if (!confirmation) return;

    const method = isDeleteAction ? "DELETE" : "PATCH";
    const body =
      action === "complete"
        ? { status: "COMPLETED" }
        : action === "activate"
          ? activationPayload || { isActive: true, status: "ACTIVE" }
        : archivePayload || { status: "PASSIVE" };
    const requestUrl = action === "permanent-delete" ? `${endpoint}/${item._id}?permanent=true` : `${endpoint}/${item._id}`;
    const response = await fetch(requestUrl, {
      body: method === "PATCH" ? JSON.stringify(body) : confirmedValue ? JSON.stringify({ confirmation: confirmedValue }) : undefined,
      headers: method === "PATCH" || confirmedValue ? { "Content-Type": "application/json" } : undefined,
      method,
    });
    const result = (await response.json()) as ApiItemResponse;

    if (!result.success) {
      const agentError = locale === "tr"
        ? ({ AGENT_SELF_SUSPEND_FORBIDDEN: "Kendi hesabınızı devre dışı bırakamazsınız.", LAST_ADMIN_SUSPEND_FORBIDDEN: "Son aktif yönetici hesabı devre dışı bırakılamaz.", AGENT_CONFIRMATION_REQUIRED: "Danışman adı doğrulanamadı." } as Record<string, string>)[result.error?.code || ""]
        : ({ AGENT_SELF_SUSPEND_FORBIDDEN: "نمی‌توانید حساب فعلی خودتان را غیرفعال کنید.", LAST_ADMIN_SUSPEND_FORBIDDEN: "آخرین حساب مدیر فعال را نمی‌توان غیرفعال کرد.", AGENT_CONFIRMATION_REQUIRED: "نام مشاور برای تأیید عملیات درست وارد نشده است." } as Record<string, string>)[result.error?.code || ""];
      const expandedAgentError = locale === "tr"
        ? ({ AGENT_SELF_DELETE_FORBIDDEN: "Kendi hesabınızı kalıcı olarak silemezsiniz.", AGENT_PERMANENT_DELETE_REQUIRES_SUSPENSION: "Kalıcı silmeden önce danışmanı devre dışı bırakın." } as Record<string, string>)[result.error?.code || ""]
        : ({ AGENT_SELF_DELETE_FORBIDDEN: "نمی‌توانید حساب فعلی خودتان را برای همیشه حذف کنید.", AGENT_PERMANENT_DELETE_REQUIRES_SUSPENSION: "پیش از حذف دائمی، ابتدا مشاور را غیرفعال کنید." } as Record<string, string>)[result.error?.code || ""];
      setError(locale === "tr" ? ui.failed : expandedAgentError || agentError || result.error?.message || ui.failed);
      return;
    }

    setMessage(action === "activate"
      ? (locale === "tr" ? "Danışman hesabı yeniden etkinleştirildi." : "حساب مشاور دوباره فعال شد.")
      : action === "permanent-delete"
        ? (locale === "tr" ? "Danışman panelden kalıcı olarak silindi." : "مشاور برای همیشه از پنل حذف شد.")
      : action === "complete" ? ui.completed : action === "delete" && deleteConfirmationField
      ? (locale === "tr" ? "Danışman hesabı güvenli biçimde devre dışı bırakıldı; kayıtları korunuyor." : "حساب مشاور با موفقیت غیرفعال شد؛ سوابق او همچنان محفوظ است.")
      : action === "delete" ? ui.deleted : ui.archived);
    if (isDeleteAction) {
      setDeleteTarget(null);
      setDeleteMode("suspend");
      setDeleteConfirmation("");
    }
    await fetchItems(page);
  }

  async function uploadImage(item: CrmRecord, sourceFile?: File) {
    if (!imageUpload || !item._id || !sourceFile || uploadingItemId) return;

    setError("");
    setMessage("");
    setUploadingItemId(item._id);

    try {
      const avatar = await prepareAvatar(sourceFile);
      const formData = new FormData();
      formData.set("avatar", avatar);
      const response = await fetch(`${endpoint}/${item._id}/${imageUpload.path}`, {
        body: formData,
        method: "POST",
      });
      const result = (await response.json()) as ApiItemResponse;
      if (!result.success || !result.data) {
        setError(locale === "tr" ? "Fotoğraf yüklenemedi." : result.error?.message || "آپلود عکس انجام نشد.");
        return;
      }

      setItems((current) => current.map((candidate) => candidate._id === item._id ? { ...candidate, ...result.data } : candidate));
      setMessage(locale === "tr" ? "Danışman fotoğrafı güncellendi." : "عکس مشاور با موفقیت به‌روزرسانی شد.");
    } catch (uploadError) {
      const code = uploadError instanceof Error ? uploadError.message : "";
      const localizedError = locale === "tr"
        ? code === "INVALID_AVATAR_TYPE" ? "Yalnızca JPEG, PNG veya WebP yükleyin." : code === "AVATAR_TOO_LARGE" ? "Fotoğraf 10 MB'den küçük olmalıdır." : "Fotoğraf işlenemedi."
        : code === "INVALID_AVATAR_TYPE" ? "فقط عکس JPEG، PNG یا WebP انتخاب کنید." : code === "AVATAR_TOO_LARGE" ? "حجم عکس اولیه باید کمتر از ۱۰ مگابایت باشد." : "پردازش یا آپلود عکس انجام نشد.";
      setError(localizedError);
    } finally {
      setUploadingItemId("");
    }
  }

  const expectedDeleteConfirmation = deleteTarget && deleteConfirmationField
    ? String(getNestedValue(deleteTarget, deleteConfirmationField) || "")
    : "";
  const deleteConfirmationMatches = Boolean(expectedDeleteConfirmation)
    && deleteConfirmation.trim().toLocaleLowerCase() === expectedDeleteConfirmation.trim().toLocaleLowerCase();

  async function confirmDangerousDelete() {
    if (!deleteTarget || !deleteConfirmationMatches || deleting) return;
    setDeleting(true);
    await mutateItem(deleteTarget, deleteMode === "permanent" ? "permanent-delete" : "delete", expectedDeleteConfirmation);
    setDeleting(false);
  }

  return (
    <div className="mx-auto max-w-[1540px] space-y-5 p-4 sm:p-7">
      <div className="app-card p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <label className="relative md:col-span-2">
              <Search className="pointer-events-none absolute right-3 top-3 size-4 text-slate-400" />
              <input
                className="h-10 w-full rounded-md border border-slate-300 pr-9 text-sm outline-none focus:border-slate-950"
                onChange={(event) => setFilterValues((current) => ({ ...current, q: event.target.value }))}
                placeholder={ui.search}
                value={filterValues.q || ""}
              />
            </label>
            {filters.map((filter) => (
              <FilterControl
                field={filter}
                key={filter.name}
                locale={locale}
                locationDisabled={locationLevel(filter.name) === "district" && !filterCityValue}
                locationOptions={filterOptionsFor(filter)}
                lookups={lookups}
                onChange={(value) => updateFilter(filter, value)}
                value={filterValues[filter.name] || ""}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              onClick={() => void fetchItems(1)}
              type="button"
            >
              <RefreshCw className="size-4" />
              {ui.apply}
            </button>
            {canCreate ? (
              <button
                className="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                onClick={() => openForm()}
                type="button"
              >
                <Plus className="size-4" />
                {ui.add} {localize(primaryLabel)}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {message ? <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="app-card overflow-hidden">
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-500">{ui.loading}</p>
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-right text-sm">
              <thead className="bg-[#f6f8f6] text-xs text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th className="px-4 py-3 font-medium" key={column.key}>
                      {localize(column.label)}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium">{ui.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isInactive = item.isActive === false || String(item.status).toUpperCase() === "SUSPENDED";
                  return (
                  <tr
                    className={`align-top transition-colors duration-200 ${isInactive ? "bg-slate-50/90 hover:bg-slate-100" : "hover:bg-blue-50/40"}`}
                    key={item._id}
                    title={isInactive ? (locale === "tr" ? "Bu danışman aktif değil" : "این مشاور غیرفعال است") : undefined}
                  >
                    {columns.map((column) => (
                      <td
                        className={`max-w-[220px] px-4 py-3 ${isPhoneField(column.key) ? "text-left" : ""} ${isInactive ? "text-slate-400" : "text-slate-700"}`}
                        dir={isPhoneField(column.key) ? "ltr" : undefined}
                        key={column.key}
                      >
                        {imageUpload?.field === column.key ? (
                          <AgentAvatar
                            className={`size-11 text-xs ${isInactive ? "opacity-55 grayscale" : ""}`}
                            name={String(item.fullName || item.name || (locale === "tr" ? "Danışman" : "مشاور"))}
                            src={getNestedValue(item, column.key)}
                          />
                        ) : column.key === "status" && isInactive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                            <UserX className="size-3.5" />
                            {locale === "tr" ? "Devre dışı" : "غیرفعال"}
                          </span>
                        ) : (
                          <span className="line-clamp-2">{displayValue(getNestedValue(item, column.key), locale)}</span>
                        )}
                      </td>
                    ))}
                    <td className="min-w-[260px] px-4 py-3">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {detailBasePath && item._id ? (
                          <Link
                            className="grid size-9 place-items-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-950 hover:shadow-sm"
                            href={`${detailBasePath}/${item._id}`}
                            title={ui.view}
                          >
                            <Eye className="size-4" />
                          </Link>
                        ) : null}
                        {workspaceBasePath && item._id ? (
                          <Link
                            className="grid size-9 place-items-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-950 hover:shadow-sm"
                            href={`${workspaceBasePath}/${item._id}/dashboard`}
                            title={ui.viewPanel}
                          >
                            <LayoutDashboard className="size-4" />
                          </Link>
                        ) : null}
                        {canEdit ? (
                          <button
                            className="grid size-9 place-items-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-950 hover:shadow-sm"
                            onClick={() => openForm(item)}
                            title={ui.edit}
                            type="button"
                          >
                            <Edit className="size-4" />
                          </button>
                        ) : null}
                        {imageUpload && item._id ? (
                          <label
                            className="grid size-9 cursor-pointer place-items-center rounded-lg border border-transparent text-blue-600 transition hover:border-blue-200 hover:bg-blue-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                            aria-disabled={Boolean(uploadingItemId)}
                            title={locale === "tr" ? "Danışman fotoğrafını yükle" : "آپلود عکس مشاور"}
                          >
                            <ImageUp className={uploadingItemId === item._id ? "size-4 animate-pulse" : "size-4"} />
                            <input
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={Boolean(uploadingItemId)}
                              onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                event.currentTarget.value = "";
                                void uploadImage(item, file);
                              }}
                              type="file"
                            />
                          </label>
                        ) : null}
                        {endpoint.includes("follow-ups") ? (
                          <button
                            className="grid size-9 place-items-center rounded-lg border border-transparent text-emerald-600 transition hover:border-emerald-200 hover:bg-emerald-50"
                            onClick={() => void mutateItem(item, "complete")}
                            title={ui.complete}
                            type="button"
                          >
                            <Check className="size-4" />
                          </button>
                        ) : null}
                        {canArchive ? (
                          <button
                            className="grid size-9 place-items-center rounded-lg border border-transparent text-amber-600 transition hover:border-amber-200 hover:bg-amber-50"
                            onClick={() => void mutateItem(item, "archive")}
                            title={ui.archive}
                            type="button"
                          >
                            <Archive className="size-4" />
                          </button>
                        ) : null}
                        {activationPayload && isInactive ? (
                          <button
                            aria-label={locale === "tr" ? "Danışmanı yeniden etkinleştir" : "فعال‌کردن مجدد مشاور"}
                            className="grid size-9 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 hover:shadow"
                            onClick={() => void mutateItem(item, "activate")}
                            title={locale === "tr" ? "Danışmanı yeniden etkinleştir" : "فعال‌کردن مجدد مشاور"}
                            type="button"
                          >
                            <UserCheck className="size-4" />
                          </button>
                        ) : null}
                        {canPermanentlyDelete && isInactive ? (
                          <button
                            aria-label={locale === "tr" ? "Danışmanı kalıcı olarak sil" : "حذف دائمی مشاور از پنل"}
                            className="grid size-9 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-100 hover:shadow"
                            onClick={() => void mutateItem(item, "permanent-delete")}
                            title={locale === "tr" ? "Danışmanı kalıcı olarak sil" : "حذف دائمی مشاور از پنل"}
                            type="button"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                        {canDelete && (!activationPayload || !isInactive) ? (
                          <button
                            className="grid size-9 place-items-center rounded-lg border border-transparent text-red-600 transition hover:border-red-200 hover:bg-red-50"
                            onClick={() => void mutateItem(item, "delete")}
                            title={deleteConfirmationField ? (locale === "tr" ? "Danışmanı devre dışı bırak" : "غیرفعال کردن مشاور") : ui.delete}
                            type="button"
                          >
                            {deleteConfirmationField ? <UserX className="size-4" /> : <Trash2 className="size-4" />}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8">
            <p className="text-sm font-medium text-slate-700">{ui.noRecords}</p>
            {canCreate ? (
              <button
                className="mt-3 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                onClick={() => openForm()}
                type="button"
              >
                {ui.addFirst} {localize(primaryLabel)}
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {ui.page} {pagination.page.toLocaleString(locale === "fa" ? "fa-IR" : "tr-TR")} {ui.of} {pagination.pages.toLocaleString(locale === "fa" ? "fa-IR" : "tr-TR")} · {pagination.total.toLocaleString(locale === "fa" ? "fa-IR" : "tr-TR")} {ui.record}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50"
            disabled={pagination.page <= 1}
            onClick={() => void fetchItems(page - 1)}
            type="button"
          >
            {ui.previous}
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50"
            disabled={pagination.page >= pagination.pages}
            onClick={() => void fetchItems(page + 1)}
            type="button"
          >
            {ui.next}
          </button>
        </div>
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-950">
                {editing ? ui.edit : ui.add} {localize(primaryLabel)}
              </h2>
              <button
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setIsFormOpen(false)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
            <form className="space-y-5 p-5" onSubmit={submitForm}>
              {Object.entries(groupedFields).map(([section, sectionFields]) => (
                <fieldset className="rounded-lg border border-slate-200 p-4" key={section}>
                  <legend className="px-2 text-sm font-semibold text-slate-700">{localize(section)}</legend>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {sectionFields.map((field) => (
                      <FormControl
                        field={field}
                        key={field.name}
                        locale={locale}
                        location={
                          locationLevel(field.name)
                            ? {
                                disabled:
                                  (locationLevel(field.name) === "district" && !formCityValue) ||
                                  (locationLevel(field.name) === "neighborhood" && (!formCityValue || !formDistrictValue)),
                                onChange: (value) => updateFormLocation(field, value),
                                onRetry:
                                  locationLevel(field.name) === "province"
                                    ? reloadProvinceOptions
                                    : undefined,
                                options: formOptionsFor(field) || [],
                                optionsError: locationLevel(field.name) === "province" && provinceOptionsError,
                                optionsLoading: locationLevel(field.name) === "province" && provinceOptionsLoading,
                              }
                            : undefined
                        }
                        lookups={lookups}
                        value={
                          locationLevel(field.name)
                            ? formLocationValues[field.name] || ""
                            : toInputValue(editing ? getNestedValue(editing, field.name) : undefined)
                        }
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
              <div className="flex justify-end gap-2">
                <button
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  onClick={() => setIsFormOpen(false)}
                  type="button"
                >
                  {ui.cancel}
                </button>
                <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit">
                  {saving ? (uploadProgress > 0 ? `${locale === "tr" ? "Yükleniyor" : "در حال آپلود"} ${uploadProgress}%` : (locale === "tr" ? "Kaydediliyor..." : "در حال ذخیره...")) : ui.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget && deleteConfirmationField && deleteMode === "suspend" ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-red-100 bg-white shadow-2xl">
            <div className="flex items-start gap-4 border-b border-slate-100 p-5 sm:p-6">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600"><AlertTriangle className="size-6" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold text-slate-950">{locale === "tr" ? "Danışman hesabını devre dışı bırak" : "غیرفعال کردن حساب مشاور"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {locale === "tr"
                    ? "Bu işlem danışmanın sisteme girişini durdurur. Müşteri, takip ve aktivite kayıtları silinmez."
                    : "این عملیات ورود مشاور به سیستم را متوقف می‌کند؛ مشتریان، پیگیری‌ها و سوابق فعالیت او حذف نمی‌شوند."}
                </p>
              </div>
              <button aria-label={ui.cancel} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => { setDeleteTarget(null); setDeleteConfirmation(""); }} type="button"><X className="size-5" /></button>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                {locale === "tr" ? "Onaylamak için danışmanın tam adını aşağıya yazın:" : "برای تأیید، نام کامل مشاور را دقیقاً در کادر زیر وارد کنید:"}
                <strong className="mt-1 block text-base text-slate-950" dir="auto">{expectedDeleteConfirmation}</strong>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">{locale === "tr" ? "Danışmanın tam adı" : "نام کامل مشاور"}</span>
                <input autoFocus className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100" dir="auto" onChange={(event) => setDeleteConfirmation(event.target.value)} value={deleteConfirmation} />
              </label>
              {error ? <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => { setDeleteTarget(null); setDeleteConfirmation(""); }} type="button">{ui.cancel}</button>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400" disabled={!deleteConfirmationMatches || deleting} onClick={() => void confirmDangerousDelete()} type="button">
                  <UserX className="size-4" />
                  {deleting ? (locale === "tr" ? "Devre dışı bırakılıyor..." : "در حال غیرفعال‌سازی...") : (locale === "tr" ? "Hesabı devre dışı bırak" : "تأیید و غیرفعال‌سازی حساب")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget && deleteConfirmationField && deleteMode === "permanent" ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl">
            <div className="flex items-start gap-4 border-b border-red-100 p-5 sm:p-6">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-700"><Trash2 className="size-6" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold text-red-700">{locale === "tr" ? "Danışmanı kalıcı olarak sil" : "حذف دائمی مشاور"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {locale === "tr"
                    ? "Bu işlem danışman hesabını panelden tamamen kaldırır ve geri alınamaz. Müşteri ve gayrimenkul kayıtları silinmez; danışman atamaları kaldırılır."
                    : "این عملیات حساب مشاور را کاملاً از پنل حذف می‌کند و قابل بازگشت نیست. مشتریان و املاک حذف نمی‌شوند؛ فقط انتساب آن‌ها به این مشاور برداشته می‌شود."}
                </p>
              </div>
              <button aria-label={ui.cancel} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" onClick={() => { setDeleteTarget(null); setDeleteMode("suspend"); setDeleteConfirmation(""); }} type="button"><X className="size-5" /></button>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
                {locale === "tr" ? "Onaylamak için danışmanın tam adını yazın:" : "برای تأیید حذف دائمی، نام کامل مشاور را دقیقاً وارد کنید:"}
                <strong className="mt-1 block text-base text-slate-950" dir="auto">{expectedDeleteConfirmation}</strong>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">{locale === "tr" ? "Danışmanın tam adı" : "نام کامل مشاور"}</span>
                <input autoFocus className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100" dir="auto" onChange={(event) => setDeleteConfirmation(event.target.value)} value={deleteConfirmation} />
              </label>
              {error ? <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => { setDeleteTarget(null); setDeleteMode("suspend"); setDeleteConfirmation(""); }} type="button">{ui.cancel}</button>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400" disabled={!deleteConfirmationMatches || deleting} onClick={() => void confirmDangerousDelete()} type="button">
                  <Trash2 className="size-4" />
                  {deleting ? (locale === "tr" ? "Kalıcı olarak siliniyor..." : "در حال حذف دائمی...") : (locale === "tr" ? "Kalıcı olarak sil" : "تأیید حذف دائمی")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterControl({
  field,
  locale,
  locationDisabled,
  locationOptions,
  lookups,
  onChange,
  value,
}: {
  field: FieldConfig;
  locale: AppLocale;
  locationDisabled?: boolean;
  locationOptions?: FieldOption[];
  lookups: LookupState;
  onChange: (value: string) => void;
  value: string;
}) {
  const options = includeCurrentOption(locationOptions || field.options || lookups[field.name] || [], value, locale);

  if (locationLevel(field.name) || field.type === "select" || options.length) {
    return (
      <select
        className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        dir={locationLevel(field.name) ? "ltr" : undefined}
        disabled={locationDisabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{translateLiteral(field.label, locale)}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {translateLiteral(option.label, locale)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
      onChange={(event) => onChange(event.target.value)}
      placeholder={translateLiteral(field.label, locale)}
      type={field.type === "number" ? "number" : "text"}
      value={value}
    />
  );
}

function FormControl({
  field,
  locale,
  location,
  lookups,
  value,
}: {
  field: FieldConfig;
  locale: AppLocale;
  location?: {
    disabled: boolean;
    onChange: (value: string) => void;
    onRetry?: () => void;
    options: FieldOption[];
    optionsError?: boolean;
    optionsLoading?: boolean;
  };
  lookups: LookupState;
  value: boolean | string;
}) {
  const options = field.options || lookups[field.name] || [];
  const className = "h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950";

  if (isMediaUploadField(field)) {
    return <MediaUploadControl field={field} locale={locale} value={value} />;
  }

  if (location) {
    const level = locationLevel(field.name);
    const currentValue = String(value);
    const locationOptions = includeCurrentOption(location.options, currentValue, locale);
    const placeholder = location.optionsLoading
      ? locale === "tr" ? "Şehirler yükleniyor..." : "در حال دریافت شهرها..."
      : location.optionsError
        ? locale === "tr" ? "Şehirler yüklenemedi" : "دریافت شهرها ناموفق بود"
        : locale === "tr"
      ? level === "province"
        ? "Şehir seçin"
        : level === "district"
          ? location.disabled ? "Önce şehir seçin" : "İlçe seçin"
          : location.disabled ? "Önce şehir ve ilçe seçin" : "Mahalle seçin"
      :
      level === "province"
        ? "انتخاب شهر"
        : level === "district"
          ? location.disabled
            ? "ابتدا شهر را انتخاب کنید"
            : "انتخاب منطقه"
          : location.disabled
            ? "ابتدا شهر و منطقه را انتخاب کنید"
            : "انتخاب محله";

    return (
      <label>
        <span className="mb-1 block text-sm font-medium text-slate-700">{translateLiteral(field.label, locale)}</span>
        <select
          className={`${className} w-full disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
          dir="ltr"
          disabled={location.disabled || location.optionsLoading || location.optionsError}
          name={field.name}
          onChange={(event) => location.onChange(event.target.value)}
          required={field.required}
          value={currentValue}
        >
          <option value="">{placeholder}</option>
          {locationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {translateLiteral(option.label, locale)}
            </option>
          ))}
        </select>
        {level === "province" && location.optionsError && location.onRetry ? (
          <button
            className="mt-2 text-xs font-bold text-blue-700 hover:underline"
            onClick={location.onRetry}
            type="button"
          >
            {locale === "tr" ? "Tekrar dene" : "تلاش مجدد برای دریافت شهرها"}
          </button>
        ) : null}
      </label>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
        <input defaultChecked={Boolean(value)} name={field.name} type="checkbox" />
        {translateLiteral(field.label, locale)}
      </label>
    );
  }

  return (
    <label className={field.type === "textarea" ? "md:col-span-2 xl:col-span-3" : undefined}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{translateLiteral(field.label, locale)}</span>
      {field.type === "textarea" ? (
        <textarea
          className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
          defaultValue={String(value)}
          name={field.name}
          required={field.required}
        />
      ) : field.type === "select" || options.length ? (
        <select className={className} defaultValue={String(value)} name={field.name} required={field.required}>
          <option value="">{locale === "tr" ? "Seçin" : "انتخاب کنید"}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {translateLiteral(option.label, locale)}
            </option>
          ))}
        </select>
      ) : (
        <input
          autoComplete={isPhoneField(field.name) ? "tel" : undefined}
          className={`${className} ${isPhoneField(field.name) ? "text-left" : ""}`}
          defaultValue={String(value)}
          dir={field.type === "date" || isPhoneField(field.name) ? "ltr" : undefined}
          inputMode={isPhoneField(field.name) ? "tel" : undefined}
          lang={field.type === "date" ? "en-GB" : undefined}
          name={field.name}
          pattern={field.name === "whatsapp" ? "\\+[1-9][0-9\\s().-]{7,20}" : undefined}
          placeholder={field.name === "whatsapp" ? "+90 5XX XXX XX XX" : undefined}
          required={field.required}
          type={field.type === "date" ? "datetime-local" : isPhoneField(field.name) ? "tel" : field.type || "text"}
        />
      )}
    </label>
  );
}

function MediaUploadControl({ field, locale, value }: { field: FieldConfig; locale: AppLocale; value: boolean | string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [existingUrls, setExistingUrls] = useState(() => mediaUrls(value));
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const isImage = field.type === "image-upload";
  const accept = isImage ? PROPERTY_IMAGE_TYPES.join(",") : PROPERTY_VIDEO_TYPES.join(",");

  function clearSelection() {
    if (inputRef.current) inputRef.current.value = "";
    setSelectedFiles([]);
  }

  return (
    <div className="md:col-span-2 xl:col-span-3">
      <span className="mb-1 block text-sm font-medium text-slate-700">{translateLiteral(field.label, locale)}</span>
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md bg-white px-4 py-5 text-center text-sm text-slate-600 transition hover:bg-slate-100">
          <ImageUp className="size-6 text-slate-500" />
          <span className="font-medium text-slate-800">
            {locale === "tr"
              ? isImage ? "Görselleri seçin" : "Videoyu seçin"
              : isImage ? "عکس‌ها را انتخاب کنید" : "ویدیو را انتخاب کنید"}
          </span>
          <span className="text-xs text-slate-500">
            {isImage
              ? locale === "tr" ? "JPEG veya PNG · en fazla 10 görsel · her biri 5 MB" : "JPEG یا PNG · حداکثر ۱۰ عکس · هرکدام ۵ مگابایت"
              : locale === "tr" ? "MP4 veya 3GP · H.264/AAC · en fazla 16 MB" : "MP4 یا 3GP · کدک H.264/AAC · حداکثر ۱۶ مگابایت"}
          </span>
          <input
            accept={accept}
            className="sr-only"
            multiple={isImage}
            name={`${field.name}Upload`}
            onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
            ref={inputRef}
            type="file"
          />
        </label>

        {selectedFiles.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {selectedFiles.map((file) => <span className="rounded-full bg-white px-3 py-1" key={`${file.name}-${file.lastModified}`}>{file.name}</span>)}
            <button className="rounded-full px-2 py-1 text-red-600 hover:bg-red-50" onClick={clearSelection} type="button">
              {locale === "tr" ? "Seçimi temizle" : "پاک‌کردن انتخاب"}
            </button>
          </div>
        ) : null}

        {existingUrls.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {existingUrls.map((url) => (
              <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white" key={url}>
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="h-28 w-full object-cover" src={url} />
                ) : (
                  <video className="h-32 w-full bg-slate-950 object-contain" controls preload="metadata" src={url} />
                )}
                <input name={field.name} type="hidden" value={url} />
                <button
                  aria-label={locale === "tr" ? "Dosyayı kaldır" : "حذف فایل"}
                  className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-white/90 text-red-600 shadow"
                  onClick={() => setExistingUrls((current) => current.filter((item) => item !== url))}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function includeCurrentOption(options: FieldOption[], currentValue: string, locale: AppLocale) {
  if (!currentValue || options.some((option) => option.value === currentValue)) return options;
  return [{ label: `${currentValue} (${locale === "tr" ? "mevcut değer" : "مقدار فعلی"})`, value: currentValue }, ...options];
}
