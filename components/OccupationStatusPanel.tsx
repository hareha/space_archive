import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getOccupationStats } from '@/constants/s2CellUtils';

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

  const stats = useMemo(() => {
    return getOccupationStats({
      radiusKm: target.radiusKm,
      diameterKm: target.diameterKm,
      widthKm: target.widthKm,
    });
  }, [target]);

  const SORT_LABELS: Record<SortOption, string> = {
    recent: '최신 점유순',
    amount: '보유량 순',
    mine: '내 구역',
  };

  // 그리드 크기 (빈 상태)
  const GRID_COLS = 10;
  const GRID_ROWS = 6;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }}>
      {/* 헤더: 뒤로가기 + 지형명 */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>{target.name}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ② 통계 카드 3개 */}
        <View style={st.statsRow}>
          <View style={st.statCard}>
            <Text style={st.statLabel}>총 구역</Text>
            <Text style={st.statValue}>{stats.totalCells.toLocaleString()} <Text style={st.statUnit}>Mag</Text></Text>
          </View>
          <View style={[st.statCard, { borderColor: 'rgba(107,114,128,0.3)' }]}>
            <Text style={st.statLabel}>점유 중</Text>
            <Text style={st.statValue}>0 <Text style={st.statUnit}>Mag</Text></Text>
          </View>
          <View style={[st.statCard, { borderColor: 'rgba(107,114,128,0.3)' }]}>
            <Text style={st.statLabel}>점유 가능</Text>
            <Text style={st.statValue}>0 <Text style={st.statUnit}>Mag</Text></Text>
          </View>
        </View>


        {/* ③ 점유 구역 리스트 */}
        <View style={st.listSection}>
          <View style={st.listHeader}>
            <Text style={st.listTitle}>점유 구역 리스트</Text>
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
                  <Text style={[st.sortMenuText, sortBy === key && st.sortMenuTextActive]}>
                    {SORT_LABELS[key]} {sortBy === key ? '✓' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 빈 상태 */}
          <View style={st.emptyList}>
            <Ionicons name="people-outline" size={32} color="#374151" />
            <Text style={st.emptyListText}>아직 점유된 구역이 없습니다</Text>
          </View>
        </View>

        {/* ④ 점유 지형 확인 → 점유모드 전환 */}
        <View style={{ paddingHorizontal: 20 }}>
          <TouchableOpacity style={st.ctaBtn} activeOpacity={0.7} onPress={onGoToOccupation}>
            <Text style={st.ctaText}>점유 지형 확인  →</Text>
          </TouchableOpacity>
        </View>
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
    gap: 6,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
  },

  /* ② 통계 카드 */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '800',
  },
  statUnit: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },

  /* 셀 그리드 */
  gridSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  gridContainer: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    gap: 2,
    marginBottom: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
  },
  gridCell: {
    width: 24,
    height: 24,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },

  /* 범례 */
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    color: '#6B7280',
    fontSize: 11,
  },

  /* ③ 점유 구역 리스트 */
  listSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 16,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listTitle: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '700',
  },
  sortBtn: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sortBtnText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  sortMenu: {
    position: 'absolute',
    right: 0,
    top: 40,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 10,
    overflow: 'hidden',
    minWidth: 120,
  },
  sortMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sortMenuItemActive: {
    backgroundColor: 'rgba(96,165,250,0.1)',
  },
  sortMenuText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  sortMenuTextActive: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyListText: {
    color: '#4B5563',
    fontSize: 13,
  },

  /* ④ CTA */
  ctaBtn: {
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '700',
  },
});
