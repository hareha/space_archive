import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, Animated, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LANDING_SITES, LandingSite, getContactColor } from '@/constants/LandingSiteData';
import { LUNAR_FEATURES, LunarFeature, getFeatureTypeColor, getFeatureTypeEmoji, isFarSide } from '@/constants/LunarFeatureData';

const { height: SCREEN_H } = Dimensions.get('window');

type Phase = 'category' | 'result';
type SectionKey = 'satellite' | 'landing' | 'terrain';

interface Props {
  visible: boolean;
  onClose: () => void;
  showSatellites: boolean;
  showLandingSites: boolean;
  showTerrain: boolean;
  onToggleSatellites: (val: boolean, agencies?: string[]) => void;
  onToggleLandingSites: (val: boolean, countries?: string[]) => void;
  onToggleTerrain: (val: boolean, types?: string[]) => void;
  satelliteData: any[];
  isLoadingSatellite: boolean;
  onSelectSatellite: (sat: any) => void;
  onSelectLandingSite: (site: LandingSite) => void;
  onSelectFeature: (feat: LunarFeature) => void;
}

interface CategorySelection {
  countries: string[];
  featureTypes: string[];
}

const COUNTRIES = ['USA', 'KOR', 'IND', 'CHN', 'EUR', 'URS', 'JPN', 'RUS', 'ISR'];
const COUNTRY_TO_AGENCY: Record<string, string> = {
  USA: 'NASA', KOR: 'KARI', IND: 'ISRO', CHN: 'CNSA', EUR: 'ESA',
};
const FEATURE_TYPES = ['충돌구', '만', '바다', '산맥', '단층', '소용돌이', '계곡', '열구', '산', '분지'];

