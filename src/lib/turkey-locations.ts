import "server-only";

import rawTurkeyLocationData from "turkey-location-data/data/turkey_location_data.json";

export type TurkeyLocationOption = { id?: number; label: string; value: string };
type TurkeyNeighborhood = { name: string; apiId: number };
type TurkeyDistrict = { name: string; apiId: number; neighborhoods: TurkeyNeighborhood[] };
type TurkeyProvince = { name: string; apiId: number; districts: TurkeyDistrict[] };

const turkeyLocationData = rawTurkeyLocationData as TurkeyProvince[];

export function getTurkeyProvinces(): TurkeyLocationOption[] {
  return turkeyLocationData
    .map((province) => ({ id: province.apiId, label: province.name, value: province.name }))
    .sort(turkishSort);
}

export function getTurkeyDistricts(provinceInput: string): TurkeyLocationOption[] {
  const province = resolveByName(turkeyLocationData, provinceInput);
  if (!province) return [];
  return province.districts
    .map((district) => ({ id: district.apiId, label: district.name, value: district.name }))
    .sort(turkishSort);
}

export function getTurkeyNeighborhoods(provinceInput: string, districtInput: string): TurkeyLocationOption[] {
  const province = resolveByName(turkeyLocationData, provinceInput);
  const district = province ? resolveByName(province.districts, districtInput) : undefined;
  if (!district) return [];
  return district.neighborhoods
    .map((neighborhood) => ({ id: neighborhood.apiId, label: neighborhood.name, value: neighborhood.name }))
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
