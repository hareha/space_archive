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
import { getOccupationInCircle, getOccupationInEllipse, OccupationInRange } from '@/services/database';

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

  // DB에서 점유 데이터 로드
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

  // 정렬된 소유자 리스트
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
          <View style={[st.statCard, { borderColor: occupiedCount > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(107,114,128,0.3)' }]}>
            <Text style={st.statLabel}>개척 완료</Text>
            {loading ? (
              <ActivityIndicator size="small" color="#9CA3AF" style={{ marginTop: 4 }} />
            ) : (
              <Text style={[st.statValue, occupiedCount > 0 && { color: '#EF4444' }]}>
                {occupiedCount.toLocaleString()} <Text style={st.statUnit}>Mag</Text>
              </Text>
            )}
          </View>
          <View style={[st.statCard, { borderColor: 'rgba(107,114,128,0.3)' }]}>
            <Text style={st.statLabel}>개척 가능</Text>
            {loading ? (
              <ActivityIndicator size="small" color="#9CA3AF" style={{ marginTop: 4 }} />
            ) : (
              <Text style={[st.statValue, { color: '#10B981' }]}>
                {availableCount.toLocaleString()} <Text style={st.statUnit}>Mag</Text>
              </Text>
            )}
          </View>
        </View>

        {/* 점유율 바 */}
        {!loading && stats.totalCells > 0 && (
          <View style={st.progressSection}>
            <View style={st.progressBar}>
              <View style={[st.progressFill, { width: `${Math.min(100, (occupiedCount / stats.totalCells) * 100)}%` }]} />
            </View>
            <Text style={st.progressText}>
              {((occupiedCount / stats.totalCells) * 100).toFixed(1)}% 개척됨
            </Text>
          </View>
        )}

        {/* ③ 점유 구역 리스트 */}
        <View style={st.listSection}>
          <View style={st.listHeader}>
            <Text style={st.listTitle}>개척 현황 목록 ({sortedOwners.length}명)</Text>
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

          {/* 소유자 리스트 */}
          {loading ? (
            <View style={st.emptyList}>
              <ActivityIndicator size="large" color="#374151" />
              <Text style={st.emptyListText}>데이터 로딩 중...</Text>
            </View>
          ) : sortedOwners.length === 0 ? (
            <View style={st.emptyList}>
              <Ionicons name="people-outline" size={32} color="#374151" />
              <Text style={st.emptyListText}>아직 개척된 구역이 없습니다</Text>
            </View>
          ) : (
            <View style={{ gap: 2 }}>
              {sortedOwners.map((owner, idx) => (
                <View key={owner.userId} style={st.ownerRow}>
                  <View style={st.ownerRank}>
                    <Text style={st.ownerRankText}>{idx + 1}</Text>
                  </View>
                  <View style={[st.ownerAvatar, { backgroundColor: owner.avatarColor }]}>
                    <Text style={st.ownerAvatarText}>
                      {owner.nickname.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={st.ownerInfo}>
                    <Text style={st.ownerName}>{owner.nickname}</Text>
                    <Text style={st.ownerDate}>{owner.purchasedAt}</Text>
                  </View>
                  <View style={st.ownerCells}>
                    <Text style={st.ownerCellCount}>{owner.cellCount}</Text>
                    <Text style={st.ownerCellUnit}>Mag</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ④ 점유 지형 확인 → 점유모드 전환 */}
        <View style={{ paddingHorizontal: 20 }}>
          <TouchableOpacity style={st.ctaBtn} activeOpacity={0.7} onPress={onGoToOccupation}>
            <Text style={st.ctaText}>개척 현황 확인  →</Text>
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
    marginBottom: 8,
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

  /* 점유율 바 */
  progressSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#1F2937',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 3,
  },
  progressText: {
    color: '#6B7280',
    fontSize: 11,
    textAlign: 'right',
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

  /* 소유자 행 */
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  ownerRank: {
    width: 22,
    alignItems: 'center',
  },
  ownerRankText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  ownerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
  },
  ownerDate: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  ownerCells: {
    alignItems: 'flex-end',
  },
  ownerCellCount: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '800',
  },
  ownerCellUnit: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 1,
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