export default function ExplorationListPanelC({
  visible, onClose,
  showSatellites, showLandingSites, showTerrain,
  onToggleSatellites, onToggleLandingSites, onToggleTerrain,
  satelliteData, isLoadingSatellite,
  onSelectSatellite, onSelectLandingSite, onSelectFeature,
}: Props) {
  const [phase, setPhase] = useState<Phase>('category');
  const [activeSections, setActiveSections] = useState<Set<SectionKey>>(new Set());
  const [selection, setSelection] = useState<CategorySelection>({
    countries: [], featureTypes: [],
  });

  const SNAP_OPEN = SCREEN_H * 0.68;
  const RESULT_SNAP = SCREEN_H * 0.25;
  const panelAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const panelOffset = useRef(SCREEN_H);
  const resultAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const resultOffset = useRef(SCREEN_H);

  React.useEffect(() => {
    if (visible) {
      setPhase('category');
      setActiveSections(new Set());
      setSelection({ countries: [], featureTypes: [] });
      panelOffset.current = SNAP_OPEN;
      Animated.spring(panelAnim, { toValue: SNAP_OPEN, useNativeDriver: false, tension: 100, friction: 15 }).start();
    } else {
      panelOffset.current = SCREEN_H;
      Animated.timing(panelAnim, { toValue: SCREEN_H, duration: 200, useNativeDriver: false }).start();
      resultAnim.setValue(SCREEN_H);
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        const next = panelOffset.current + g.dy;
        if (next >= SNAP_OPEN * 0.8) panelAnim.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          panelOffset.current = SCREEN_H;
          Animated.timing(panelAnim, { toValue: SCREEN_H, duration: 200, useNativeDriver: false }).start(() => onClose());
        } else if (g.vy < -0.5) {
          panelOffset.current = SNAP_OPEN;
          Animated.spring(panelAnim, { toValue: SNAP_OPEN, useNativeDriver: false, tension: 120, friction: 14 }).start();
        } else {
          panelOffset.current = SNAP_OPEN;
          Animated.spring(panelAnim, { toValue: SNAP_OPEN, useNativeDriver: false, tension: 120, friction: 14 }).start();
        }
      },
    })
  ).current;

  const resultPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        const next = resultOffset.current + g.dy;
        if (next >= SCREEN_H * 0.15) resultAnim.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          resultOffset.current = SCREEN_H;
          Animated.timing(resultAnim, { toValue: SCREEN_H, duration: 200, useNativeDriver: false }).start(() => onClose());
        } else if (g.vy < -0.5) {
          resultOffset.current = RESULT_SNAP;
          Animated.spring(resultAnim, { toValue: RESULT_SNAP, useNativeDriver: false, tension: 120, friction: 14 }).start();
        } else {
          resultOffset.current = RESULT_SNAP;
          Animated.spring(resultAnim, { toValue: RESULT_SNAP, useNativeDriver: false, tension: 120, friction: 14 }).start();
        }
      },
    })
  ).current;

  const toggleSection = (section: SectionKey) => {
    setActiveSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
        if (section === 'satellite') { onToggleSatellites(false); }
        if (section === 'landing') { onToggleLandingSites(false); }
        if (section === 'terrain') { onToggleTerrain(false); setSelection(p => ({ ...p, featureTypes: [] })); }
        // 위성+착륙지 둘 다 OFF되면 국가 칩 초기화
        if ((section === 'satellite' && !next.has('landing')) || (section === 'landing' && !next.has('satellite'))) {
          setSelection(p => ({ ...p, countries: [] }));
        }
      } else {
        next.add(section);
        if (section === 'satellite') onToggleSatellites(true);
        if (section === 'landing') onToggleLandingSites(true);
        if (section === 'terrain') onToggleTerrain(true);
      }
      return next;
    });
  };

  const toggleChip = (type: 'country' | 'feature', value: string) => {
    setSelection(prev => {
      const key = type === 'country' ? 'countries' : 'featureTypes';
      const arr = prev[key];
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
      if (type === 'country') {
        // 국가 → 기관 매핑해서 위성 필터
        const agencies = next.map(c => COUNTRY_TO_AGENCY[c]).filter(Boolean);
        if (activeSections.has('satellite')) onToggleSatellites(true, agencies.length > 0 ? agencies : undefined);
        if (activeSections.has('landing')) onToggleLandingSites(true, next.length > 0 ? next : undefined);
      }
      if (type === 'feature') onToggleTerrain(next.length > 0 || activeSections.has('terrain'), next.length > 0 ? next : undefined);
      return { ...prev, [key]: next };
    });
  };

  const handleFinish = () => {
    const hasSelection = selection.countries.length > 0 || selection.featureTypes.length > 0;
    if (!hasSelection && activeSections.size === 0) { onClose(); return; }
    setPhase('result');
    Animated.timing(panelAnim, { toValue: SCREEN_H, duration: 200, useNativeDriver: false }).start();
    resultOffset.current = RESULT_SNAP;
    Animated.spring(resultAnim, { toValue: RESULT_SNAP, useNativeDriver: false, tension: 80, friction: 14 }).start();
  };

  const handleCloseResult = () => {
    Animated.timing(resultAnim, { toValue: SCREEN_H, duration: 250, useNativeDriver: false }).start(() => onClose());
  };

  const resultSats = activeSections.has('satellite')
    ? (selection.countries.length > 0
      ? satelliteData.filter(s => {
          const agencies = selection.countries.map(c => COUNTRY_TO_AGENCY[c]).filter(Boolean);
          return agencies.includes(s.agencyCode);
        })
      : satelliteData) : [];
  const resultLandings = activeSections.has('landing')
    ? (selection.countries.length > 0 ? LANDING_SITES.filter(s => selection.countries.includes(s.country)) : LANDING_SITES) : [];
  const resultFeatures = activeSections.has('terrain')
    ? (selection.featureTypes.length > 0 ? LUNAR_FEATURES.filter(f => selection.featureTypes.includes(f.typeKr)) : LUNAR_FEATURES) : [];
  const totalResults = resultSats.length + resultLandings.length + resultFeatures.length;

  if (!visible && phase !== 'result') return null;

  const isSatActive = activeSections.has('satellite');
  const isLandActive = activeSections.has('landing');
  const isTerrainActive = activeSections.has('terrain');

  return (
    <>
      {/* ═══ 카테고리 선택 ═══ */}
      {phase === 'category' && (
        <>
          <TouchableOpacity style={st.dimOverlay} activeOpacity={1} onPress={onClose} />
          <Animated.View style={[st.panel, { top: panelAnim }]}>
            <View style={st.handleArea} {...panResponder.panHandlers}><View style={st.handleBar} /></View>

            <View style={st.headerRow}>
              <Text style={st.headerTitle}>탐사 목록</Text>
              <TouchableOpacity onPress={handleFinish} style={st.doneBtn}>
                <Text style={st.doneBtnText}>완료</Text>
              </TouchableOpacity>
            </View>

            {/* 가로 3열 컴팩트 버튼 (아이콘+라벨+토글 가로 배치) */}
            <View style={st.menuRow}>
              <TouchableOpacity style={[st.menuCard, isSatActive && st.menuCardActive]} onPress={() => toggleSection('satellite')} activeOpacity={0.7}>
                <Ionicons name="planet-outline" size={18} color={isSatActive ? '#EBECF1' : '#666666'} />
                <Text style={[st.menuCardLabel, { color: isSatActive ? '#EBECF1' : '#666666' }]}>위성</Text>
                <View style={[st.toggleTrack, isSatActive && st.toggleOn]}>
                  <View style={[st.toggleThumb, isSatActive && st.toggleThumbOn]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[st.menuCard, isLandActive && st.menuCardActive]} onPress={() => toggleSection('landing')} activeOpacity={0.7}>
                <Ionicons name="flag-outline" size={18} color={isLandActive ? '#EBECF1' : '#666666'} />
                <Text style={[st.menuCardLabel, { color: isLandActive ? '#EBECF1' : '#666666' }]}>착륙지</Text>
                <View style={[st.toggleTrack, isLandActive && st.toggleOn]}>
                  <View style={[st.toggleThumb, isLandActive && st.toggleThumbOn]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[st.menuCard, isTerrainActive && st.menuCardActive]} onPress={() => toggleSection('terrain')} activeOpacity={0.7}>
                <Ionicons name="earth-outline" size={18} color={isTerrainActive ? '#EBECF1' : '#666666'} />
                <Text style={[st.menuCardLabel, { color: isTerrainActive ? '#EBECF1' : '#666666' }]}>지형</Text>
                <View style={[st.toggleTrack, isTerrainActive && st.toggleOn]}>
                  <View style={[st.toggleThumb, isTerrainActive && st.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* 칩 라인: 국가 (위성 OR 착륙지 하나라도 ON이면 표시) */}
            {(isSatActive || isLandActive) && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.chipLine} contentContainerStyle={st.chipRow}>
                <Text style={[st.chipLabel, { color: '#3C57E9' }]}>국가</Text>
                {COUNTRIES.map(c => (
                  <TouchableOpacity key={c} style={[st.chip, selection.countries.includes(c) && st.chipSelected]} onPress={() => toggleChip('country', c)}>
                    <Text style={[st.chipText, selection.countries.includes(c) && st.chipTextSelected]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {isTerrainActive && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.chipLine} contentContainerStyle={st.chipRow}>
                <Text style={[st.chipLabel, { color: '#3C57E9' }]}>유형</Text>
                {FEATURE_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[st.chip, selection.featureTypes.includes(t) && st.chipSelected]} onPress={() => toggleChip('feature', t)}>
                    <Text style={[st.chipText, selection.featureTypes.includes(t) && st.chipTextSelected]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={{ height: 8 }} />
          </Animated.View>
        </>
      )}

      {/* ═══ 합산 결과 리스트 ═══ */}
      {phase === 'result' && (
        <Animated.View style={[st.panel, { top: resultAnim }]}>
          <View style={st.handleArea} {...resultPanResponder.panHandlers}><View style={st.handleBar} /></View>

          <View style={st.headerRow}>
            <TouchableOpacity onPress={() => {
              setPhase('category');
              resultAnim.setValue(SCREEN_H);
              panelOffset.current = SNAP_OPEN;
              Animated.spring(panelAnim, { toValue: SNAP_OPEN, useNativeDriver: false, tension: 100, friction: 15 }).start();
            }} style={{ marginRight: 8 }}>
              <Ionicons name="chevron-back" size={22} color="#666666" />
            </TouchableOpacity>
            <Text style={st.headerTitle}>검색 결과 ({totalResults})</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={handleCloseResult} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#666666" />
            </TouchableOpacity>
          </View>

          {/* 선택 태그 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8, maxHeight: 32 }} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
            {isSatActive && <View style={st.resultTag}><Text style={[st.resultTagText, { color: '#FCD34D' }]}>🛰 위성{selection.countries.length > 0 ? ` (${selection.countries.join(',')})` : ''}</Text></View>}
            {isLandActive && <View style={st.resultTag}><Text style={[st.resultTagText, { color: '#60A5FA' }]}>🚀 착륙{selection.countries.length > 0 ? ` (${selection.countries.join(',')})` : ''}</Text></View>}
            {isTerrainActive && <View style={st.resultTag}><Text style={[st.resultTagText, { color: '#A78BFA' }]}>🏔 지형{selection.featureTypes.length > 0 ? ` (${selection.featureTypes.join(',')})` : ''}</Text></View>}
          </ScrollView>

          <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
            {resultSats.length > 0 && (
              <View style={st.resultSection}>
                <Text style={[st.resultSectionTitle, { color: '#EBECF1' }]}>궤도 위성 ({resultSats.length})</Text>
                {resultSats.map((sat: any, i: number) => (
                  <TouchableOpacity key={sat.id || i} style={st.listItem} onPress={() => { handleCloseResult(); onSelectSatellite(sat); }} activeOpacity={0.7}>
                    <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="planet-outline" size={22} color={sat.color || '#FCD34D'} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={st.itemTitle} numberOfLines={1}>{sat.nameKo !== sat.name ? sat.nameKo : sat.name}</Text>
                      <Text style={st.itemSub}>{sat.agency || sat.country}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#666666" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {resultLandings.length > 0 && (
              <View style={st.resultSection}>
                <Text style={[st.resultSectionTitle, { color: '#EBECF1' }]}>착륙 지점 ({resultLandings.length})</Text>
                {resultLandings.map((site, i) => (
                  <TouchableOpacity key={`${site.officialName}-${i}`} style={st.listItem} onPress={() => { handleCloseResult(); onSelectLandingSite(site); }} activeOpacity={0.7}>
                    <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="location" size={22} color="#60A5FA" />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={st.itemTitle} numberOfLines={1}>{site.nameKr}</Text>
                        <Text style={st.itemNameEn} numberOfLines={1}>{site.officialName}</Text>
                      </View>
                      <Text style={st.itemSub}>{site.year} · {site.country} {site.agency}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#666666" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {resultFeatures.length > 0 && (
              <View style={st.resultSection}>
                <Text style={[st.resultSectionTitle, { color: '#EBECF1' }]}>주요 지형 ({resultFeatures.length})</Text>
                {resultFeatures.map(feat => (
                  <TouchableOpacity key={feat.id} style={st.listItem} onPress={() => { handleCloseResult(); onSelectFeature(feat); }} activeOpacity={0.7}>
                    <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 22 }}>{getFeatureTypeEmoji(feat.typeKr)}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={st.itemTitle} numberOfLines={1}>{feat.nameKr}</Text>
                        <Text style={st.itemNameEn} numberOfLines={1}>{feat.nameEn}</Text>
                      </View>
                      <Text style={st.itemSub}>{feat.typeKr} · {feat.diameterKm}km · {isFarSide(feat) ? '뒷면' : '앞면'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#666666" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {totalResults === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="search-outline" size={36} color="#666666" />
                <Text style={{ color: '#666666', fontSize: 14, marginTop: 12 }}>선택한 카테고리에 해당하는 항목이 없습니다</Text>
              </View>
            )}

            <View style={{ height: 300 }} />
          </ScrollView>
        </Animated.View>
      )}
    </>
  );
}

const st = StyleSheet.create({
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#15171C', borderTopLeftRadius: 14, borderTopRightRadius: 14,
    overflow: 'hidden', zIndex: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 20,
  },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handleBar: { width: 49, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 6 },
  headerTitle: { color: '#EBECF1', fontSize: 15, fontWeight: '600' },

  doneBtn: { backgroundColor: '#3C57E9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  doneBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  dimOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 19 } as any,

  // 가로 3열 컴팩트 버튼 (flexDirection: row)
  menuRow: { flexDirection: 'row', gap: 0, paddingHorizontal: 12, paddingBottom: 6 } as any,
  menuCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10,
    backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent',
  } as any,
  menuCardActive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  menuCardLabel: { fontSize: 12, fontWeight: '500' },

  toggleTrack: { width: 67, height: 28, borderRadius: 14, backgroundColor: '#666666', justifyContent: 'center', paddingHorizontal: 3 } as any,
  toggleOn: { backgroundColor: '#3C57E9' },
  toggleThumb: { width: 37, height: 22, borderRadius: 12, backgroundColor: '#fff', alignSelf: 'flex-start' } as any,
  toggleThumbOn: { alignSelf: 'flex-end' } as any,

  // 칩 라인 (라벨 + 칩 같은 줄)
  chipLine: { paddingHorizontal: 12, marginBottom: 2 },
  chipRow: { gap: 5, alignItems: 'center', paddingRight: 12 } as any,
  chipLabel: { fontSize: 11, fontWeight: '600', marginRight: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0 },
  chipSelected: { backgroundColor: '#EBECF1' },
  chipText: { color: '#666666', fontSize: 11, fontWeight: '500' },
  chipTextSelected: { color: '#000000', fontWeight: '600' },

  // 결과
  resultTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  resultTagText: { fontSize: 11, fontWeight: '600' },
  resultSection: { marginBottom: 12 },
  resultSectionTitle: { fontSize: 13, fontWeight: '600', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },

  // 리스트 아이템
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', gap: 14 },
  dot: { width: 3, height: 28, borderRadius: 2, marginRight: 0 },
  itemTitle: { color: '#EBECF1', fontSize: 14, fontWeight: '500' },
  itemNameEn: { color: '#666666', fontSize: 12 },
  itemSub: { color: '#666666', fontSize: 11, marginTop: 1 },
});
