import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, ActivityIndicator, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_W } = Dimensions.get('window');

// ──────────────────────────────────────────────────
// 카테고리별 자원 정의
// ──────────────────────────────────────────────────
const RESOURCE_CATEGORIES = {
  general: {
    label: '일반',
    resources: [
      { key: 'feo', label: '철 (Fe)', icon: 'atom', color: '#FF6B6B' },
      { key: 'tio2', label: '티타늄 (Ti)', icon: 'atom', color: '#4ECDC4' },
      { key: 'mgo', label: '마그네슘 (Mg)', icon: 'atom', color: '#45B7D1' },
      { key: 'al2o3', label: '알루미늄 (Al)', icon: 'atom', color: '#96CEB4' },
      { key: 'sio2', label: '규소 (Si)', icon: 'atom', color: '#FFEAA7' },
      { key: 'cao', label: '칼슘 (Ca)', icon: 'atom', color: '#DDA0DD' },
    ],
  },
  special: {
    label: '특수',
    resources: [
      { key: 'k', label: '칼륨 (K)', icon: 'radioactive', color: '#E17055' },
      { key: 'th', label: '토륨 (Th)', icon: 'radioactive', color: '#FDCB6E' },
      { key: 'u', label: '우라늄 (U)', icon: 'radioactive', color: '#6C5CE7' },
    ],
  },
  environment: {
    label: '환경',
    resources: [
      { key: 'neutron', label: '수소/중성자 (H)', icon: 'water', color: '#74B9FF' },
      { key: 'thermalGrid', label: '평균 온도', icon: 'thermometer', color: '#FF6B6B' },
      { key: 'gravity', label: '중력', icon: 'magnet', color: '#A29BFE' },
    ],
  },
};

const RESOURCE_NAMES: Record<string, string> = {
  feo: '철 (FeO)', tio2: '티타늄 (TiO₂)', mgo: '마그네슘 (MgO)',
  al2o3: '알루미늄 (Al₂O₃)', sio2: '규소 (SiO₂)', cao: '칼슘 (CaO)',
  k: '칼륨 (K)', th: '토륨 (Th)', u: '우라늄 (U)',
  neutron: '중성자', thermalGrid: '온도', gravity: '중력',
};

// 범례 스케일 정의
const LEGEND_SCALES: Record<string, { values: number[]; unit: string }> = {
  feo: { values: [20.0, 10.0, 0.0], unit: 'wt%' },
  tio2: { values: [15.0, 7.5, 0.0], unit: 'wt%' },
  mgo: { values: [35.0, 17.5, 0.0], unit: 'wt%' },
  al2o3: { values: [30.0, 15.0, 0.0], unit: 'wt%' },
  sio2: { values: [50.0, 25.0, 0.0], unit: 'wt%' },
  cao: { values: [20.0, 10.0, 0.0], unit: 'wt%' },
  k: { values: [5000, 2500, 0], unit: 'ppm' },
  th: { values: [20.0, 10.0, 0.0], unit: 'ppm' },
  u: { values: [10.0, 5.0, 0.0], unit: 'ppm' },
  neutron: { values: [200, 150, 100], unit: 'count/s' },
  thermalGrid: { values: [400, 250, 100], unit: 'K' },
  gravity: { values: [600, 0, -600], unit: 'mGal' },
};

function findResourceColor(key: string): string {
  for (const cat of Object.values(RESOURCE_CATEGORIES)) {
    const r = cat.resources.find((res) => res.key === key);
    if (r) return r.color;
  }
  return '#3B82F6';
}

function formatValue(v: number): string {
  if (Math.abs(v) >= 100) return Math.round(v).toString();
  if (Math.abs(v) >= 1) return (Math.round(v * 100) / 100).toString();
  return (Math.round(v * 1000) / 1000).toString();
}

function formatLat(v: number): string {
  return Math.abs(v).toFixed(1) + '°' + (v >= 0 ? 'N' : 'S');
}
function formatLon(v: number): string {
  return Math.abs(v).toFixed(1) + '°' + (v >= 0 ? 'E' : 'W');
}

