import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getOccupationStats } from '@/constants/s2CellUtils';
import { getOccupationInCircle, getOccupationInEllipse, OccupationInRange } from '@/services/CellService';

interface OccupationStatusPanelProps {
  onBack: () => void;
  onGoToOccupation: () => void;
  target: {
    name: string;
    lat: number;
    lng: number;
    radiusKm?: number;
    diameterKm?: number;
    widthKm?: number;
    angle?: number;
  };
}

type SortOption = 'recent' | 'amount' | 'mine';

export default function OccupationStatusPanel({
  onBack,
  onGoToOccupation,
  target,
}: OccupationStatusPanelProps) {
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [dbData, setDbData] = useState<OccupationInRange | null>(null);
  const [loading, setLoading] = useState(true);

  const stats = useMemo(() => {
    return getOccupationStats({
      radiusKm: target.radiusKm,
      diameterKm: target.diameterKm,
      widthKm: target.widthKm,
    });
  }, [target]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        let result: OccupationInRange;
        if (target.radiusKm) {
          result = await getOccupationInCircle(target.lat, target.lng, target.radiusKm);
        } else if (target.diameterKm) {
          result = await getOccupationInEllipse(target.lat, target.lng, target.diameterKm, target.widthKm);
        } else {
          result = await getOccupationInCircle(target.lat, target.lng, 5);
        }
        setDbData(result);
      } catch (e) {
        console.error('[OccupationPanel] Failed to load data:', e);
      }
      setLoading(false);
    };
    loadData();
  }, [target.lat, target.lng, target.name]);

  const occupiedCount = dbData?.occupiedCount || 0;
  const availableCount = Math.max(0, stats.totalCells - occupiedCount);
  const occupiedPct = stats.totalCells > 0 ? (occupiedCount / stats.totalCells) * 100 : 0;

  const sortedOwners = useMemo(() => {
    if (!dbData?.owners) return [];
    const owners = [...dbData.owners];
    if (sortBy === 'recent') {
      owners.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
    } else if (sortBy === 'amount') {
      owners.sort((a, b) => b.cellCount - a.cellCount);
    }
    return owners;
  }, [dbData, sortBy]);

  const SORT_LABELS: Record<SortOption, string> = {
    recent: '최신 개척순',
    amount: '보유량 순',
    mine: '내 구역',
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#15171C' }}>
      {/* 헤더: X + 지형명 */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.closeBtn}>
          <Ionicons name="close" size={24} color="#EBECF1" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>{target.name}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}>
        {/* Claim Status 섹션 제목 */}
        <Text style={st.sectionTitle}>개척 현황</Text>

        {/* 3개 세로 통계 카드 */}
        <View style={st.statCard}>
          <Text style={st.statLabel}>총 구역</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#999" style={{ marginTop: 8 }} />
          ) : (
            <View style={st.statValueRow}>
              <Text style={st.statValueLarge}>{stats.totalCells.toLocaleString()}</Text>
              <Text style={st.statUnitText}> Mag</Text>
            </View>
          )}
        </View>

        <View style={st.statCard}>
          <Text style={st.statLabel}>개척 완료</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#999" style={{ marginTop: 8 }} />
          ) : (
            <View style={st.statValueRow}>
              <Text style={st.statValueLarge}>{occupiedCount.toLocaleString()}</Text>
              <Text style={st.statUnitText}> Mag</Text>
            </View>
          )}
        </View>

        <View style={[st.statCard, { marginBottom: 16 }]}>
          <Text style={st.statLabel}>개척 가능</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#999" style={{ marginTop: 8 }} />
          ) : (
            <View style={st.statValueRow}>
              <Text style={st.statValueLarge}>{availableCount.toLocaleString()}</Text>
              <Text style={st.statUnitText}> Mag</Text>
            </View>
          )}
        </View>

        {/* 점유율 퍼센트 + 바 */}
        {!loading && stats.totalCells > 0 && (
          <View style={st.progressSection}>
            <Text style={st.progressPctText}>{occupiedPct.toFixed(1)}%</Text>
            <View style={st.progressBar}>
              <View style={[st.progressFillBlue, { flex: Math.max(0.01, occupiedPct / 100) }]} />
              <View style={[st.progressFillDark, { flex: Math.max(0.01, 1 - occupiedPct / 100) }]} />
            </View>
          </View>
        )}

        {/* 구분선 */}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 16 }} />

        {/* Claimed Sectors */}
        <View style={st.listSection}>
          <View style={st.listHeader}>
            <Text style={st.listTitle}>개척 현황 목록</Text>
            <TouchableOpacity
              style={st.sortBtn}
              onPress={() => setShowSortMenu(!showSortMenu)}
              activeOpacity={0.7}
            >
              <Text style={st.sortBtnText}>{SORT_LABELS[sortBy]} ▾</Text>
            </TouchableOpacity>
          </View>

          {/* 정렬 드롭다운 */}
          {showSortMenu && (
            <View style={st.sortMenu}>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[st.sortMenuItem, sortBy === key && st.sortMenuItemActive]}
                  onPress={() => { setSortBy(key); setShowSortMenu(false); }}
                >
                  {sortBy === key && (
                    <Ionicons name="checkmark" size={18} color="#1A1A1A" />
                  )}
                  <Text style={[st.sortMenuText, sortBy === key && st.sortMenuTextActive]}>
                    {SORT_LABELS[key]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 소유자 리스트 */}
          {loading ? (
            <View style={st.emptyList}>
              <ActivityIndicator size="large" color="#999999" />
              <Text style={st.emptyListText}>데이터 로딩 중...</Text>
            </View>
          ) : sortedOwners.length === 0 ? (
            <View style={st.emptyList}>
              <Ionicons name="people-outline" size={32} color="#666666" />
              <Text style={st.emptyListText}>아직 개척된 구역이 없습니다</Text>
            </View>
          ) : (
            <View>
              {sortedOwners.map((owner, idx) => (
                <View key={owner.userId} style={st.ownerRow}>
                  <View style={st.ownerInfo}>
                    <Text style={st.ownerName}>{owner.nickname}</Text>
                    <Text style={st.ownerSub}>Holdings</Text>
                    <Text style={st.ownerDetail}>{owner.cellCount.toLocaleString()} Mag · Total Area 0.5 km²</Text>
                  </View>
                  {idx === 0 && (
                    <View style={st.mySectorBadge}>
                      <Text style={st.mySectorText}>내 구역</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 하단 CTA 버튼 */}
        <TouchableOpacity style={st.ctaBtn} activeOpacity={0.7} onPress={onGoToOccupation}>
          <Text style={st.ctaText}>지형 확인</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#EBECF1',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },

  /* Claim Status 제목 */
  sectionTitle: {
    color: '#7295FE',
    fontSize: 14,
    fontWeight: '400',
    marginTop: 16,
    marginBottom: 12,
  },

  /* 세로 통계 카드 (Figma 스타일) */
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statLabel: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValueLarge: {
    color: '#EBECF1',
    fontSize: 28,
    fontWeight: '600',
  },
  statUnitText: {
    color: '#999999',
    fontSize: 14,
    fontWeight: '400',
  },

  /* 점유율 바 */
  progressSection: {
    marginBottom: 0,
  },
  progressPctText: {
    color: '#EBECF1',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  progressBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFillBlue: {
    backgroundColor: '#3C57E9',
    borderRadius: 4,
  },
  progressFillDark: {
    backgroundColor: '#1F2937',
  },

  /* 리스트 */
  listSection: {
    marginBottom: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  listTitle: {
    color: '#7295FE',
    fontSize: 14,
    fontWeight: '400',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortBtnText: {
    color: '#999999',
    fontSize: 12,
  },
  sortMenu: {
    position: 'absolute',
    right: 0,
    top: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    zIndex: 10,
    overflow: 'hidden',
    minWidth: 160,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  sortMenuItemActive: {
  },
  sortMenuText: {
    color: '#999999',
    fontSize: 16,
    fontWeight: '400',
  },
  sortMenuTextActive: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyListText: {
    color: '#999999',
    fontSize: 14,
  },

  /* 소유자 행 */
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 14,
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    color: '#EBECF1',
    fontSize: 16,
    fontWeight: '600',
  },
  ownerSub: {
    color: '#999999',
    fontSize: 12,
    marginTop: 2,
  },
  ownerDetail: {
    color: '#666666',
    fontSize: 12,
    marginTop: 2,
  },
  mySectorBadge: {
    borderWidth: 1,
    borderColor: '#3C57E9',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mySectorText: {
    color: '#3C57E9',
    fontSize: 12,
    fontWeight: '500',
  },

  /* CTA */
  ctaBtn: {
    backgroundColor: '#3C57E9',
    borderRadius: 5,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
