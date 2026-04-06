import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, Animated, PanResponder, Switch,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LANDING_SITES, LandingSite, getContactColor, COUNTRY_NAMES } from '@/constants/LandingSiteData';
import { LUNAR_FEATURES, LunarFeature, getFeatureTypeColor, getFeatureTypeEmoji, formatArea, isFarSide } from '@/constants/LunarFeatureData';
import { LANDING_SITE_IMAGES, LUNAR_FEATURE_IMAGES } from '@/constants/LunarImages';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

// snap points: top값 기준 (딱 2개만) — SAT_PANEL과 동일한 방식
export const PANEL_SCREEN_H = SCREEN_H;
export const SNAP_MIN = SCREEN_H * 0.70;  // 최소: top=70% (높이 30%)
export const SNAP_MAX = SCREEN_H * 0.55;  // 최대: top=55% (높이 45%)

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
  const [agencyFilter, setAgencyFilter] = useState<string>('전체');
  const [landingCountryFilter, setLandingCountryFilter] = useState<string>('전체');
  const [featureTypeFilter, setFeatureTypeFilter] = useState<string>('전체');

  // 패널 애니메이션 (top값 직접 애니메이션 — bottom: 0과 함께 사용하여 ScrollView가 보이는 영역에 정확히 맞도록)
  const panelTop = useRef(new Animated.Value(SCREEN_H)).current;
  const currentTop = useRef(SCREEN_H);

  React.useEffect(() => {
    if (visible) {
      // top값: 작을수록 패널이 큼 (SNAP_MAX < SNAP_MIN)
      const targetTop = activeCategory ? SNAP_MAX : SNAP_MIN;
      Animated.spring(panelTop, {
        toValue: targetTop,
        useNativeDriver: false,
        tension: 100,
        friction: 15,
      }).start();
      currentTop.current = targetTop;
    } else {
      Animated.timing(panelTop, {
        toValue: SCREEN_H, // 화면 밖으로
        duration: 250,
        useNativeDriver: false,
      }).start();
      currentTop.current = SCREEN_H;
    }
  }, [visible]);

  // snap 함수
  const snapTo = useCallback((target: number) => {
    currentTop.current = target;
    Animated.spring(panelTop, {
      toValue: target,
      useNativeDriver: false,
      tension: 100,
      friction: 15,
    }).start();
  }, [panelTop]);

  const snapToRef = useRef(snapTo);
  snapToRef.current = snapTo;

  // 드래그 핸들러
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        panelTop.stopAnimation((val) => {
          currentTop.current = val;
        });
      },
      onPanResponderMove: (_, g) => {
        const safeTop = 54;
        const newTop = Math.max(safeTop, Math.min(SCREEN_H, currentTop.current + g.dy));
        panelTop.setValue(newTop);
      },
      onPanResponderRelease: (_, g) => {
        const raw = currentTop.current + g.dy;
        const safeTop = 54;
        const vy = g.vy;
        if (vy > 0.5) {
          // 아래로 빠르게 flick → 닫기
          snapToRef.current(SCREEN_H);
          setTimeout(() => onClose(), 250);
        } else if (vy < -0.5) {
          // 위로 빠르게 flick → 최대 확장
          snapToRef.current(safeTop);
        } else if (raw < SNAP_MAX * 0.5) {
          snapToRef.current(safeTop);
        } else {
          const mid = (SNAP_MIN + SNAP_MAX) / 2;
          snapToRef.current(raw < mid ? SNAP_MAX : SNAP_MIN);
        }
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
  const filteredLandingSites = landingCountryFilter === '전체' ? LANDING_SITES : LANDING_SITES.filter(s => s.country === landingCountryFilter);
  const filteredFeatures = featureTypeFilter === '전체' ? LUNAR_FEATURES : LUNAR_FEATURES.filter(f => f.typeKr === featureTypeFilter);

  if (!visible && currentTop.current >= SCREEN_H) return null;

  return (
    <Animated.View style={[styles.container, { top: panelTop }]}>
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
          style={[styles.categoryCard, activeCategory === 'satellite' && styles.categoryCardActive]}
          onPress={() => handleCategoryTap('satellite')}
          activeOpacity={0.7}
        >
          <Text style={[styles.categoryTitle, { color: activeCategory === 'satellite' ? '#EBECF1' : '#666666' }]}>궤도 위성</Text>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onToggleSatellites(!showSatellites); }}
            style={[styles.toggleTrack, showSatellites && styles.toggleTrackOn]}
            activeOpacity={0.8}
          >
            <View style={[styles.toggleThumb, showSatellites && styles.toggleThumbOn]} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* 착륙 지점 */}
        <TouchableOpacity
          style={[styles.categoryCard, activeCategory === 'landing' && styles.categoryCardActive]}
          onPress={() => handleCategoryTap('landing')}
          activeOpacity={0.7}
        >
          <Text style={[styles.categoryTitle, { color: activeCategory === 'landing' ? '#EBECF1' : '#666666' }]}>착륙 지점</Text>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onToggleLandingSites(!showLandingSites); }}
            style={[styles.toggleTrack, showLandingSites && styles.toggleTrackOn]}
            activeOpacity={0.8}
          >
            <View style={[styles.toggleThumb, showLandingSites && styles.toggleThumbOn]} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* 대표 지형 */}
        <TouchableOpacity
          style={[styles.categoryCard, activeCategory === 'terrain' && styles.categoryCardActive]}
          onPress={() => handleCategoryTap('terrain')}
          activeOpacity={0.7}
        >
          <Text style={[styles.categoryTitle, { color: activeCategory === 'terrain' ? '#EBECF1' : '#666666' }]}>주요 지형</Text>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onToggleTerrain(!showTerrain); }}
            style={[styles.toggleTrack, showTerrain && styles.toggleTrackOn]}
            activeOpacity={0.8}
          >
            <View style={[styles.toggleThumb, showTerrain && styles.toggleThumbOn]} />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      {/* 리스트 영역 */}
      <ScrollView style={styles.listArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* === 위성 리스트 === */}
        {activeCategory === 'satellite' && (
          <View style={styles.listSection}>
            {/* 기관 필터 버튼 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
              {['전체', 'KARI', 'NASA', 'ISRO'].map((agency) => (
                <TouchableOpacity
                  key={agency}
                  onPress={() => setAgencyFilter(agency)}
                  style={[styles.sortChip, agencyFilter === agency && styles.sortChipActive]}
                >
                  <Text style={[styles.sortChipText, agencyFilter === agency && styles.sortChipTextActive]}>{agency}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {isLoadingSatellite && (
              <Text style={{ color: '#FCD34D', fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>위성 데이터 로딩 중...</Text>
            )}
            {satelliteData
              .filter((sat: any) => agencyFilter === '전체' || sat.agencyCode === agencyFilter)
              .map((sat: any, idx: number) => (
              <TouchableOpacity
                key={sat.id || idx}
                style={styles.listItem}
                onPress={() => onSelectSatellite(sat)}
                activeOpacity={0.7}
              >
                <View style={styles.listThumbnail}>
                  <Ionicons name="planet" size={28} color={sat.color || '#FCD34D'} />
                </View>
                <View style={{ flex: 1, gap: 7 }}>
                  <Text style={styles.listItemTitle} numberOfLines={1}>
                    {sat.nameKo !== sat.name ? `${sat.nameKo} (${sat.name})` : sat.name}
                  </Text>
                  <Text style={styles.listItemSub} numberOfLines={1}>{sat.agency || sat.country}</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#666666" />
              </TouchableOpacity>
            ))}
            {!isLoadingSatellite && satelliteData.filter((sat: any) => agencyFilter === '전체' || sat.agencyCode === agencyFilter).length === 0 && (
              <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>
                {agencyFilter === '전체' ? '위성 토글을 ON하면 데이터가 로드됩니다' : `${agencyFilter} 소속 위성이 없습니다`}
              </Text>
            )}
          </View>
        )}

        {/* === 착륙지 리스트 === */}
        {activeCategory === 'landing' && (
          <View style={styles.listSection}>
            {/* 국가별 필터 버튼 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
              {['전체', 'USA', 'URS', 'CHN', 'IND', 'JPN', 'RUS', 'EUR', 'ISR'].map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setLandingCountryFilter(c)}
                  style={[styles.sortChip, landingCountryFilter === c && styles.sortChipActive]}
                >
                  <Text style={[styles.sortChipText, landingCountryFilter === c && styles.sortChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {filteredLandingSites.map((site, idx) => (
              <TouchableOpacity
                key={`${site.officialName}-${idx}`}
                style={styles.listItem}
                onPress={() => onSelectLandingSite(site)}
                activeOpacity={0.7}
              >
                <View style={styles.listThumbnail}>
                  {LANDING_SITE_IMAGES[site.officialName] ? (
                    <Image source={LANDING_SITE_IMAGES[site.officialName]} style={{ width: 68, height: 68, borderRadius: 3 }} resizeMode="cover" />
                  ) : (
                    <Ionicons name="location" size={28} color="#60A5FA" />
                  )}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.listItemTitle} numberOfLines={1}>{site.nameKr}</Text>
                    <Text style={styles.listItemNameEn} numberOfLines={1}>{site.officialName}</Text>
                  </View>
                  <Text style={styles.listItemSub}>{site.year} · {site.country} {site.agency}</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#666666" />
              </TouchableOpacity>
            ))}
            {filteredLandingSites.length === 0 && (
              <Text style={{ color: '#666666', fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>{landingCountryFilter} 소속 착륙 지점이 없습니다</Text>
            )}
          </View>
        )}

        {/* === 지형 리스트 === */}
        {activeCategory === 'terrain' && (
          <View style={styles.listSection}>
            {/* 유형별 필터 버튼 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8, flexWrap: 'wrap' }}>
              {['전체', '충돌구', '만', '바다', '산맥', '단층', '소용돌이', '계곡', '열구', '산', '분지'].map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setFeatureTypeFilter(t)}
                  style={[styles.sortChip, featureTypeFilter === t && styles.sortChipActive]}
                >
                  <Text style={[styles.sortChipText, featureTypeFilter === t && styles.sortChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {filteredFeatures.map((feat) => (
              <TouchableOpacity
                key={feat.id}
                style={styles.listItem}
                onPress={() => onSelectFeature(feat)}
                activeOpacity={0.7}
              >
                <View style={styles.listThumbnail}>
                  {LUNAR_FEATURE_IMAGES[feat.id] ? (
                    <Image source={LUNAR_FEATURE_IMAGES[feat.id]} style={{ width: 68, height: 68, borderRadius: 3 }} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 28 }}>{getFeatureTypeEmoji(feat.typeKr)}</Text>
                  )}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.listItemTitle} numberOfLines={1}>{feat.nameKr}</Text>
                    <Text style={styles.listItemNameEn} numberOfLines={1}>{feat.nameEn}</Text>
                  </View>
                  <Text style={styles.listItemSub}>
                    {feat.typeKr} · {feat.diameterKm}km · {isFarSide(feat) ? '뒷면' : '앞면'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#666666" />
              </TouchableOpacity>
            ))}
            {filteredFeatures.length === 0 && (
              <Text style={{ color: '#666666', fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>{featureTypeFilter} 유형 지형이 없습니다</Text>
            )}
          </View>
        )}


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
    backgroundColor: '#15171C',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
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
    paddingTop: 8,
    paddingBottom: 8,
  },
  handleBar: {
    width: 49,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#EBECF1',
    fontSize: 18,
    fontWeight: '600',
  },

  /* 카테고리 카드 — Figma Switch opt */
  categoryRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    gap: 14,
  },
  categoryCardActive: {
    backgroundColor: '#25272C',
    borderColor: 'transparent',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleLabel: {
    color: '#666666',
    fontSize: 11,
  },
  toggleTrack: {
    width: 67,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#666666',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleTrackOn: {
    backgroundColor: '#7295FE',
  },
  toggleThumb: {
    width: 37,
    height: 22,
    borderRadius: 12,
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
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  sortChipActive: {
    backgroundColor: '#EBECF1',
  },
  sortChipText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: '#000000',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 14,
  },
  listThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  listItemTitle: {
    color: '#EBECF1',
    fontSize: 18,
    fontWeight: '500',
  },
  listItemNameEn: {
    color: '#666666',
    fontSize: 13,
  },
  listItemSub: {
    color: '#666666',
    fontSize: 12,
    marginTop: 2,
  },
});
