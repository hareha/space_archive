/**
 * SQLite 데이터베이스 서비스
 * 
 * DB 파일 위치: 앱 Documents 디렉토리 내 SQLite/plusultra.db
 * DB Browser for SQLite로 열어서 데이터 확인 가능
 * 
 * 테이블:
 *   users       - 유저 정보
 *   owned_cells - 점유 셀 (users 1:N owned_cells)
 * 
 * TODO: TEMP_AUTH - 나중에 실제 서버 DB로 교체 시 이 파일의 구현만 바꾸면 됩니다.
 */
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_USERS } from '@/constants/dummyUsers';

let db: SQLite.SQLiteDatabase | null = null;

// ── DB 열기 ──
async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('plusultra.db');
  console.log('[DB] Opened: plusultra.db (Documents/SQLite/plusultra.db)');
  return db;
}

// ── DB 초기화 (테이블 생성 + 시드 데이터) ──
// 시드 데이터 버전 — 더미 데이터 변경 시 여기 숫자를 올리면 자동 리셋
const SEED_VERSION = 6; // hero 구매내역 초기화 (AsyncStorage 포함)

export async function initDatabase(): Promise<void> {
  const database = await getDB();

  // 버전 관리 테이블
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS db_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 버전 체크 → 다르면 리셋
  const versionRow = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM db_meta WHERE key = 'seed_version'"
  );
  const currentVersion = versionRow ? parseInt(versionRow.value) : 0;

  if (currentVersion !== SEED_VERSION) {
    console.log(`[DB] Seed version changed (${currentVersion} → ${SEED_VERSION}), resetting...`);
    await database.execAsync('DROP TABLE IF EXISTS owned_cells; DROP TABLE IF EXISTS users;');
    // AsyncStorage의 EllContext 데이터도 같이 초기화
    await AsyncStorage.multiRemove(['@plusultra_territories', '@plusultra_ell_balance']).catch(() => {});
    console.log('[DB] AsyncStorage territories/ell cleared');
  }

  // 테이블 생성
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT NOT NULL,
      avatarColor TEXT DEFAULT '#3B82F6',
      magBalance INTEGER DEFAULT 1000,
      totalOccupied INTEGER DEFAULT 0,
      joinDate TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS owned_cells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      cellId TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      purchasedAt TEXT NOT NULL,
      cost INTEGER DEFAULT 1,
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(userId, cellId)
    );

    CREATE INDEX IF NOT EXISTS idx_cells_userId ON owned_cells(userId);
    CREATE INDEX IF NOT EXISTS idx_cells_cellId ON owned_cells(cellId);
    CREATE INDEX IF NOT EXISTS idx_cells_lat ON owned_cells(lat);
    CREATE INDEX IF NOT EXISTS idx_cells_lng ON owned_cells(lng);
  `);

  // 시드 데이터 삽입 (이미 있으면 스킵)
  const existing = await database.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users');
  if (existing && existing.cnt > 0) {
    console.log(`[DB] Already seeded (${existing.cnt} users)`);
    return;
  }

  console.log('[DB] Seeding dummy data...');

  for (const user of ALL_USERS) {
    await database.runAsync(
      'INSERT OR IGNORE INTO users (id, email, password, nickname, avatarColor, magBalance, totalOccupied, joinDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user.id, user.email, user.password, user.nickname, user.avatarColor, user.magBalance, user.totalOccupied, user.joinDate]
    );

    // 셀 데이터 배치 삽입 (50개씩 묶어서)
    const batchSize = 50;
    for (let i = 0; i < user.ownedCells.length; i += batchSize) {
      const batch = user.ownedCells.slice(i, i + batchSize);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const values = batch.flatMap(c => [user.id, c.cellId, c.lat, c.lng, c.purchasedAt, c.cost]);
      await database.runAsync(
        `INSERT OR IGNORE INTO owned_cells (userId, cellId, lat, lng, purchasedAt, cost) VALUES ${placeholders}`,
        values
      );
    }
  }

  const totalCells = await database.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM owned_cells');
  console.log(`[DB] Seeded ${ALL_USERS.length} users, ${totalCells?.cnt || 0} cells`);

  // 시드 버전 기록
  await database.runAsync(
    "INSERT OR REPLACE INTO db_meta (key, value) VALUES ('seed_version', ?)",
    [SEED_VERSION.toString()]
  );
}

// ── 유저 타입 ──
export interface DBUser {
  id: string;
  email: string;
  password: string;
  nickname: string;
  avatarColor: string;
  magBalance: number;
  totalOccupied: number;
  joinDate: string;
}

export interface DBOwnedCell {
  cellId: string;
  lat: number;
  lng: number;
  purchasedAt: string;
  cost: number;
}

// ── 유저 조회 ──
export async function getUser(id: string): Promise<DBUser | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<DBUser>('SELECT * FROM users WHERE id = ?', [id]);
  console.log(`[DB] getUser(${id}):`, row ? row.nickname : 'null');
  return row || null;
}

export async function getUserByEmail(email: string): Promise<DBUser | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<DBUser>('SELECT * FROM users WHERE email = ?', [email]);
  console.log(`[DB] getUserByEmail(${email}):`, row ? row.nickname : 'null');
  return row || null;
}

export async function getAllUsers(): Promise<DBUser[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<DBUser>('SELECT * FROM users ORDER BY joinDate DESC');
  console.log(`[DB] getAllUsers: ${rows.length} users`);
  return rows;
}

// ── 유저 생성 ──
export async function createUser(data: {
  email: string;
  password: string;
  nickname: string;
}): Promise<DBUser> {
  const database = await getDB();

  // 이메일 중복 체크
  const existing = await database.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM users WHERE email = ?', [data.email]
  );
  if (existing && existing.cnt > 0) {
    throw new Error('이미 사용 중인 이메일입니다.');
  }

  const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
  const newUser: DBUser = {
    id: `user_${Date.now()}`,
    email: data.email,
    password: data.password,
    nickname: data.nickname,
    avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    magBalance: 1000,
    totalOccupied: 0,
    joinDate: new Date().toISOString().split('T')[0],
  };

  await database.runAsync(
    'INSERT INTO users (id, email, password, nickname, avatarColor, magBalance, totalOccupied, joinDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [newUser.id, newUser.email, newUser.password, newUser.nickname, newUser.avatarColor, newUser.magBalance, newUser.totalOccupied, newUser.joinDate]
  );

  console.log(`[DB] createUser: ${newUser.nickname} (${newUser.email})`);
  return newUser;
}

// ── 셀 구매 ──
export async function occupyCell(userId: string, cellId: string, lat: number, lng: number, cost: number = 1): Promise<boolean> {
  const database = await getDB();
  const user = await getUser(userId);
  if (!user) return false;
  if (user.magBalance < cost) return false;

  try {
    await database.runAsync(
      'INSERT INTO owned_cells (userId, cellId, lat, lng, purchasedAt, cost) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, cellId, lat, lng, new Date().toISOString().split('T')[0], cost]
    );

    await database.runAsync(
      'UPDATE users SET magBalance = magBalance - ?, totalOccupied = totalOccupied + 1 WHERE id = ?',
      [cost, userId]
    );

    console.log(`[DB] occupyCell: ${userId} bought ${cellId} for ${cost} Mag`);
    return true;
  } catch (e) {
    console.log(`[DB] occupyCell failed:`, e);
    return false; // 이미 소유 중 등
  }
}

// ── 유저의 셀 목록 조회 ──
export async function getUserOccupiedCells(userId: string): Promise<DBOwnedCell[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<DBOwnedCell>(
    'SELECT cellId, lat, lng, purchasedAt, cost FROM owned_cells WHERE userId = ? ORDER BY purchasedAt DESC',
    [userId]
  );
  console.log(`[DB] getUserOccupiedCells(${userId}): ${rows.length} cells`);
  return rows;
}

// ── 특정 셀의 소유자 조회 ──
export async function getCellOwnerFromDB(cellId: string): Promise<{ userId: string; nickname: string; avatarColor: string } | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<{ userId: string; nickname: string; avatarColor: string }>(
    `SELECT oc.userId, u.nickname, u.avatarColor 
     FROM owned_cells oc 
     JOIN users u ON oc.userId = u.id 
     WHERE oc.cellId = ?`,
    [cellId]
  );
  return row || null;
}

// ── S2 토큰 배치 조회 (CesiumJS → RN → DB) ──
// 화면에 보이는 ~256개 셀의 소유 상태를 한번에 조회
export interface CellOwnerInfo {
  cellId: string;
  userId: string;
  nickname: string;
  avatarColor: string;
}

export async function queryCellOwners(tokens: string[]): Promise<CellOwnerInfo[]> {
  if (tokens.length === 0) return [];
  const database = await getDB();
  
  // SQLite IN 쿼리 (배치 처리)
  const placeholders = tokens.map(() => '?').join(',');
  const rows = await database.getAllAsync<CellOwnerInfo>(
    `SELECT oc.cellId, oc.userId, u.nickname, u.avatarColor
     FROM owned_cells oc
     JOIN users u ON oc.userId = u.id
     WHERE oc.cellId IN (${placeholders})`,
    tokens
  );
  
  console.log(`[DB] queryCellOwners(${tokens.length} tokens): ${rows.length} owned`);
  return rows;
}

// ── 전체 점유 토큰 목록 ──
export async function getAllOccupiedTokens(): Promise<string[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<{ cellId: string }>('SELECT DISTINCT cellId FROM owned_cells');
  console.log(`[DB] getAllOccupiedTokens: ${rows.length} tokens`);
  return rows.map(r => r.cellId);
}

// ── 범위 내 점유 현황 조회 (착륙지: 원형 반경 / 지형: 면적 기반) ──
const MOON_RADIUS_KM = 1737.4;

// 반경(km) → 위경도 델타 (근사)
function radiusToDeg(radiusKm: number, centerLat: number) {
  const latDeg = (radiusKm / MOON_RADIUS_KM) * (180 / Math.PI);
  const lngDeg = latDeg / Math.cos((centerLat * Math.PI) / 180);
  return { latDeg, lngDeg };
}

export interface OccupationInRange {
  occupiedCount: number;
  owners: { userId: string; nickname: string; avatarColor: string; cellCount: number; purchasedAt: string }[];
}

// 원형 범위 내 점유 조회 (착륙지)
export async function getOccupationInCircle(
  centerLat: number,
  centerLng: number,
  radiusKm: number = 5
): Promise<OccupationInRange> {
  const database = await getDB();
  const { latDeg, lngDeg } = radiusToDeg(radiusKm, centerLat);

  // 바운딩 박스로 1차 필터 후 결과 반환
  const rows = await database.getAllAsync<{ userId: string; nickname: string; avatarColor: string; cellCount: number; purchasedAt: string }>(
    `SELECT oc.userId, u.nickname, u.avatarColor, COUNT(oc.id) as cellCount, MAX(oc.purchasedAt) as purchasedAt
     FROM owned_cells oc
     JOIN users u ON oc.userId = u.id
     WHERE oc.lat BETWEEN ? AND ?
       AND oc.lng BETWEEN ? AND ?
     GROUP BY oc.userId
     ORDER BY cellCount DESC`,
    [centerLat - latDeg, centerLat + latDeg, centerLng - lngDeg, centerLng + lngDeg]
  );

  const occupiedCount = await database.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM owned_cells
     WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`,
    [centerLat - latDeg, centerLat + latDeg, centerLng - lngDeg, centerLng + lngDeg]
  );

  console.log(`[DB] getOccupationInCircle(${centerLat}, ${centerLng}, r=${radiusKm}km): ${occupiedCount?.cnt || 0} cells, ${rows.length} owners`);

  return {
    occupiedCount: occupiedCount?.cnt || 0,
    owners: rows,
  };
}

// 타원형/원형 범위 내 점유 조회 (주요 지형)
export async function getOccupationInEllipse(
  centerLat: number,
  centerLng: number,
  diameterKm: number,
  widthKm?: number
): Promise<OccupationInRange> {
  const effectiveWidth = widthKm || diameterKm;
  const semiMajor = diameterKm / 2;
  const semiMinor = effectiveWidth / 2;
  const maxRadius = Math.max(semiMajor, semiMinor);

  return getOccupationInCircle(centerLat, centerLng, maxRadius);
}

// ── DB 리셋 (디버그용) ──
export async function resetDatabase(): Promise<void> {
  const database = await getDB();
  await database.execAsync('DROP TABLE IF EXISTS owned_cells; DROP TABLE IF EXISTS users;');
  console.log('[DB] Tables dropped, re-initializing...');
  await initDatabase();
}
