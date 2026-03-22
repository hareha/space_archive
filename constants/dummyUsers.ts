/**
 * 더미 유저 데이터 — 주인공 1명 + 더미 20명
 * S2 Level 16 셀 구매 정보 포함
 * 
 * 셀 ID 형식: L16_{lat.toFixed(4)}_{lng.toFixed(4)}
 * (s2CellUtils.ts와 동일한 포맷)
 */

export interface OwnedCell {
  cellId: string;       // L16_lat_lng
  lat: number;
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

// ── S2 Level 16 셀 클러스터 생성 ──
function generateCellCluster(
  centerLat: number,
  centerLng: number,
  count: number,
  seed: number
): OwnedCell[] {
  const rand = seededRandom(seed);
  const cells: OwnedCell[] = [];
  const cellSize = 0.0029; // ~Level 16 셀 크기 (약 0.003도)

  // 클러스터 반경 (셀 수에 비례)
  const radius = Math.ceil(Math.sqrt(count)) + 2;
  const used = new Set<string>();

  // 몇 개의 서브 클러스터로 나눔
  const numClusters = Math.max(1, Math.floor(count / 50));
  const clusterCenters: { lat: number; lng: number }[] = [];

  for (let c = 0; c < numClusters; c++) {
    clusterCenters.push({
      lat: centerLat + (rand() - 0.5) * radius * cellSize * 2,
      lng: centerLng + (rand() - 0.5) * radius * cellSize * 2,
    });
  }

  // 각 서브 클러스터 주변에 셀 배치
  let attempts = 0;
  while (cells.length < count && attempts < count * 10) {
    attempts++;
    const cc = clusterCenters[Math.floor(rand() * clusterCenters.length)];
    const spreadLat = (rand() - 0.5) * radius * cellSize * 0.6;
    const spreadLng = (rand() - 0.5) * radius * cellSize * 0.6;
    const lat = Number((cc.lat + spreadLat).toFixed(4));
    const lng = Number((cc.lng + spreadLng).toFixed(4));
    const cellId = `L16_${lat.toFixed(4)}_${lng.toFixed(4)}`;

    if (used.has(cellId)) continue;
    used.add(cellId);

    // 구매 날짜 (최근 90일 내)
    const daysAgo = Math.floor(rand() * 90);
    const date = new Date(Date.now() - daysAgo * 86400000);

    cells.push({
      cellId,
      lat,
      lng,
      purchasedAt: date.toISOString().split('T')[0],
      cost: 1,
    });
  }

  return cells;
}

// ── 달 표면 주요 관심 지역 (셀 클러스터 중심) ──
const CLUSTER_CENTERS = [
  { lat: 0.6744, lng: 23.4730 },    // 고요의 바다 (아폴로 11)
  { lat: -3.0128, lng: -23.4219 },  // 폭풍의 대양
  { lat: 26.1322, lng: 3.6339 },    // 비의 바다
  { lat: -8.9734, lng: 15.5011 },   // 풍요의 바다
  { lat: 20.0, lng: 31.0 },         // 맑음의 바다
  { lat: -43.0, lng: -11.0 },       // 티코 분화구
  { lat: -9.0, lng: -21.0 },        // 코페르니쿠스 분화구 근처
  { lat: 44.0, lng: -10.0 },        // 플라톤 분화구 근처
  { lat: -70.0, lng: 0.0 },         // 남극 근처 (탐사 목표)
  { lat: 80.0, lng: 30.0 },         // 북극 근처
  { lat: 5.0, lng: -63.0 },         // 아리스타르코스 고원
  { lat: -5.0, lng: 150.0 },        // 달 뒷면
  { lat: 30.0, lng: -35.0 },        // 무지개만
  { lat: -20.0, lng: 50.0 },        // 이슬의 바다 근처
  { lat: 15.0, lng: -30.0 },        // 에라토스테네스 근처
  { lat: -55.0, lng: 10.0 },        // 클라비우스 분화구
  { lat: 10.0, lng: 80.0 },         // 위기의 바다
  { lat: -30.0, lng: -45.0 },       // 습지의 바다
  { lat: 40.0, lng: 50.0 },         // 차가움의 바다
  { lat: -15.0, lng: -70.0 },       // 습기의 바다
];

// ── 주인공 유저 ──
const HERO_CELLS = generateCellCluster(0.6744, 23.4730, 400, 42);

export const HERO_USER: DummyUser = {
  id: 'hero',
  email: 'explorer@plusultra.io',
  password: 'password123',
  nickname: '루나탐험가',
  avatarColor: '#3B82F6',
  magBalance: 12500,
  totalOccupied: 400,
  joinDate: '2025-01-15',
  ownedCells: HERO_CELLS,
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

// 셀 개수 분포: 20~1000 (유저별 다양하게)
const CELL_COUNTS = [
  45, 120, 350, 980, 20, 210, 75, 850, 95, 500,
  160, 30, 1000, 280, 750, 65, 40, 25, 600, 420,
];

export const DUMMY_USERS: DummyUser[] = DUMMY_PROFILES.map((profile, idx) => {
  const cellCount = CELL_COUNTS[idx];
  const center = CLUSTER_CENTERS[idx % CLUSTER_CENTERS.length];
  const cells = generateCellCluster(center.lat, center.lng, cellCount, (idx + 1) * 137);

  return {
    ...profile,
    totalOccupied: cells.length,
    ownedCells: cells,
  };
});

// ── 전체 유저 목록 ──
export const ALL_USERS: DummyUser[] = [HERO_USER, ...DUMMY_USERS];

// ── 특정 셀이 누구 소유인지 빠르게 조회하기 위한 맵 ──
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

// ── 셀 소유자 조회 ──
export function getCellOwner(cellId: string) {
  return getOwnershipMap().get(cellId) || null;
}

// ── 특정 유저의 셀 목록 ──
export function getUserCells(userId: string): OwnedCell[] {
  const user = ALL_USERS.find(u => u.id === userId);
  return user?.ownedCells || [];
}
