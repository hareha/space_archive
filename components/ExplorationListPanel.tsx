import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, Animated, PanResponder, Switch,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LANDING_SITES, LandingSite, sortByYear, sortByCountry, getContactColor, COUNTRY_NAMES } from '@/constants/LandingSiteData';
import { LUNAR_FEATURES, LunarFeature, sortByType, sortBySize, getFeatureTypeColor, getFeatureTypeEmoji, formatArea, isFarSide } from '@/constants/LunarFeatureData';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

// snap points: top값 기준 (딱 2개만) — SAT_PANEL과 동일한 방식
export const PANEL_SCREEN_H = SCREEN_H;
export const SNAP_MIN = SCREEN_H * 0.70;  // 최소: top=80% (높이 20%)
export const SNAP_MAX = SCREEN_H * 0.40;  // 최대: top=40% (높이 60%)

type ActiveCategory = 'satellite' | 'landing' | 'terrain' | null;

interface ExplorationListPanelProps {
  visible: boolean;
  onClose: () => void;
  // 토글 상태
  showSatellites: boolean;
  showLandingSites: boolean;
  showTerrain: boolean;
  onToggleSatellites: (val: boolean) => void;
  onToggleLandingSites: (val: boolean) => void;
  onToggleTerrain: (val: boolean) => void;
  // 데이터
  satelliteData: any[];
  isLoadingSatellite: boolean;
  // 선택 콜백
  onSelectSatellite: (sat: any) => void;
  onSelectLandingSite: (site: LandingSite) => void;
  onSelectFeature: (feat: LunarFeature) => void;
}

