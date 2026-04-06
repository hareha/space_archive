import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/services/supabase';

// ═══ 타입 ═══
export interface PurchasedTerritory {
  id: string;
  token: string;
  level: number;
  lat: number;
  lng: number;
  area: string;
  magCost: number;
  occupiedDate: string;
}

interface EllContextType {
  ellBalance: number;
  purchasedTerritories: PurchasedTerritory[];
  remainingMag: number;
  totalOccupied: number;
  totalMagSpent: number;
  totalArea: number;
  spendEll: (magCost: number, territories: Omit<PurchasedTerritory, 'id' | 'occupiedDate'>[]) => boolean;
  addDemoTerritory: (token: string, lat: number, lng: number) => void;
  refreshBalance: () => Promise<void>;
}

const ELL_PER_MAG = 25;
const INITIAL_ELL = 500;

const EllContext = createContext<EllContextType>({
  ellBalance: INITIAL_ELL,
  purchasedTerritories: [],
  remainingMag: Math.floor(INITIAL_ELL / ELL_PER_MAG),
  totalOccupied: 0,
  totalMagSpent: 0,
  totalArea: 0,
  spendEll: () => false,
  addDemoTerritory: () => {},
  refreshBalance: async () => {},
});

export function EllProvider({ children }: { children: React.ReactNode }) {
  const [ellBalance, setEllBalance] = useState(INITIAL_ELL);
  const [purchasedTerritories, setPurchasedTerritories] = useState<PurchasedTerritory[]>([]);
  const [loaded, setLoaded] = useState(false);

  // ── DB에서 잔액 및 구매 내역 로드 ──
  const refreshBalance = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const userId = session.user.id;

      // users 테이블에서 ell_balance 가져오기
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('ell_balance, total_occupied')
        .eq('id', userId)
        .single();

      if (!userError && userData) {
        setEllBalance(userData.ell_balance ?? INITIAL_ELL);
      }

      // owned_cells에서 구매 내역 가져오기
      const { data: cellData, error: cellError } = await supabase
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

      if (!cellError && cellData) {
        const territories: PurchasedTerritory[] = (cellData as any[]).map((r, i) => ({
          id: `DB_${r.l16}`,
          token: r.l16,
          level: 16,
          lat: r.lat,
          lng: r.lng,
          area: '0.8',
          magCost: r.purchases?.cost || 1,
          occupiedDate: r.created_at?.split('T')[0] || '',
        }));
        setPurchasedTerritories(territories);
      }
    } catch (e) {
      console.warn('[EllContext] DB load failed:', e);
    }
  }, []);

  // 앱 시작 시 DB에서 로드
  useEffect(() => {
    (async () => {
      await refreshBalance();
      setLoaded(true);
    })();
  }, []);

  // Auth 상태 변화 시 잔액 새로고침
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN') {
          await refreshBalance();
        } else if (event === 'SIGNED_OUT') {
          setEllBalance(INITIAL_ELL);
          setPurchasedTerritories([]);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [refreshBalance]);

  const remainingMag = useMemo(() => Math.floor(ellBalance / ELL_PER_MAG), [ellBalance]);
  const totalOccupied = purchasedTerritories.length;
  const totalMagSpent = useMemo(
    () => purchasedTerritories.reduce((s, t) => s + t.magCost, 0),
    [purchasedTerritories]
  );
  const totalArea = useMemo(
    () => purchasedTerritories.reduce((s, t) => { const v = parseFloat(t.area || '0'); return s + (isNaN(v) || v === 0 ? 40 : v); }, 0),
    [purchasedTerritories]
  );

  // ── ELL 차감 (로컬 즉시 반영 — DB 차감은 CellService.occupyCell에서 수행) ──
  const spendEll = useCallback((magCost: number, territories: Omit<PurchasedTerritory, 'id' | 'occupiedDate'>[]) => {
    const ellCost = magCost * ELL_PER_MAG;
    if (ellCost > ellBalance) return false;

    // 로컬 즉시 반영 (옵티미스틱 업데이트)
    setEllBalance(prev => prev - ellCost);
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    const newTerritories: PurchasedTerritory[] = territories.map((t, i) => ({
      ...t,
      id: `P${Date.now()}_${i}`,
      occupiedDate: dateStr,
    }));
    setPurchasedTerritories(prev => [...prev, ...newTerritories]);
    return true;
  }, [ellBalance]);

  // WebView에서 실제 S2 L16 토큰을 받아 데모 구매 데이터 자동 추가 (1회만)
  const addDemoTerritory = useCallback((token: string, lat: number, lng: number) => {
    setPurchasedTerritories(prev => {
      if (prev.some(t => t.token === token)) return prev;
      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
      return [...prev, {
        id: `DEMO_${Date.now()}`,
        token,
        level: 16,
        lat,
        lng,
        area: '0.8',
        magCost: 1,
        occupiedDate: dateStr,
      }];
    });
    setEllBalance(prev => Math.max(0, prev - ELL_PER_MAG));
  }, []);

  return (
    <EllContext.Provider value={{
      ellBalance, purchasedTerritories, remainingMag,
      totalOccupied, totalMagSpent, totalArea, spendEll, addDemoTerritory, refreshBalance,
    }}>
      {children}
    </EllContext.Provider>
  );
}

export function useEll() {
  return useContext(EllContext);
}

export { ELL_PER_MAG, INITIAL_ELL };
