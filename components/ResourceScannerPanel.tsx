import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

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

type CategoryKey = 'general' | 'special' | 'environment';

interface ResourceScannerPanelProps {
  visible: boolean;
  onToggle: () => void;
  onSelectResource: (resourceKey: string) => void;
  activeResource: string | null;
  mineralStats?: { filter: string; min: number; max: number; unit: string } | null;
  mineralDataLoaded?: boolean;
}

export default function ResourceScannerPanel({
  visible,
  onToggle,
  onSelectResource,
  activeResource,
  mineralStats,
  mineralDataLoaded = false,
}: ResourceScannerPanelProps) {
  const [activeTab, setActiveTab] = useState<CategoryKey>('general');

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

  return (
    <View style={styles.container} pointerEvents="box-none">

      {/* ════ 접힌 상태: 토글 버튼만 ════ */}
      {!visible ? (
        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="radar" size={22} color="#fff" />
        </TouchableOpacity>
      ) : (
        <>
          {/* ════ 펼쳐진 상태: 버튼+패널 통합 ════ */}
          <View style={styles.expandedPanel}>
            <BlurView intensity={80} tint="dark" style={styles.panelBlur}>

              {/* Row 1: 레이더 아이콘 + 제목 + 탭 + 닫기 */}
              <View style={styles.topRow}>
                <TouchableOpacity
                  style={[styles.headerIcon, { backgroundColor: activeColor + '25' }]}
                  onPress={onToggle}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="radar" size={16} color={activeColor} />
                </TouchableOpacity>
                <Text style={styles.titleText}>자원 스캐너</Text>

                <View style={styles.miniTabs}>
                  {(Object.keys(RESOURCE_CATEGORIES) as CategoryKey[]).map((key) => {
                    const isActive = activeTab === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.miniTab, isActive && styles.miniTabActive]}
                        onPress={() => setActiveTab(key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.miniTabText, isActive && styles.miniTabTextActive]}>
                          {RESOURCE_CATEGORIES[key].label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={onToggle}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
              </View>

              {/* Row 2: 자원 칩 */}
              {!mineralDataLoaded && (activeTab === 'general' || activeTab === 'special') ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#60A5FA" />
                  <Text style={styles.loadingText}>자원 데이터 로드중...</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}
                >
                  {category.resources.map((resource) => {
                    const isActive = activeResource === resource.key;
                    return (
                      <TouchableOpacity
                        key={resource.key}
                        style={[
                          styles.chip,
                          isActive && {
                            backgroundColor: resource.color + '20',
                            borderColor: resource.color + '60',
                          },
                        ]}
                        onPress={() => onSelectResource(resource.key)}
                        activeOpacity={0.6}
                      >
                        <MaterialCommunityIcons
                          name={resource.icon as any}
                          size={14}
                          color={isActive ? resource.color : '#666'}
                        />
                        <Text style={[styles.chipLabel, isActive && { color: resource.color, fontWeight: '700' }]}>
                          {resource.label}{resource.key === 'u' ? ' ≈0.27×Th' : ''}
                        </Text>
                        {isActive && (
                          <View style={[styles.chipDot, { backgroundColor: resource.color }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

            </BlurView>
          </View>

          {/* ════ 하단 중앙: 가로 스펙트럼 범례 ════ */}
          {activeResource && legendData && (
            <View style={styles.legendFloat}>
              <View style={styles.legendHRow}>
                {/* 값 라벨: min */}
                <Text style={styles.legendVal}>{legendData.values[2]}</Text>
                {/* 가로 그라데이션 바 — 각 광물 실제 HSL 공식 사용 */}
                <View style={styles.gradientBarH}>
                  {[...Array(40)].map((_, i) => {
                    const n = i / 39; // normalized 0→1 (min→max)
                    let hue: number, sat: number, light: number;
                    switch (activeResource) {
                      case 'u':
                        hue = (260 - 200 * n); sat = 90; light = 50; break;
                      case 'th':
                        hue = 240 * (1 - n); sat = 100; light = 50; break;
                      case 'k':
                        hue = 120 * (1 - n); sat = 100; light = 45; break;
                      case 'feo':
                        hue = 180 * (1 - n); sat = 100; light = 45; break;
                      case 'tio2':
                        hue = 180 + 120 * n; sat = 90; light = 50; break;
                      default:
                        hue = 240 * (1 - n); sat = 100; light = 50; break;
                    }
                    return (
                      <View
                        key={i}
                        style={{ flex: 1, backgroundColor: `hsl(${hue}, ${sat}%, ${light}%)` }}
                      />
                    );
                  })}
                </View>
                {/* 값 라벨: max */}
                <Text style={styles.legendVal}>{legendData.values[0]}</Text>
              </View>
              <Text style={styles.legendUnitText}>{legendData.unit}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
  },

  /* ── 접힌 상태: 토글 버튼 ── */
  toggleBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── 펼쳐진 상태: 통합 패널 ── */
  expandedPanel: {
    position: 'absolute',
    top: 12,
    left: 12,
    maxWidth: SCREEN_W - 82,
    borderRadius: 21,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  panelBlur: {
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 21,
    overflow: 'hidden',
  },

  /* Row 1 */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    color: '#eee',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginRight: 2,
  },
  miniTabs: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  miniTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  miniTabActive: {
    backgroundColor: 'rgba(59,130,246,0.25)',
  },
  miniTabText: {
    color: '#777',
    fontSize: 11,
    fontWeight: '600',
  },
  miniTabTextActive: {
    color: '#93C5FD',
  },

  /* Row 2: 칩 */
  chipScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  chipLabel: {
    color: '#999',
    fontSize: 11,
    fontWeight: '500',
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginLeft: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
  },

  /* ── 하단 중앙: 가로 스펙트럼 범례 ── */
  legendFloat: {
    position: 'absolute',
    bottom: 28,
    left: 40,
    right: 40,
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(8,12,24,0.85)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  legendHRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%' as any,
  },
  gradientBarH: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  legendVal: {
    color: '#bbb',
    fontSize: 10,
    fontWeight: '600',
  },
  legendUnitText: {
    color: '#666',
    fontSize: 9,
    marginTop: 1,
  },
});
