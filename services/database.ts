/**
 * 임시 데이터베이스 서비스 — AsyncStorage 기반
 * 
 * TODO: TEMP_AUTH - 실제 연동 시 이 파일의 구현을 Firebase/Supabase 등으로 교체
 * 인터페이스(함수 시그니처)는 유지하고 내부 구현만 바꾸면 됩니다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_USERS, HERO_USER, DummyUser, OwnedCell } from '@/constants/dummyUsers';

const DB_KEY = '@plusultra_db';
const DB_INITIALIZED_KEY = '@plusultra_db_initialized';

export interface DBUser {
  id: string;
  email: string;
  password: string;
  nickname: string;
  avatarColor: string;
  magBalance: number;
  totalOccupied: number;
  joinDate: string;
  ownedCells: OwnedCell[];
}

// ── DB 초기화 (최초 1회) ──
export async function initDatabase(): Promise<void> {
  try {
    const initialized = await AsyncStorage.getItem(DB_INITIALIZED_KEY);
    if (initialized) return;

    const db: Record<string, DBUser> = {};
    for (const user of ALL_USERS) {
      db[user.id] = { ...user };
    }

    await AsyncStorage.setItem(DB_KEY, JSON.stringify(db));
    await AsyncStorage.setItem(DB_INITIALIZED_KEY, 'true');
    console.log(`[DB] Initialized with ${ALL_USERS.length} users`);
  } catch (e) {
    console.error('[DB] Init failed:', e);
  }
}

// ── DB 읽기 헬퍼 ──
async function readDB(): Promise<Record<string, DBUser>> {
  try {
    const raw = await AsyncStorage.getItem(DB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeDB(db: Record<string, DBUser>): Promise<void> {
  await AsyncStorage.setItem(DB_KEY, JSON.stringify(db));
}

// ── 유저 조회 ──
export async function getUser(id: string): Promise<DBUser | null> {
  const db = await readDB();
  return db[id] || null;
}

export async function getUserByEmail(email: string): Promise<DBUser | null> {
  const db = await readDB();
  return Object.values(db).find(u => u.email === email) || null;
}

export async function getAllUsers(): Promise<DBUser[]> {
  const db = await readDB();
  return Object.values(db);
}

// ── 유저 생성 ──
export async function createUser(data: {
  email: string;
  password: string;
  nickname: string;
}): Promise<DBUser> {
  const db = await readDB();

  // 이메일 중복 체크
  if (Object.values(db).some(u => u.email === data.email)) {
    throw new Error('이미 사용 중인 이메일입니다.');
  }

  const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
  const newUser: DBUser = {
    id: `user_${Date.now()}`,
    email: data.email,
    password: data.password,
    nickname: data.nickname,
    avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    magBalance: 1000, // 신규 가입 보너스
    totalOccupied: 0,
    joinDate: new Date().toISOString().split('T')[0],
    ownedCells: [],
  };

  db[newUser.id] = newUser;
  await writeDB(db);
  return newUser;
}

// ── 셀 구매 ──
export async function occupyCell(userId: string, cellId: string, lat: number, lng: number, cost: number = 1): Promise<boolean> {
  const db = await readDB();
  const user = db[userId];
  if (!user) return false;
  if (user.magBalance < cost) return false;

  // 이미 소유 중인지 체크
  if (user.ownedCells.some(c => c.cellId === cellId)) return false;

  user.ownedCells.push({
    cellId,
    lat,
    lng,
    purchasedAt: new Date().toISOString().split('T')[0],
    cost,
  });
  user.magBalance -= cost;
  user.totalOccupied = user.ownedCells.length;

  db[userId] = user;
  await writeDB(db);
  return true;
}

// ── 유저의 셀 목록 조회 ──
export async function getUserOccupiedCells(userId: string): Promise<OwnedCell[]> {
  const user = await getUser(userId);
  return user?.ownedCells || [];
}

// ── DB 리셋 (디버그용) ──
export async function resetDatabase(): Promise<void> {
  await AsyncStorage.removeItem(DB_KEY);
  await AsyncStorage.removeItem(DB_INITIALIZED_KEY);
  await initDatabase();
}
