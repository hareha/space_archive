/**
 * 점유 서비스 (Supabase 연동)
 * 
 * 기존 database.ts의 SQLite 함수들을 Supabase로 교체.
 * 동일 API를 제공하여 호출부 변경 최소화.
 */
import { supabase } from './supabase';

// ── 타입 ──
export interface CellOwnerInfo {
  cellId: string;
  userId: string;
  nickname: string;
  avatarColor: string;
}

export interface OccupationInRange {
  occupiedCount: number;
  owners: {
    userId: string;
    nickname: string;
    avatarColor: string;
    cellCount: number;
    purchasedAt: string;
  }[];
}

// ── 전체 점유 토큰 목록 ──
export async function getAllOccupiedTokens(): Promise<string[]> {
  const { data, error } = await supabase
    .from('owned_cells')
    .select('l16');

  if (error) {
    console.error('[CellService] getAllOccupiedTokens error:', error.message);
    return [];
  }
  return (data || []).map(r => r.l16);
}

// ── 유저의 셀 목록 조회 ──
export async function getUserOccupiedCells(userId: string): Promise<{
  cellId: string;
  lat: number;
  lng: number;
  purchasedAt: string;
  cost: number;
}[]> {
  const { data, error } = await supabase
    .from('owned_cells')
    .select(`
      l16,
      lat,
      lng,
      created_at,
      purchases!inner ( cost )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[CellService] getUserOccupiedCells error:', error.message);
    return [];
  }

  return (data || []).map((r: any) => ({
    cellId: r.l16,
    lat: r.lat,
    lng: r.lng,
    purchasedAt: r.created_at?.split('T')[0] || '',
    cost: r.purchases?.cost || 1,
  }));
}

// ── 특정 셀의 소유자 조회 ──
export async function getCellOwnerFromDB(cellId: string): Promise<{
  userId: string;
  nickname: string;
  avatarColor: string;
} | null> {
  const { data, error } = await supabase
    .from('owned_cells')
    .select(`
      user_id,
      users!inner ( nickname, avatar_color )
    `)
    .eq('l16', cellId)
    .single();

  if (error || !data) return null;

  return {
    userId: (data as any).user_id,
    nickname: (data as any).users?.nickname || '탐험가',
    avatarColor: (data as any).users?.avatar_color || '#3B82F6',
  };
}

// ── S2 토큰 배치 조회 ──
export async function queryCellOwners(tokens: string[]): Promise<CellOwnerInfo[]> {
  if (tokens.length === 0) return [];

  const { data, error } = await supabase
    .from('owned_cells')
    .select(`
      l16,
      user_id,
      users!inner ( nickname, avatar_color )
    `)
    .in('l16', tokens);

  if (error) {
    console.error('[CellService] queryCellOwners error:', error.message);
    return [];
  }

  return (data || []).map((r: any) => ({
    cellId: r.l16,
    userId: r.user_id,
    nickname: r.users?.nickname || '탐험가',
    avatarColor: r.users?.avatar_color || '#3B82F6',
  }));
}

// ── 셀 구매 (Supabase 연동: ELL 차감 + INSERT) ──
export async function occupyCell(
  userId: string,
  cellId: string,
  lat: number,
  lng: number,
  cost: number = 1,
  ellCost: number = 25,
  batchId?: string
): Promise<boolean> {
  try {
    // 0) ELL 잔액 차감 (원자적, 부족하면 false 반환)
    const { data: deducted, error: deductErr } = await supabase.rpc('deduct_ell_balance', {
      uid: userId,
      amount: ellCost,
    });
    if (deductErr || !deducted) {
      console.error('[CellService] ELL deduction failed:', deductErr?.message || 'insufficient balance');
      return false;
    }

    // 1) purchases에 기록
    const { data: purchase, error: purchaseErr } = await supabase
      .from('purchases')
      .insert({
        user_id: userId,
        cell_token: cellId,
        level: 16,
        cell_count: 1,
        parent_l4: cellId.substring(0, 4),
        lat,
        lng,
        cost,
        status: 'completed',
        ...(batchId ? { batch_id: batchId } : {}),
      })
      .select('id')
      .single();

    if (purchaseErr) {
      console.error('[CellService] purchase insert error:', purchaseErr.message);
      return false;
    }

    // 2) owned_cells에 삽입
    const { error: cellErr } = await supabase
      .from('owned_cells')
      .insert({
        l16: cellId,
        user_id: userId,
        purchase_id: purchase.id,
        l12: cellId.substring(0, 12),
        l8: cellId.substring(0, 8),
        l4: cellId.substring(0, 4),
        lat,
        lng,
      });

    if (cellErr) {
      console.error('[CellService] owned_cells insert error:', cellErr.message);
      return false;
    }

    // 3) users.total_occupied 증가
    await supabase.rpc('increment_total_occupied', { uid: userId });

    // 4) activity_logs — 호출측에서 묶음 기록하므로 여기서는 스킵

    console.log(`[CellService] occupyCell: ${userId} → ${cellId}`);
    return true;
  } catch (e) {
    console.error('[CellService] occupyCell error:', e);
    return false;
  }
}

// ── 범위 내 점유 현황 조회 ──
const MOON_RADIUS_KM = 1737.4;

function radiusToDeg(radiusKm: number, centerLat: number) {
  const latDeg = (radiusKm / MOON_RADIUS_KM) * (180 / Math.PI);
  const lngDeg = latDeg / Math.cos((centerLat * Math.PI) / 180);
  return { latDeg, lngDeg };
}

export async function getOccupationInCircle(
  centerLat: number,
  centerLng: number,
  radiusKm: number = 5
): Promise<OccupationInRange> {
  const { latDeg, lngDeg } = radiusToDeg(radiusKm, centerLat);

  const { data, error } = await supabase
    .from('owned_cells')
    .select(`
      user_id,
      created_at,
      users!inner ( nickname, avatar_color )
    `)
    .gte('lat', centerLat - latDeg)
    .lte('lat', centerLat + latDeg)
    .gte('lng', centerLng - lngDeg)
    .lte('lng', centerLng + lngDeg);

  if (error) {
    console.error('[CellService] getOccupationInCircle error:', error.message);
    return { occupiedCount: 0, owners: [] };
  }

  const rows = data || [];
  const occupiedCount = rows.length;

  // 유저별 집계
  const userMap = new Map<string, {
    userId: string;
    nickname: string;
    avatarColor: string;
    cellCount: number;
    purchasedAt: string;
  }>();

  for (const r of rows as any[]) {
    const uid = r.user_id;
    if (userMap.has(uid)) {
      const existing = userMap.get(uid)!;
      existing.cellCount++;
      if (r.created_at > existing.purchasedAt) {
        existing.purchasedAt = r.created_at?.split('T')[0] || '';
      }
    } else {
      userMap.set(uid, {
        userId: uid,
        nickname: r.users?.nickname || '탐험가',
        avatarColor: r.users?.avatar_color || '#3B82F6',
        cellCount: 1,
        purchasedAt: r.created_at?.split('T')[0] || '',
      });
    }
  }

  const owners = Array.from(userMap.values()).sort((a, b) => b.cellCount - a.cellCount);

  return { occupiedCount, owners };
}

export async function getOccupationInEllipse(
  centerLat: number,
  centerLng: number,
  diameterKm: number,
  widthKm?: number
): Promise<OccupationInRange> {
  const effectiveWidth = widthKm || diameterKm;
  const maxRadius = Math.max(diameterKm, effectiveWidth) / 2;
  return getOccupationInCircle(centerLat, centerLng, maxRadius);
}
