/**
 * 더미 유저 데이터 — 주인공 1명 + 더미 20명
 * S2 Level 16 셀 구매 정보 포함
 * 
 * cellId = S2 토큰(hex) — CesiumJS의 s2.cellid.toToken()과 동일
 * s2js 라이브러리로 lat/lng → S2 Cell ID → Level 16 parent → 토큰 변환
 * 
 * TODO: TEMP_AUTH - 실제 서버 연동 시 서버에서 셀 관리
 */

import { s2 } from 's2js';

export interface OwnedCell {
  cellId: string;       // S2 토큰 (hex)
  lat: number;          // 중심 위경도 (보조: 범위 쿼리용)
  lng: number;
  purchasedAt: string;  // ISO date
  cost: number;         // Mag
}

export interface DummyUser {
  id: string;
  email: string;
  password: string;     // 평문 (임시용)
  nickname: string;
  avatarColor: string;
  magBalance: number;
  totalOccupied: number;
  joinDate: string;
  ownedCells: OwnedCell[];
}

// ── 시드 기반 난수 생성 ──
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── lat/lng → S2 Level 16 토큰 ──
function latLngToS2Token(lat: number, lng: number): string {
  const ll = s2.LatLng.fromDegrees(lat, lng);
  const leafId = s2.cellid.fromLatLng(ll);
  const cellId = s2.cellid.parent(leafId, 16);
  return s2.cellid.toToken(cellId);
}