type CategoryKey = 'general' | 'special' | 'environment';

interface CellInfo {
  latMin: number; latMax: number;
  lonMin: number; lonMax: number;
  value: number; filter: string; unit: string;
}

interface ResourceScannerPanelProps {
  visible: boolean;
  onToggle: () => void;
  onSelectResource: (resourceKey: string) => void;
  activeResource: string | null;
  mineralStats?: { filter: string; min: number; max: number; unit: string } | null;
  mineralDataLoaded?: boolean;
  mineralCellInfo?: CellInfo | null;
  onClearCellInfo?: () => void;
}

export default function ResourceScannerPanel({
  visible,
  onToggle,
  onSelectResource,
  activeResource,
  mineralStats,
  mineralDataLoaded = false,
  mineralCellInfo,
  onClearCellInfo,
}: ResourceScannerPanelProps) {
  const [activeTab, setActiveTab] = useState<CategoryKey>('general');

  const expandAnim = useRef(new Animated.Value(0)).current;
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowPanel(true);
      Animated.spring(expandAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 14 }).start();
    } else {
      Animated.timing(expandAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowPanel(false));
    }
  }, [visible]);

  const category = RESOURCE_CATEGORIES[activeTab];
  const activeColor = activeResource ? findResourceColor(activeResource) : '#3B82F6';

  // 동적 범례
  let legendData: { values: number[]; unit: string } | null = null;
  if (activeResource) {
    if (mineralStats && mineralStats.filter === activeResource) {
      const min = mineralStats.min;
      const max = mineralStats.max;
      const mid = (min + max) / 2;
      const fmt = (v: number) => {
        if (Math.abs(v) >= 100) return Math.round(v);
        if (Math.abs(v) >= 1) return Math.round(v * 10) / 10;
        return Math.round(v * 100) / 100;
      };
      legendData = { values: [fmt(max), fmt(mid), fmt(min)], unit: mineralStats.unit };
    } else if (LEGEND_SCALES[activeResource]) {
      legendData = LEGEND_SCALES[activeResource];
    }
  }

  const panelAnimStyle = {
    opacity: expandAnim,
    transform: [{ scale: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
  };
  const legendAnimStyle = {
    opacity: expandAnim,
    transform: [{ translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  };

  const isDataDependentTab = activeTab === 'general' || activeTab === 'special';
  const isLoading = !mineralDataLoaded && isDataDependentTab;

  // 셀 정보에서 스펙트럼 위 마커 위치 계산 (0~1 비율)
  let valueMarkerRatio: number | null = null;
  if (mineralCellInfo && legendData) {
    const minV = legendData.values[2];
    const maxV = legendData.values[0];
    if (maxV !== minV) {
      valueMarkerRatio = Math.max(0, Math.min(1, (mineralCellInfo.value - minV) / (maxV - minV)));
    }
  }

  return (
    <View style={styles.container} pointerEvents="box-none">

      {/* ════ 접힌 상태: 토글 버튼 ════ */}
      {!visible && !showPanel && (
        <TouchableOpacity style={styles.toggleBtn} onPress={onToggle} activeOpacity={0.7}>
          <MaterialCommunityIcons name="radar" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ════ 펼쳐진 상태 ════ */}
      {showPanel && (
        <>
          <Animated.View style={[styles.expandedPanel, panelAnimStyle]}>
            <View style={styles.panelBg}>

              {/* ── 헤더 ── */}
              <View style={styles.headerRow}>
                <View style={[styles.headerIcon, { backgroundColor: activeColor + '25' }]}>
                  <MaterialCommunityIcons name="radar" size={16} color={activeColor} />
                </View>
                <Text style={styles.titleText}>자원 스캐너</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={onToggle} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>

              {/* ── 로딩 / 탭+칩 ── */}
              {isLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#60A5FA" />
                  <Text style={styles.loadingText}>자원 데이터 로드중...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.tabRow}>
                    {(Object.keys(RESOURCE_CATEGORIES) as CategoryKey[]).map((key) => {
                      const isActive = activeTab === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[styles.tab, isActive && styles.tabActive]}
                          onPress={() => {
                            setActiveTab(key);
                            // 대메뉴 전환 시 해당 카테고리의 첫 번째 자원으로 자동 선택
                            const firstResource = RESOURCE_CATEGORIES[key].resources[0];
                            if (firstResource) {
                              onSelectResource(firstResource.key);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                            {RESOURCE_CATEGORIES[key].label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                    {category.resources.map((resource) => {
                      const isAct = activeResource === resource.key;
                      return (
                        <TouchableOpacity
                          key={resource.key}
                          style={[styles.chip, isAct && { backgroundColor: resource.color + '20', borderColor: resource.color + '60' }]}
                          onPress={() => onSelectResource(resource.key)}
                          activeOpacity={0.6}
                        >
                          <MaterialCommunityIcons name={resource.icon as any} size={14} color={isAct ? resource.color : '#666'} />
                          <Text style={[styles.chipLabel, isAct && { color: resource.color, fontWeight: '700' }]}>
                            {resource.label}{resource.key === 'u' ? ' ≈0.27×Th' : ''}
                          </Text>
                          {isAct && <View style={[styles.chipDot, { backgroundColor: resource.color }]} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}
            </View>
          </Animated.View>

          {/* ════ 하단: 스펙트럼 + 셀 정보 통합 ════ */}
          {activeResource && legendData && (
            <Animated.View style={[styles.bottomBar, legendAnimStyle]}>

              {/* ── 셀 선택 정보 (있을 때만) ── */}
              {mineralCellInfo && (
                <View style={styles.cellInfoSection}>
                  <View style={styles.cellInfoMain}>
                    <Text style={[styles.cellInfoValue, { color: activeColor }]}>
                      {formatValue(mineralCellInfo.value)}
                    </Text>
                    <Text style={styles.cellInfoUnit}>{mineralCellInfo.unit}</Text>
                  </View>
                  <View style={styles.cellInfoCoord}>
                    <View style={styles.coordRow}>
                      <Ionicons name="location-outline" size={10} color="#666" />
                      <Text style={styles.coordText}>
                        {formatLat(mineralCellInfo.latMin)}~{formatLat(mineralCellInfo.latMax)}
                      </Text>
                    </View>
                    <View style={styles.coordRow}>
                      <Ionicons name="compass-outline" size={10} color="#666" />
                      <Text style={styles.coordText}>
                        {formatLon(mineralCellInfo.lonMin)}~{formatLon(mineralCellInfo.lonMax)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={onClearCellInfo} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={14} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                </View>
              )}

              {/* ── 스펙트럼 바 + 마커 ── */}
              <View style={styles.spectrumSection}>
                <Text style={styles.legendVal}>{legendData.values[2]}</Text>
                <View style={styles.gradientBarWrap}>
                  <View style={styles.gradientBarH}>
                    {[...Array(40)].map((_, i) => {
                      const n = i / 39;
                      let hue: number, sat: number, light: number;
                      switch (activeResource) {
                        // ── 일반 자원 (cesiumMaps.js getMineralColor 기준) ──
                        case 'feo':   // 철: 초록(120) → 빨강(0)
                          hue = 120 * (1 - n); sat = 100; light = 45; break;
                        case 'tio2':  // 티타늄: 파랑(240) → 주황(30)
                          hue = 240 - 210 * n; sat = 90; light = 50; break;
                        case 'mgo':   // 마그네슘: 청록(180) → 노랑(60)
                          hue = 180 - 120 * n; sat = 85; light = 45; break;
                        case 'al2o3': // 알루미늄: 파랑(220) → 빨강(0)
                          hue = 220 * (1 - n); sat = 90; light = 50; break;
                        case 'sio2':  // 규소: 남색(250) → 초록(90)
                          hue = 250 - 160 * n; sat = 80; light = 48; break;
                        case 'cao':   // 칼슘: 자주(300) → 노랑(50)
                          hue = 300 - 250 * n; sat = 85; light = 50; break;
                        // ── 특수 자원 ──
                        case 'k':     // 칼륨: 연두(90) → 빨강(0)
                          hue = 90 * (1 - n); sat = 100; light = 42; break;
                        case 'th':    // 토륨: 보라(270) → 노랑(50)
                          hue = 270 - 220 * n; sat = 90; light = 50; break;
                        case 'u':     // 우라늄: 청록(180) → 분홍(330)
                          hue = (180 + 150 * n) % 360; sat = 85; light = 50; break;
                        // ── 환경 (paintHeatmapPixels HSL 무지개) ──
                        case 'neutron':      // 파랑(240) → 빨강(0)
                        case 'thermalGrid':  // 파랑(240) → 빨강(0)
                        case 'gravity':      // 파랑(240) → 빨강(0)
                          hue = 240 * (1 - n); sat = 100; light = 50; break;
                        default:
                          hue = 240 * (1 - n); sat = 100; light = 50; break;
                      }
                      return <View key={i} style={{ flex: 1, backgroundColor: `hsl(${hue}, ${sat}%, ${light}%)` }} />;
                    })}
                  </View>
                  {/* 값 위치 마커 (▲) */}
                  {valueMarkerRatio !== null && (
                    <View style={[styles.markerWrap, { left: `${valueMarkerRatio * 100}%` as any }]}>
                      <View style={styles.markerTriangle} />
                    </View>
                  )}
                </View>
                <Text style={styles.legendVal}>{legendData.values[0]}</Text>
              </View>
              <Text style={styles.legendUnitText}>{legendData.unit}</Text>
            </Animated.View>
          )}
        </>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 8,
  },
  toggleBtn: {
    position: 'absolute', top: 12, left: 12, width: 46, height: 46,
    borderRadius: 8, backgroundColor: '#2A2D3E',
    justifyContent: 'center', alignItems: 'center',
  },

  /* ── 패널 ── */
  expandedPanel: {
    position: 'absolute', top: 12, left: 12, right: 72,
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
    transformOrigin: 'left top',
  },
  panelBg: {
    backgroundColor: 'rgba(10, 12, 24, 0.95)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  headerIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  titleText: { color: '#eee', fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },

  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  loadingText: { color: '#60A5FA', fontSize: 12, fontWeight: '600' },

  tabRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(59,130,246,0.25)' },
  tabText: { color: '#777', fontSize: 11, fontWeight: '600' },
  tabTextActive: { color: '#93C5FD' },

  chipScroll: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 4,
  },
  chipLabel: { color: '#999', fontSize: 11, fontWeight: '500' },
  chipDot: { width: 5, height: 5, borderRadius: 3, marginLeft: 1 },

  /* ── 하단 통합 바 ── */
  bottomBar: {
    position: 'absolute', bottom: 28, left: 20, right: 20,
    backgroundColor: 'rgba(8,12,24,0.92)',
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },

  /* ── 셀 정보 ── */
  cellInfoSection: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 2,
  },
  cellInfoMain: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
  },
  cellInfoValue: {
    fontSize: 22, fontWeight: '800', letterSpacing: -0.5,
  },
  cellInfoUnit: {
    fontSize: 11, color: '#888', fontWeight: '600',
  },
  cellInfoCoord: {
    flex: 1, gap: 2,
  },
  coordRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  coordText: {
    fontSize: 10, color: '#666', fontWeight: '500', letterSpacing: 0.2,
  },

  /* ── 스펙트럼 바 ── */
  spectrumSection: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  gradientBarWrap: {
    flex: 1, position: 'relative' as any,
  },
  gradientBarH: {
    height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row',
  },
  markerWrap: {
    position: 'absolute', top: -5, marginLeft: -4,
  },
  markerTriangle: {
    width: 0, height: 0,
    borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 5,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#fff',
  },
  legendVal: { color: '#bbb', fontSize: 10, fontWeight: '600' },
  legendUnitText: { color: '#666', fontSize: 9, textAlign: 'center' as any },
});
