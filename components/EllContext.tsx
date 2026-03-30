import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

const ELL_PER_MAG = 25;
const INITIAL_ELL = 500;

const STORAGE_KEY_ELL = '@plusultra_ell_balance';
const STORAGE_KEY_TERRITORIES = '@plusultra_territories';

const EllContext = createContext<EllContextType>({
  ellBalance: INITIAL_ELL,
  purchasedTerritories: [],
  remainingMag: Math.floor(INITIAL_ELL / ELL_PER_MAG),
  totalOccupied: 0,
  totalMagSpent: 0,
  totalArea: 0,
  spendEll: () => false,
  addDemoTerritory: () => {},
});

export function EllProvider({ children }: { children: React.ReactNode }) {
  const [ellBalance, setEllBalance] = useState(INITIAL_ELL);
  const [purchasedTerritories, setPurchasedTerritories] = useState<PurchasedTerritory[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 앱 시작 시 AsyncStorage에서 로드
  useEffect(() => {
    (async () => {
      try {
        const [savedEll, savedTerr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ELL),
          AsyncStorage.getItem(STORAGE_KEY_TERRITORIES),
        ]);
        if (savedEll !== null) setEllBalance(JSON.parse(savedEll));
        if (savedTerr !== null) setPurchasedTerritories(JSON.parse(savedTerr));
      } catch (e) {
        console.warn('[EllContext] AsyncStorage load failed:', e);
      }
      setLoaded(true);
    })();
  }, []);

  // 변경 시 자동 저장
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_ELL, JSON.stringify(ellBalance)).catch(() => {});
  }, [ellBalance, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_TERRITORIES, JSON.stringify(purchasedTerritories)).catch(() => {});
  }, [purchasedTerritories, loaded]);

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

  const spendEll = useCallback((magCost: number, territories: Omit<PurchasedTerritory, 'id' | 'occupiedDate'>[]) => {
    const ellCost = magCost * ELL_PER_MAG;
    if (ellCost > ellBalance) return false;

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
      totalOccupied, totalMagSpent, totalArea, spendEll, addDemoTerritory,
    }}>
      {children}
    </EllContext.Provider>
  );
}

export function useEll() {
  return useContext(EllContext);
}

export { ELL_PER_MAG, INITIAL_ELL };