export default function ExplorationListPanel({
  visible,
  onClose,
  showSatellites, showLandingSites, showTerrain,
  onToggleSatellites, onToggleLandingSites, onToggleTerrain,
  satelliteData, isLoadingSatellite,
  onSelectSatellite, onSelectLandingSite, onSelectFeature,
}: ExplorationListPanelProps) {
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>(null);
  const [landingSortMode, setLandingSortMode] = useState<'year' | 'country'>('year');
  const [featureSortMode, setFeatureSortMode] = useState<'type' | 'size'>('type');

  // 패널 애니메이션 (top값: 초기=화면 밖)
  const panelHeight = useRef(new Animated.Value(SCREEN_H)).current;
  const currentHeight = useRef(SCREEN_H);

  React.useEffect(() => {
    if (visible) {
      // top값: 작을수록 패널이 큼 (SNAP_MAX < SNAP_MIN)
      const targetTop = activeCategory ? SNAP_MAX : SNAP_MIN;
      Animated.spring(panelHeight, {
        toValue: targetTop,
        useNativeDriver: false,
        tension: 100,
        friction: 15,
      }).start();
      currentHeight.current = targetTop;
    } else {
      Animated.timing(panelHeight, {
        toValue: SCREEN_H, // 화면 밖으로 (top = 화면높이)
        duration: 250,
        useNativeDriver: false,
      }).start();
      currentHeight.current = SCREEN_H;
    }
  }, [visible]);

  // snap 함수
  const snapTo = useCallback((target: number) => {
    currentHeight.current = target;
    Animated.spring(panelHeight, {
      toValue: target,
      useNativeDriver: false,
      tension: 100,
      friction: 15,
    }).start();
  }, [panelHeight]);

  const snapToRef = useRef(snapTo);
  snapToRef.current = snapTo;

  // 드래그 핸들러
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        // 진행 중인 spring 애니메이션 멈추고 현재 위치 캡처
        panelHeight.stopAnimation((val) => {
          currentHeight.current = val;
        });
      },
      onPanResponderMove: (_, g) => {
        const newTop = Math.max(SNAP_MAX, Math.min(SNAP_MIN, currentHeight.current + g.dy));
        panelHeight.setValue(newTop);
      },
      onPanResponderRelease: (_, g) => {
        const raw = currentHeight.current + g.dy;
        const mid = (SNAP_MIN + SNAP_MAX) / 2;
        snapToRef.current(raw < mid ? SNAP_MAX : SNAP_MIN);
      },
    })
  ).current;

  // 카테고리 탭 클릭
  const handleCategoryTap = (cat: ActiveCategory) => {
    if (activeCategory === cat) {
      setActiveCategory(null);
      snapTo(SNAP_MIN); // 최소로 (top 큰값)
    } else {
      setActiveCategory(cat);
      snapTo(SNAP_MAX); // 최대로 (top 작은값)
    }
  };

  // 정렬된 데이터
  const sortedLandingSites = landingSortMode === 'year' ? sortByYear(LANDING_SITES) : sortByCountry(LANDING_SITES);
  const sortedFeatures = featureSortMode === 'type' ? sortByType(LUNAR_FEATURES) : sortBySize(LUNAR_FEATURES);

  if (!visible && currentHeight.current >= SCREEN_H) return null;

  return (
    <Animated.View style={[styles.container, { top: panelHeight }]}>
      {/* 드래그 가능 영역: 핸들 바 + 헤더 전체 */}
      <View {...panResponder.panHandlers}>
        {/* 드래그 핸들 바 */}
        <View style={styles.handleArea}>
          <View style={styles.handleBar} />
        </View>

        {/* 헤더: 탐사 목록 + 닫기 */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>탐사 목록</Text>
          <TouchableOpacity onPress={() => { setActiveCategory(null); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 카테고리 카드 (토글+탭 통합) */}
      <View style={styles.categoryRow}>
        {/* 궤도 위성 */}
        <TouchableOpacity
          style={[styles.categoryCard, activeCategory === 'satellite' && styles.categoryCardActive,
          { borderColor: showSatellites ? '#FCD34D40' : 'rgba(255,255,255,0.08)' }]}
          onPress={() => handleCategoryTap('satellite')}
          activeOpacity={0.7}
        >
          <Text style={[styles.categoryTitle, { color: '#FCD34D' }]}>궤도 위성</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{showSatellites ? 'On' : 'off'}</Text>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onToggleSatellites(!showSatellites); }}
              style={[styles.toggleTrack, showSatellites && styles.toggleTrackOn]}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleThumb, showSatellites && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* 착륙 지점 */}
        <TouchableOpacity
          style={[styles.categoryCard, activeCategory === 'landing' && styles.categoryCardActive,
          { borderColor: showLandingSites ? '#60A5FA40' : 'rgba(255,255,255,0.08)' }]}
          onPress={() => handleCategoryTap('landing')}
          activeOpacity={0.7}
        >
          <Text style={[styles.categoryTitle, { color: '#60A5FA' }]}>착륙 지점</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{showLandingSites ? 'On' : 'off'}</Text>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onToggleLandingSites(!showLandingSites); }}
              style={[styles.toggleTrack, showLandingSites && styles.toggleTrackOn]}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleThumb, showLandingSites && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* 대표 지형 */}
        <TouchableOpacity
          style={[styles.categoryCard, activeCategory === 'terrain' && styles.categoryCardActive,
          { borderColor: showTerrain ? '#A3A3A340' : 'rgba(255,255,255,0.08)' }]}
          onPress={() => handleCategoryTap('terrain')}
          activeOpacity={0.7}
        >
          <Text style={[styles.categoryTitle, { color: '#A3A3A3' }]}>대표 지형</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{showTerrain ? 'On' : 'off'}</Text>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onToggleTerrain(!showTerrain); }}
              style={[styles.toggleTrack, showTerrain && styles.toggleTrackOn]}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleThumb, showTerrain && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>

      {/* 리스트 영역 */}
      <ScrollView style={styles.listArea} showsVerticalScrollIndicator={false}>
        {/* === 위성 리스트 === */}
        {activeCategory === 'satellite' && (
          <View style={styles.listSection}>
            {isLoadingSatellite && (
              <Text style={{ color: '#FCD34D', fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>위성 데이터 로딩 중...</Text>
            )}
            {satelliteData.map((sat: any, idx: number) => (
              <TouchableOpacity
                key={sat.id || idx}
                style={styles.listItem}
                onPress={() => onSelectSatellite(sat)}
                activeOpacity={0.7}
              >
                <View style={[styles.listDot, { backgroundColor: sat.color || '#FCD34D' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.listItemTitle}>
                    {sat.nameKo !== sat.name ? `${sat.nameKo} (${sat.name})` : sat.name}
                  </Text>
                  <Text style={styles.listItemSub}>{sat.country}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#4B5563" />
              </TouchableOpacity>
            ))}
            {!isLoadingSatellite && satelliteData.length === 0 && (
              <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>위성 토글을 ON하면 데이터가 로드됩니다</Text>
            )}
          </View>
        )}

        {/* === 착륙지 리스트 === */}
        {activeCategory === 'landing' && (
          <View style={styles.listSection}>
            <View style={styles.sortRow}>
              <TouchableOpacity
                onPress={() => setLandingSortMode('year')}
                style={[styles.sortChip, landingSortMode === 'year' && styles.sortChipActive]}
              >
                <Text style={[styles.sortChipText, landingSortMode === 'year' && styles.sortChipTextActive]}>연도순</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLandingSortMode('country')}
                style={[styles.sortChip, landingSortMode === 'country' && styles.sortChipActive]}
              >
                <Text style={[styles.sortChipText, landingSortMode === 'country' && styles.sortChipTextActive]}>국가순</Text>
              </TouchableOpacity>
            </View>
            {sortedLandingSites.map((site, idx) => (
              <TouchableOpacity
                key={`${site.officialName}-${idx}`}
                style={styles.listItem}
                onPress={() => onSelectLandingSite(site)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.listItemTitle}>{site.nameKr}</Text>
                    <Text style={styles.listItemNameEn}>{site.officialName}</Text>
                  </View>
                  <Text style={styles.listItemSub}>{site.year} · {site.country} {site.agency}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#60A5FA" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* === 지형 리스트 === */}
        {activeCategory === 'terrain' && (
          <View style={styles.listSection}>
            <View style={styles.sortRow}>
              <TouchableOpacity
                onPress={() => setFeatureSortMode('type')}
                style={[styles.sortChip, featureSortMode === 'type' && styles.sortChipActive]}
              >
                <Text style={[styles.sortChipText, featureSortMode === 'type' && styles.sortChipTextActive]}>유형순</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFeatureSortMode('size')}
                style={[styles.sortChip, featureSortMode === 'size' && styles.sortChipActive]}
              >
                <Text style={[styles.sortChipText, featureSortMode === 'size' && styles.sortChipTextActive]}>크기순</Text>
              </TouchableOpacity>
            </View>
            {sortedFeatures.map((feat) => (
              <TouchableOpacity
                key={feat.id}
                style={styles.listItem}
                onPress={() => onSelectFeature(feat)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 20, marginRight: 10 }}>{getFeatureTypeEmoji(feat.typeKr)}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.listItemTitle}>{feat.nameKr}</Text>
                    <Text style={styles.listItemNameEn}>{feat.nameEn}</Text>
                  </View>
                  <Text style={styles.listItemSub}>
                    {feat.typeKr} · {feat.diameterKm}km · {isFarSide(feat) ? '뒷면' : '앞면'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={getFeatureTypeColor(feat.typeKr)} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#4B5563',
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
  },

  /* 카테고리 카드 */
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    gap: 8,
  },
  categoryCardActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleLabel: {
    color: '#6B7280',
    fontSize: 11,
  },
  toggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#374151',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackOn: {
    backgroundColor: '#3B82F6',
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },

  /* 리스트 */
  listArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listSection: {
    gap: 0,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#374151',
  },
  sortChipActive: {
    backgroundColor: '#1F2937',
  },
  sortChipText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#F9FAFB',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  listDot: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  listItemTitle: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '600',
  },
  listItemNameEn: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  listItemSub: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
});
