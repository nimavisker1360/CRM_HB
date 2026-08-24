import "server-only";

import {
  getAllProvinces,
  getDistrictsByProvinceName,
  getNeighborhoodsByDistrictApiId,
} from "turkey-location-data";

export type TurkeyLocationOption = { id?: number; label: string; value: string };

export function getTurkeyProvinces(): TurkeyLocationOption[] {
  return getAllProvinces()
    .map((province) => ({ id: province.apiId, label: province.name, value: province.name }))
    .sort(turkishSort);
}

export function getTurkeyDistricts(provinceInput: string): TurkeyLocationOption[] {
  const province = resolveByName(getAllProvinces(), provinceInput);
  if (!province) return [];
  return getDistrictsByProvinceName(province.name)
    .map((district) => ({ id: district.apiId, label: district.name, value: district.name }))
    .sort(turkishSort);
}

export function getTurkeyNeighborhoods(provinceInput: string, districtInput: string): TurkeyLocationOption[] {
  const district = resolveByName(getTurkeyDistricts(provinceInput), districtInput);
  if (!district?.id) return [];
  return getNeighborhoodsByDistrictApiId(district.id)
    .map((name, index) => ({ id: index + 1, label: name, value: name }))
    .sort(turkishSort);
}

export function normalizeTurkeyLocationName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function resolveByName<T extends { label?: string; name?: string }>(items: T[], value: string) {
  const normalized = normalizeTurkeyLocationName(value);
  return items.find((item) => normalizeTurkeyLocationName(item.name || item.label || "") === normalized);
}

function turkishSort(a: TurkeyLocationOption, b: TurkeyLocationOption) {
  return a.label.localeCompare(b.label, "tr-TR");
}
