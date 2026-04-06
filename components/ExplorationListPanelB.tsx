import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, Animated, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LANDING_SITES, LandingSite, getContactColor, COUNTRY_NAMES } from '@/constants/LandingSiteData';
import { LUNAR_FEATURES, LunarFeature, getFeatureTypeColor, getFeatureTypeEmoji, isFarSide } from '@/constants/LunarFeatureData';

const { height: SCREEN_H } = Dimensions.get('window');

type ListMode = 'menu' | 'satellite' | 'landing' | 'terrain';

interface Props {
  visible: boolean;
  onClose: () => void;
  showSatellites: boolean;
  showLandingSites: boolean;
  showTerrain: boolean;
  onToggleSatellites: (val: boolean) => void;
  onToggleLandingSites: (val: boolean) => void;
  onToggleTerrain: (val: boolean) => void;
  satelliteData: any[];
  isLoadingSatellite: boolean;
  onSelectSatellite: (sat: any) => void;
  onSelectLandingSite: (site: LandingSite) => void;
  onSelectFeature: (feat: LunarFeature) => void;
}

export default function ExplorationListPanelB({
  visible, onClose,
  showSatellites, showLandingSites, showTerrain,
  onToggleSatellites, onToggleLandingSites, onToggleTerrain,
  satelliteData, isLoadingSatellite,
  onSelectSatellite, onSelectLandingSite, onSelectFeature,
}: Props) {
  const [listMode, setListMode] = useState<ListMode>('menu');
  const [agencyFilter, setAgencyFilter] = useState('전체');
  const [countryFilter, setCountryFilter] = useState('전체');
  const [typeFilter, setTypeFilter] = useState('전체');

  // ── 메뉴 패널 애니메이션 ──
  const menuAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const menuOffset = useRef(SCREEN_H);

  // ── 리스트 슬라이드 애니메이션 ──
  const listSlideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(menuAnim, { toValue: SCREEN_H * 0.58, useNativeDriver: false, tension: 100, friction: 15 }).start();
      menuOffset.current = SCREEN_H * 0.58;
    } else {
      Animated.timing(menuAnim, { toValue: SCREEN_H, duration: 200, useNativeDriver: false }).start();
      menuOffset.current = SCREEN_H;
      // 리스트도 닫기
      listSlideAnim.setValue(SCREEN_H);
      setListMode('menu');
    }
  }, [visible]);

  // 리스트 열기
  const openList = (mode: 'satellite' | 'landing' | 'terrain') => {
    setListMode(mode);
    Animated.spring(listSlideAnim, { toValue: SCREEN_H * 0.12, useNativeDriver: false, tension: 80, friction: 14 }).start();
  };

  // 리스트 닫기 → 메뉴로 복귀
  const closeList = () => {
    Animated.timing(listSlideAnim, { toValue: SCREEN_H, duration: 250, useNativeDriver: false }).start(() => {
      setListMode('menu');
    });
  };

  // 항목 선택
  const handleSelectSatellite = (sat: any) => { closeList(); onClose(); onSelectSatellite(sat); };
  const handleSelectLanding = (site: LandingSite) => { closeList(); onClose(); onSelectLandingSite(site); };
  const handleSelectFeature = (feat: LunarFeature) => { closeList(); onClose(); onSelectFeature(feat); };

  // 필터된 데이터
  const filteredSats = agencyFilter === '전체' ? satelliteData : satelliteData.filter(s => s.agencyCode === agencyFilter);
  const filteredLandings = countryFilter === '전체' ? LANDING_SITES : LANDING_SITES.filter(s => s.country === countryFilter);
  const filteredFeatures = typeFilter === '전체' ? LUNAR_FEATURES : LUNAR_FEATURES.filter(f => f.typeKr === typeFilter);

  if (!visible) return null;

  return (
    <>
      {/* ═══ 하단 3행 메뉴 ═══ */}
      <Animated.View style={[st.menuContainer, { top: menuAnim }]}>
        {/* 핸들 */}
        <View style={st.handleArea}><View style={st.handleBar} /></View>

        {/* 헤더 */}
        <View style={st.headerRow}>
          <Text style={st.headerTitle}>탐사 목록</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#666666" />
          </TouchableOpacity>
        </View>

        {/* 3행 메뉴 */}
        <View style={st.menuRows}>
          {/* 궤도 위성 */}
          <View style={st.menuRow}>
            <Ionicons name="planet-outline" size={18} color="#EBECF1" />
            <Text style={[st.menuLabel, { color: '#EBECF1' }]}>궤도 위성</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => onToggleSatellites(!showSatellites)}
              style={[st.toggleTrack, showSatellites && st.toggleOn]}
            >
              <View style={[st.toggleThumb, showSatellites && st.toggleThumbOn]} />
            </TouchableOpacity>
            <TouchableOpacity style={st.listBtn} onPress={() => openList('satellite')}>
              <Ionicons name="list-outline" size={18} color="#EBECF1" />
            </TouchableOpacity>
          </View>

          {/* 착륙 지점 */}
          <View style={st.menuRow}>
            <Ionicons name="flag-outline" size={18} color="#EBECF1" />
            <Text style={[st.menuLabel, { color: '#EBECF1' }]}>착륙 지점</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => onToggleLandingSites(!showLandingSites)}
              style={[st.toggleTrack, showLandingSites && st.toggleOn]}
            >
              <View style={[st.toggleThumb, showLandingSites && st.toggleThumbOn]} />
            </TouchableOpacity>
            <TouchableOpacity style={st.listBtn} onPress={() => openList('landing')}>
              <Ionicons name="list-outline" size={18} color="#EBECF1" />
            </TouchableOpacity>
          </View>

          {/* 주요 지형 */}
          <View style={st.menuRow}>
            <Ionicons name="earth-outline" size={18} color="#EBECF1" />
            <Text style={[st.menuLabel, { color: '#EBECF1' }]}>주요 지형</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => onToggleTerrain(!showTerrain)}
              style={[st.toggleTrack, showTerrain && st.toggleOn]}
            >
              <View style={[st.toggleThumb, showTerrain && st.toggleThumbOn]} />
            </TouchableOpacity>
            <TouchableOpacity style={st.listBtn} onPress={() => openList('terrain')}>
              <Ionicons name="list-outline" size={18} color="#EBECF1" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* ═══ 전체창 리스트 슬라이드 ═══ */}
      <Animated.View style={[st.listContainer, { top: listSlideAnim }]}>
        {/* 핸들 */}
        <View style={st.handleArea}><View style={st.handleBar} /></View>

        {/* 헤더 */}
        <View style={st.headerRow}>
          <TouchableOpacity onPress={closeList} style={{ marginRight: 8 }}>
            <Ionicons name="chevron-back" size={22} color="#666666" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>
            {listMode === 'satellite' ? '궤도 위성' : listMode === 'landing' ? '착륙 지점' : '주요 지형'}
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => { closeList(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#666666" />
          </TouchableOpacity>
        </View>

        {/* 카테고리 필터 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8, maxHeight: 40 }} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
          {listMode === 'satellite' && ['전체', 'NASA', 'KARI', 'ISRO'].map(a => (
            <TouchableOpacity key={a} onPress={() => setAgencyFilter(a)} style={[st.chip, agencyFilter === a && st.chipActive]}>
              <Text style={[st.chipText, agencyFilter === a && st.chipTextActive]}>{a}</Text>
            </TouchableOpacity>
          ))}
          {listMode === 'landing' && ['전체', 'USA', 'URS', 'CHN', 'IND', 'JPN', 'RUS', 'EUR', 'ISR'].map(c => (
            <TouchableOpacity key={c} onPress={() => setCountryFilter(c)} style={[st.chip, countryFilter === c && st.chipActive]}>
              <Text style={[st.chipText, countryFilter === c && st.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
          {listMode === 'terrain' && ['전체', '충돌구', '만', '바다', '산맥', '단층', '소용돌이', '계곡', '열구', '산', '분지'].map(t => (
            <TouchableOpacity key={t} onPress={() => setTypeFilter(t)} style={[st.chip, typeFilter === t && st.chipActive]}>
              <Text style={[st.chipText, typeFilter === t && st.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 리스트 */}
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
          {/* 위성 */}
          {listMode === 'satellite' && (
            <>
              {isLoadingSatellite && <Text style={st.loading}>위성 데이터 로딩 중...</Text>}
              {filteredSats.map((sat: any, i: number) => (
                <TouchableOpacity key={sat.id || i} style={st.listItem} onPress={() => handleSelectSatellite(sat)} activeOpacity={0.7}>
                  <View style={{ width: 68, height: 68, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="planet-outline" size={28} color={sat.color || '#FCD34D'} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={st.itemTitle} numberOfLines={1}>{sat.nameKo !== sat.name ? `${sat.nameKo}` : sat.name}</Text>
                    <Text style={st.itemSub}>{sat.agency || sat.country}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color="#666666" />
                </TouchableOpacity>
              ))}
              {!isLoadingSatellite && filteredSats.length === 0 && (
                <Text style={st.emptyText}>{agencyFilter === '전체' ? '위성 토글을 ON하면 데이터가 로드됩니다' : `${agencyFilter} 소속 위성이 없습니다`}</Text>
              )}
            </>
          )}

          {/* 착륙지 */}
          {listMode === 'landing' && filteredLandings.map((site, i) => (
            <TouchableOpacity key={`${site.officialName}-${i}`} style={st.listItem} onPress={() => handleSelectLanding(site)} activeOpacity={0.7}>
              <View style={{ width: 68, height: 68, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="location" size={28} color="#60A5FA" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={st.itemTitle} numberOfLines={1}>{site.nameKr}</Text>
                  <Text style={st.itemNameEn} numberOfLines={1}>{site.officialName}</Text>
                </View>
                <Text style={st.itemSub}>{site.year} · {site.country} {site.agency}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#666666" />
            </TouchableOpacity>
          ))}
          {listMode === 'landing' && filteredLandings.length === 0 && (
            <Text style={st.emptyText}>{countryFilter} 소속 착륙 지점이 없습니다</Text>
          )}

          {/* 지형 */}
          {listMode === 'terrain' && filteredFeatures.map(feat => (
            <TouchableOpacity key={feat.id} style={st.listItem} onPress={() => handleSelectFeature(feat)} activeOpacity={0.7}>
              <View style={{ width: 68, height: 68, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 28 }}>{getFeatureTypeEmoji(feat.typeKr)}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={st.itemTitle} numberOfLines={1}>{feat.nameKr}</Text>
                  <Text style={st.itemNameEn} numberOfLines={1}>{feat.nameEn}</Text>
                </View>
                <Text style={st.itemSub}>{feat.typeKr} · {feat.diameterKm}km · {isFarSide(feat) ? '뒷면' : '앞면'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#666666" />
            </TouchableOpacity>
          ))}
          {listMode === 'terrain' && filteredFeatures.length === 0 && (
            <Text style={st.emptyText}>{typeFilter} 유형 지형이 없습니다</Text>
          )}

          <View style={{ height: 300 }} />
        </ScrollView>
      </Animated.View>
    </>
  );
}

const st = StyleSheet.create({
  // ── 메뉴 컨테이너 ──
  menuContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#15171C', borderTopLeftRadius: 14, borderTopRightRadius: 14,
    overflow: 'hidden', zIndex: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 20,
  },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  handleBar: { width: 49, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { color: '#EBECF1', fontSize: 18, fontWeight: '600' },

  // ── 3행 메뉴 ──
  menuRows: { paddingHorizontal: 16, gap: 6, paddingBottom: 16 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'transparent', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  menuLabel: { fontSize: 14, fontWeight: '500' },
  toggleTrack: { width: 67, height: 28, borderRadius: 14, backgroundColor: '#666666', justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: '#3C57E9' },
  toggleThumb: { width: 37, height: 22, borderRadius: 12, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  listBtn: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center', marginLeft: 6,
  },

  // ── 전체 리스트 ──
  listContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#15171C', borderTopLeftRadius: 14, borderTopRightRadius: 14,
    overflow: 'hidden', zIndex: 25,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 25,
  },

  // ── 필터 칩 ──
  chip: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0 },
  chipActive: { backgroundColor: '#EBECF1' },
  chipText: { color: '#666666', fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: '#000000' },

  // ── 리스트 아이템 ──
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', gap: 14 },
  dot: { width: 4, height: 32, borderRadius: 2, marginRight: 0 },
  itemTitle: { color: '#EBECF1', fontSize: 18, fontWeight: '500' },
  itemNameEn: { color: '#666666', fontSize: 13 },
  itemSub: { color: '#666666', fontSize: 12, marginTop: 2 },
  loading: { color: '#FCD34D', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  emptyText: { color: '#666666', fontSize: 13, textAlign: 'center', paddingVertical: 30 },
});
