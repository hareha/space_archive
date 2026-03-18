/**
 * lunarDataLoader.ts
 * CSV/TAB 데이터 파일들을 파싱하여 메모리에 캐싱하는 유틸리티
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

// ─── 타입 정의 ───
export interface LunarFeature {
  id: string;
  name_en: string;
  name_kr: string;
  type_en: string;  // Crater, Mare, Sinus, Montes, Rupes, Swirl, Vallis, Basin, Mons, Rima
  type_kr: string;
  lat: number;
  lng: number;
  diameter_km: number;
  depth_km: number;
  area_km2: number;
  description: string;
  isFarSide: boolean; // lng < -90 || lng > 90
}

export interface LandingSite {
  official_name: string;
  name_kr: string;
  country: string;
  lat: number;
  lng: number;
  landing_date: string;
  mission_type: string;
  contact_type: string;
  description: string;
}

export interface ThermalPoint {
  lat: number;
  lon: number;
  day_max: number;    // Kelvin
  night_min: number;  // Kelvin
}

export interface HydrogenPoint {
  lat: number;
  lon: number;
  neutron_count: number;
}

export interface GravityPoint {
  lat: number;
  lon: number;
  gravity: number;
}

// ─── 캐시 ───
let _features: LunarFeature[] | null = null;
let _landingSites: LandingSite[] | null = null;
let _thermalGrid: ThermalPoint[] | null = null;
let _hydrogenGrid: HydrogenPoint[] | null = null;
let _gravityGrid: GravityPoint[] | null = null;

// ─── CSV 파싱 헬퍼 ───
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

async function loadAssetText(assetModule: number): Promise<string> {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Asset localUri is null');
  return await FileSystem.readAsStringAsync(asset.localUri);
}

// ─── 로더 함수들 ───
export async function loadFeatures(): Promise<LunarFeature[]> {
  if (_features) return _features;
  const text = await loadAssetText(require('@/assets/lunar_features_updated.csv'));
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  _features = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 12) continue;
    const lng = parseFloat(cols[6]);
    _features.push({
      id: cols[0],
      name_en: cols[1],
      name_kr: cols[2],
      type_en: cols[3],
      type_kr: cols[4],
      lat: parseFloat(cols[5]),
      lng,
      diameter_km: parseFloat(cols[7]) || 0,
      depth_km: parseFloat(cols[8]) || 0,
      area_km2: parseFloat(cols[9]) || 0,
      description: cols[11] || '',
      isFarSide: lng < -90 || lng > 90,
    });
  }
  return _features;
}

export async function loadLandingSites(): Promise<LandingSite[]> {
  if (_landingSites) return _landingSites;
  const text = await loadAssetText(require('@/assets/spaceship.csv'));
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim().length > 0);
  _landingSites = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 12) continue;
    _landingSites.push({
      official_name: cols[0],
      name_kr: cols[1],
      country: cols[2],
      lat: parseFloat(cols[5]),
      lng: parseFloat(cols[6]),
      landing_date: cols[7],
      mission_type: cols[9],
      contact_type: cols[11],
      description: cols[10] || '',
    });
  }
  return _landingSites;
}

export async function loadThermal(): Promise<ThermalPoint[]> {
  if (_thermalGrid) return _thermalGrid;
  const text = await loadAssetText(require('@/assets/moon_thermal_1deg_grid.csv'));
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  _thermalGrid = [];
  // 10도 간격으로 샘플링 (성능)
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 4) continue;
    const lat = parseFloat(cols[0]);
    const lon = parseFloat(cols[1]);
    if (lat % 10 !== 0 || lon % 10 !== 0) continue;
    _thermalGrid.push({
      lat, lon,
      day_max: parseFloat(cols[2]),
      night_min: parseFloat(cols[3]),
    });
  }
  return _thermalGrid;
}

export async function loadHydrogen(): Promise<HydrogenPoint[]> {
  if (_hydrogenGrid) return _hydrogenGrid;
  const text = await loadAssetText(require('@/assets/moon_hydrogen_heatmap_final.csv'));
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  _hydrogenGrid = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 3) continue;
    const lat = parseFloat(cols[0]);
    const lon = parseFloat(cols[1]);
    if (lat % 10 !== 0 || lon % 10 !== 0) continue;
    _hydrogenGrid.push({ lat, lon, neutron_count: parseFloat(cols[2]) });
  }
  return _hydrogenGrid;
}

export async function loadGravity(): Promise<GravityPoint[]> {
  if (_gravityGrid) return _gravityGrid;
  const text = await loadAssetText(require('@/assets/moon_underground_gravity_1deg.csv'));
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  _gravityGrid = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 3) continue;
    const lat = parseFloat(cols[0]);
    const lon = parseFloat(cols[1]);
    if (lat % 10 !== 0 || lon % 10 !== 0) continue;
    _gravityGrid.push({ lat, lon, gravity: parseFloat(cols[2]) });
  }
  return _gravityGrid;
}

// ─── 좌표 기반 데이터 조회 유틸 ───
function findNearest<T extends { lat: number; lon: number }>(grid: T[], lat: number, lon: number): T | null {
  if (grid.length === 0) return null;
  let best = grid[0];
  let bestDist = (best.lat - lat) ** 2 + (best.lon - lon) ** 2;
  for (let i = 1; i < grid.length; i++) {
    const d = (grid[i].lat - lat) ** 2 + (grid[i].lon - lon) ** 2;
    if (d < bestDist) { bestDist = d; best = grid[i]; }
  }
  return best;
}

export function getThermalAt(lat: number, lng: number): { day_max: number; night_min: number } | null {
  if (!_thermalGrid) return null;
  const p = findNearest(_thermalGrid, lat, lng);
  return p ? { day_max: p.day_max, night_min: p.night_min } : null;
}

export function getHydrogenAt(lat: number, lng: number): number | null {
  if (!_hydrogenGrid) return null;
  const p = findNearest(_hydrogenGrid, lat, lng);
  return p ? p.neutron_count : null;
}

export function getGravityAt(lat: number, lng: number): number | null {
  if (!_gravityGrid) return null;
  const p = findNearest(_gravityGrid, lat, lng);
  return p ? p.gravity : null;
}

// ─── 거리 계산 (도 단위 간이) ───
export function degDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2);
}