// ── S2 토큰 → 중심 위경도 ──
function tokenToLatLng(token: string): { lat: number; lng: number } {
  const cellId = s2.cellid.fromToken(token);
  const cell = s2.Cell.fromCellID(cellId);
  const center = cell.center();
  const r = Math.sqrt(center.x * center.x + center.y * center.y + center.z * center.z);
  const lat = Math.asin(center.z / r) * (180 / Math.PI);
  const lng = Math.atan2(center.y, center.x) * (180 / Math.PI);
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

// ── 달 반경으로 km→도 변환 ──
const MOON_RADIUS_KM = 1737.4;
function kmToDeg(km: number, centerLat: number) {
  const latDeg = (km / MOON_RADIUS_KM) * (180 / Math.PI);
  const lngDeg = latDeg / Math.cos((centerLat * Math.PI) / 180);
  return { latDeg, lngDeg };
}

// ── 실제 POI 범위 내에서 S2 Level 16 셀 생성 (토큰 기반) ──
interface POI {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

function generateCellsInPOI(
  poi: POI,
  count: number,
  seed: number
): OwnedCell[] {
  const rand = seededRandom(seed);
  const cells: OwnedCell[] = [];
  const { latDeg, lngDeg } = kmToDeg(poi.radiusKm, poi.lat);
  const used = new Set<string>();

  let attempts = 0;
  while (cells.length < count && attempts < count * 20) {
    attempts++;
    // POI 범위 내 랜덤 위치
    const randLat = poi.lat + (rand() - 0.5) * 2 * latDeg;
    const randLng = poi.lng + (rand() - 0.5) * 2 * lngDeg;

    // S2 Level 16 토큰 계산
    const token = latLngToS2Token(randLat, randLng);

    if (used.has(token)) continue;
    used.add(token);

    // 토큰의 실제 중심 위경도
    const center = tokenToLatLng(token);

    const daysAgo = Math.floor(rand() * 90);
    const date = new Date(Date.now() - daysAgo * 86400000);

    cells.push({
      cellId: token,
      lat: center.lat,
      lng: center.lng,
      purchasedAt: date.toISOString().split('T')[0],
      cost: 1,
    });
  }

  return cells;
}

// ── 실제 착륙지 + 주요 지형 POI ──
const POIS: POI[] = [
  // 착륙지 (반경 5km)
  { name: '아폴로 11호', lat: 0.674, lng: 23.473, radiusKm: 5 },
  { name: '아폴로 12호', lat: -3.0124, lng: -23.4216, radiusKm: 5 },
  { name: '아폴로 15호', lat: 26.1322, lng: 3.6339, radiusKm: 5 },
  { name: '아폴로 16호', lat: -8.973, lng: 15.5002, radiusKm: 5 },
  { name: '아폴로 17호', lat: 20.1908, lng: 30.7717, radiusKm: 5 },
  { name: '루나 2호', lat: 29.1, lng: 0, radiusKm: 5 },
  { name: '찬드라얀 3호', lat: -69.373, lng: 32.319, radiusKm: 5 },
  { name: '창어 3호', lat: 44.12, lng: -19.51, radiusKm: 5 },
  { name: '블루고스트 M1', lat: 18.56, lng: 61.81, radiusKm: 5 },
  { name: '루나 9호', lat: 7.03, lng: -64.33, radiusKm: 5 },

  // 주요 지형 (반경 = diameterKm / 2)
  { name: '고요의 바다', lat: 8.5, lng: 31.4, radiusKm: 436 },
  { name: '티코', lat: -43.3, lng: -11.2, radiusKm: 42.5 },
  { name: '코페르니쿠스', lat: 9.6, lng: -20.1, radiusKm: 46.5 },
  { name: '플라톤', lat: 51.6, lng: -9.4, radiusKm: 50.5 },
  { name: '아리스타르코스', lat: 23.7, lng: -47.4, radiusKm: 20 },
  { name: '무지개 만', lat: 44.1, lng: -31.5, radiusKm: 118 },
  { name: '클라비우스', lat: -58.4, lng: -14.4, radiusKm: 115.5 },
  { name: '위기의 바다', lat: 17.0, lng: 59.1, radiusKm: 278 },
  { name: '중앙 만', lat: 2.4, lng: 1.7, radiusKm: 167.5 },
  { name: '직선의 벽', lat: -21.67, lng: -7.70, radiusKm: 67 },
];

// ── 주인공 유저 (아폴로 11호 + 고요의 바다) ──
const HERO_APOLLO11 = generateCellsInPOI(POIS[0], 200, 42);
const HERO_TRANQUILITY = generateCellsInPOI(POIS[10], 200, 43);

export const HERO_USER: DummyUser = {
  id: 'hero',
  email: 'explorer@plusultra.io',
  password: 'password123',
  nickname: '루나탐험가',
  avatarColor: '#3B82F6',
  magBalance: 12500,
  totalOccupied: 400,
  joinDate: '2025-01-15',
  ownedCells: [...HERO_APOLLO11, ...HERO_TRANQUILITY],
};

// ── 더미 유저 20명 ──
const DUMMY_PROFILES: Omit<DummyUser, 'ownedCells' | 'totalOccupied'>[] = [
  { id: 'user01', email: 'moon_walker@mail.com', password: 'pw1', nickname: '달탐험러', avatarColor: '#EF4444', magBalance: 8200, joinDate: '2025-02-01' },
  { id: 'user02', email: 'luna_hunter@mail.com', password: 'pw2', nickname: '루나헌터', avatarColor: '#F59E0B', magBalance: 3500, joinDate: '2025-02-10' },
  { id: 'user03', email: 'space_nomad@mail.com', password: 'pw3', nickname: 'SpaceNomad', avatarColor: '#10B981', magBalance: 15000, joinDate: '2025-01-20' },
  { id: 'user04', email: 'crater_king@mail.com', password: 'pw4', nickname: '크레이터킹', avatarColor: '#6366F1', magBalance: 22000, joinDate: '2025-01-05' },
  { id: 'user05', email: 'moon_miner@mail.com', password: 'pw5', nickname: '문마이너', avatarColor: '#EC4899', magBalance: 900, joinDate: '2025-03-01' },
  { id: 'user06', email: 'selenaut@mail.com', password: 'pw6', nickname: '셀레노트', avatarColor: '#14B8A6', magBalance: 6400, joinDate: '2025-02-15' },
  { id: 'user07', email: 'regolith@mail.com', password: 'pw7', nickname: '레골리스', avatarColor: '#F97316', magBalance: 1200, joinDate: '2025-03-05' },
  { id: 'user08', email: 'tycho_fan@mail.com', password: 'pw8', nickname: '티코팬', avatarColor: '#8B5CF6', magBalance: 18500, joinDate: '2025-01-10' },
  { id: 'user09', email: 'mare_lover@mail.com', password: 'pw9', nickname: '바다사랑', avatarColor: '#06B6D4', magBalance: 4300, joinDate: '2025-02-20' },
  { id: 'user10', email: 'astronova@mail.com', password: 'pw10', nickname: 'AstroNova', avatarColor: '#D946EF', magBalance: 7600, joinDate: '2025-02-05' },
  { id: 'user11', email: 'darkside@mail.com', password: 'pw11', nickname: '다크사이더', avatarColor: '#64748B', magBalance: 11000, joinDate: '2025-01-25' },
  { id: 'user12', email: 'apollo_kid@mail.com', password: 'pw12', nickname: '아폴로키드', avatarColor: '#F43F5E', magBalance: 2100, joinDate: '2025-03-10' },
  { id: 'user13', email: 'helium3@mail.com', password: 'pw13', nickname: 'He3채굴자', avatarColor: '#22C55E', magBalance: 31000, joinDate: '2024-12-20' },
  { id: 'user14', email: 'crater_explorer@mail.com', password: 'pw14', nickname: '크레이터탐험', avatarColor: '#A855F7', magBalance: 5700, joinDate: '2025-02-12' },
  { id: 'user15', email: 'lunar_architect@mail.com', password: 'pw15', nickname: '달건축가', avatarColor: '#0EA5E9', magBalance: 45000, joinDate: '2024-11-15' },
  { id: 'user16', email: 'mare_trader@mail.com', password: 'pw16', nickname: '바다상인', avatarColor: '#EAB308', magBalance: 8900, joinDate: '2025-01-30' },
  { id: 'user17', email: 'south_pole@mail.com', password: 'pw17', nickname: '남극탐사대', avatarColor: '#2563EB', magBalance: 3200, joinDate: '2025-03-02' },
  { id: 'user18', email: 'micro_settler@mail.com', password: 'pw18', nickname: '마이크로정착', avatarColor: '#DC2626', magBalance: 600, joinDate: '2025-03-15' },
  { id: 'user19', email: 'galaxy_z@mail.com', password: 'pw19', nickname: 'GalaxyZ', avatarColor: '#7C3AED', magBalance: 14200, joinDate: '2025-01-02' },
  { id: 'user20', email: 'moon_base@mail.com', password: 'pw20', nickname: '문베이스', avatarColor: '#059669', magBalance: 28000, joinDate: '2024-12-01' },
];

// ── 각 유저의 POI별 구매 [poiIdx, cellCount] ──
const USER_PURCHASES: [number, number][][] = [
  [[5, 30], [10, 15]],           // user01: 루나 2호 + 고요의 바다
  [[0, 80], [10, 40]],           // user02: 아폴로 11호 + 고요의 바다
  [[10, 200], [15, 150]],        // user03: 고요의 바다 + 무지개 만
  [[11, 500], [12, 480]],        // user04: 티코 + 코페르니쿠스
  [[5, 20]],                      // user05: 루나 2호
  [[10, 100], [0, 110]],         // user06: 고요의 바다 + 아폴로 11호
  [[18, 75]],                     // user07: 중앙 만
  [[11, 400], [16, 450]],        // user08: 티코 + 클라비우스
  [[5, 50], [2, 45]],            // user09: 루나 2호 + 아폴로 15호
  [[10, 300], [17, 200]],        // user10: 고요의 바다 + 위기의 바다
  [[0, 100], [5, 60]],           // user11: 아폴로 11호 + 루나 2호
  [[5, 30]],                      // user12: 루나 2호
  [[10, 500], [18, 500]],        // user13: 고요의 바다 + 중앙 만
  [[12, 150], [14, 130]],        // user14: 코페르니쿠스 + 아리스타르코스
  [[15, 400], [13, 350]],        // user15: 무지개 만 + 플라톤
  [[10, 65]],                     // user16: 고요의 바다
  [[6, 40]],                      // user17: 찬드라얀 3호
  [[5, 25]],                      // user18: 루나 2호
  [[10, 350], [19, 250]],        // user19: 고요의 바다 + 직선의 벽
  [[0, 200], [10, 220]],         // user20: 아폴로 11호 + 고요의 바다
];

export const DUMMY_USERS: DummyUser[] = DUMMY_PROFILES.map((profile, idx) => {
  const purchases = USER_PURCHASES[idx];
  let allCells: OwnedCell[] = [];

  for (const [poiIdx, count] of purchases) {
    const poi = POIS[poiIdx];
    const cells = generateCellsInPOI(poi, count, (idx + 1) * 137 + poiIdx * 53);
    allCells = allCells.concat(cells);
  }

  return {
    ...profile,
    totalOccupied: allCells.length,
    ownedCells: allCells,
  };
});

// ── 전체 유저 목록 ──
export const ALL_USERS: DummyUser[] = [HERO_USER, ...DUMMY_USERS];

// ── 특정 셀이 누구 소유인지 빠르게 조회 (메모리 캐시) ──
let _ownershipMap: Map<string, { userId: string; nickname: string; avatarColor: string }> | null = null;

export function getOwnershipMap() {
  if (_ownershipMap) return _ownershipMap;
  _ownershipMap = new Map();
  for (const user of ALL_USERS) {
    for (const cell of user.ownedCells) {
      _ownershipMap.set(cell.cellId, {
        userId: user.id,
        nickname: user.nickname,
        avatarColor: user.avatarColor,
      });
    }
  }
  return _ownershipMap;
}

export function getCellOwner(cellId: string) {
  return getOwnershipMap().get(cellId) || null;
}

export function getUserCells(userId: string): OwnedCell[] {
  const user = ALL_USERS.find(u => u.id === userId);
  return user?.ownedCells || [];
}

// ── S2 유틸 re-export (다른 파일에서 사용) ──
export { latLngToS2Token, tokenToLatLng };
