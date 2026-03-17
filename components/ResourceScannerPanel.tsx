import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
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

function findResourceLabel(key: string): string {
  for (const cat of Object.values(RESOURCE_CATEGORIES)) {
    const r = cat.resources.find((res) => res.key === key);
    if (r) return r.label;
  }
  return key;
}

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
  onClose: () => void;
  onSelectResource: (resourceKey: string) => void;
  activeResource: string | null;
}

export default function ResourceScannerPanel({
  visible,
  onClose,
  onSelectResource,
  activeResource,
}: ResourceScannerPanelProps) {
  const [activeTab, setActiveTab] = useState<CategoryKey>('general');

  if (!visible) return null;

  const category = RESOURCE_CATEGORIES[activeTab];
  const legendData = activeResource ? LEGEND_SCALES[activeResource] : null;
  const activeColor = activeResource ? findResourceColor(activeResource) : '#3B82F6';

  return (
    <View style={styles.container} pointerEvents="box-none">

      {/* ════ 좌측: 세로 범례 (자원 선택 시만) ════ */}
      {activeResource && legendData && (
        <View style={styles.legendFloat}>
          {/* 세로 그라데이션 바 */}
          <View style={styles.gradientBarV}>
            {[...Array(24)].map((_, i) => {
              const hue = (i / 23) * 240;
              return (
                <View
                  key={i}
                  style={{ flex: 1, backgroundColor: `hsl(${hue}, 100%, 50%)` }}
                />
              );
            })}
          </View>
          {/* 값 라벨 */}
          <View style={styles.legendLabels}>
            {legendData.values.map((val, i) => (
              <Text key={i} style={styles.legendVal}>{val}</Text>
            ))}
          </View>
          {/* 단위 */}
          <Text style={styles.legendUnitText}>{legendData.unit}</Text>
        </View>
      )}

      {/* ════ 하단 플로팅 패널 ════ */}
      <View style={styles.bottomPanel}>
        <BlurView intensity={80} tint="dark" style={styles.panelBlur}>

          {/* Row 1: 타이틀 + 탭 + 닫기 */}
          <View style={styles.topRow}>
            {/* 아이콘 + 제목 */}
            <View style={styles.titleGroup}>
              <View style={[styles.titleIcon, { backgroundColor: activeColor + '25' }]}>
                <MaterialCommunityIcons name="radar" size={14} color={activeColor} />
              </View>
              <Text style={styles.titleText}>자원 스캐너</Text>
            </View>

            {/* 미니 탭 */}
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

            {/* 닫기 */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </View>

          {/* Row 2: 자원 칩 (가로 스크롤) */}
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
                      borderColor: resource.color + '80',
                    },
                  ]}
                  onPress={() => onSelectResource(resource.key)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={resource.icon as any}
                    size={14}
                    color={isActive ? resource.color : '#666'}
                  />
                  <Text
                    style={[
                      styles.chipLabel,
                      isActive && { color: resource.color, fontWeight: '700' },
                    ]}
                  >
                    {resource.label}
                  </Text>
                  {isActive && (
                    <View style={[styles.chipDot, { backgroundColor: resource.color }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

        </BlurView>
      </View>
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

  /* ── 하단 플로팅 패널 ── */
  bottomPanel: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    right: 12,
    borderRadius: 16,
    overflow: 'hidden',
    // 그림자
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  panelBlur: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    overflow: 'hidden',
  },

  /* Row 1 */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  titleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    color: '#eee',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  miniTabs: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  miniTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
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
  closeBtn: {
    paddingLeft: 4,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 5,
  },
  chipLabel: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginLeft: 2,
  },

  /* ── 좌측 세로 범례 (플로팅) ── */
  legendFloat: {
    position: 'absolute',
    left: 14,
    bottom: 130,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(8,12,24,0.85)',
    borderRadius: 10,
    padding: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gradientBarV: {
    width: 10,
    height: 70,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  legendLabels: {
    marginTop: 2,
    gap: 0,
    alignItems: 'center',
  },
  legendVal: {
    color: '#bbb',
    fontSize: 9,
    lineHeight: 13,
  },
  legendUnitText: {
    color: '#666',
    fontSize: 8,
    marginTop: 1,
  },
});
