import React, { useRef, useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Dimensions, ActivityIndicator, ScrollView, Switch, TextInput, Modal, Animated, PanResponder } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, router } from 'expo-router';
import { createCesiumHtml } from '@/constants/cesium/CesiumHtml';
import { loadMineralData } from '@/utils/mineralDataLoader';
import AR2MoonViewer from '@/components/AR2MoonViewer';
import OccupationStatusPanel from '@/components/OccupationStatusPanel';
import AIZoneRecommendModal from '@/components/AIZoneRecommendModal';
import ResourceScannerPanel from '@/components/ResourceScannerPanel';
import ExplorationListPanel, { PANEL_SCREEN_H, SNAP_MIN, SNAP_MAX } from '@/components/ExplorationListPanel';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { LIVE_MISSIONS, Spacecraft } from '@/constants/SpacecraftData';
import { fetchSpacecraftPosition, fetchSpacecraftTrajectory } from '@/services/HorizonsApi';
import { LANDING_SITES, LandingSite, sortByYear, sortByCountry, findNearbySites, getContactColor, COUNTRY_NAMES } from '@/constants/LandingSiteData';
import { LUNAR_FEATURES, LunarFeature, sortByType, sortBySize, getFeatureTypeColor, getFeatureTypeEmoji, formatArea, isFarSide } from '@/constants/LunarFeatureData';
import { addScrapArea, removeScrapArea, isAreaScrapped } from '@/constants/scrapStore';

export default function MoonScreen() {
  const webviewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  // 모드 상태 추가
  const [mainMode, setMainMode] = useState<'exploration' | 'occupation' | 'occupation2' | 'occupation3'>('exploration');
  const isOccupation = mainMode === 'occupation' || mainMode === 'occupation2' || mainMode === 'occupation3';
  const [subMode, setSubMode] = useState<'space' | 'firstPerson'>('space');
  const [canGoBack, setCanGoBack] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLocation, setActiveLocation] = useState<string | null>(null);

  // AI 땅 추천 상태
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [cellExpanded, setCellExpanded] = useState(false);
  const [showOccupyConfirm, setShowOccupyConfirm] = useState(false);
  const [occupySelectLevel, setOccupySelectLevel] = useState(16);
  const [magBalance, setMagBalance] = useState(40);
  const [magCost, setMagCost] = useState(0);

  // 바텀시트 드래그
  const SHEET_MAX_HEIGHT = 420;
  const SHEET_PEEK_HEIGHT = 145;
  const SHEET_COLLAPSE = SHEET_MAX_HEIGHT - SHEET_PEEK_HEIGHT; // 310
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetOffset = useRef(0);
  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((v) => { sheetOffset.current = v; });
      },
      onPanResponderMove: (_, g) => {
        const newVal = Math.max(0, Math.min(SHEET_COLLAPSE, sheetOffset.current + g.dy));
        sheetTranslateY.setValue(newVal);
      },
      onPanResponderRelease: (_, g) => {
        const cur = sheetOffset.current + g.dy;
        const target = cur > SHEET_COLLAPSE / 2 ? SHEET_COLLAPSE : 0;
        Animated.spring(sheetTranslateY, { toValue: target, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
        sheetOffset.current = target;
      },
    })
  ).current;

  // 탐사 모드(Exploration) 동적 상태 및 위성 선택 상태
  // 위성 상세 패널: ExplorationListPanel과 정확히 동일한 공유 상수 (top값)
  const SAT_PANEL_COLLAPSED = SNAP_MIN; // top=80% (높이 20%)
  const SAT_PANEL_EXPANDED = SNAP_MAX;  // top=40% (높이 60%)
  const satPanelAnim = useRef(new Animated.Value(SAT_PANEL_COLLAPSED)).current;
  const satPanelOffsetRef = useRef(SAT_PANEL_COLLAPSED);
  const satPanelPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        const newVal = Math.max(SAT_PANEL_EXPANDED, Math.min(SAT_PANEL_COLLAPSED, satPanelOffsetRef.current + g.dy));
        satPanelAnim.setValue(newVal);
      },
      onPanResponderRelease: (_, g) => {
        const cur = satPanelOffsetRef.current + g.dy;
        const mid = (SAT_PANEL_COLLAPSED + SAT_PANEL_EXPANDED) / 2;
        const target = cur > mid ? SAT_PANEL_COLLAPSED : SAT_PANEL_EXPANDED;
        Animated.spring(satPanelAnim, { toValue: target, useNativeDriver: false, bounciness: 4, speed: 14 }).start();
        satPanelOffsetRef.current = target;
      },
    })
  ).current;

  // 착륙지 상세 패널 드래그
  const landingPanelAnim = useRef(new Animated.Value(SNAP_MIN)).current;
  const landingPanelOffsetRef = useRef(SNAP_MIN);
  const landingPanelPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        landingPanelAnim.stopAnimation((val) => { landingPanelOffsetRef.current = val; });
      },
      onPanResponderMove: (_, g) => {
        const newVal = Math.max(SNAP_MAX, Math.min(SNAP_MIN, landingPanelOffsetRef.current + g.dy));
        landingPanelAnim.setValue(newVal);
      },
      onPanResponderRelease: (_, g) => {
        const cur = landingPanelOffsetRef.current + g.dy;
        const mid = (SNAP_MIN + SNAP_MAX) / 2;
        const target = cur > mid ? SNAP_MIN : SNAP_MAX;
        Animated.spring(landingPanelAnim, { toValue: target, useNativeDriver: false, bounciness: 4, speed: 14 }).start();
        landingPanelOffsetRef.current = target;
      },
    })
  ).current;

  // 대표 지형 상세 패널 드래그
  const featurePanelAnim = useRef(new Animated.Value(SNAP_MIN)).current;
  const featurePanelOffsetRef = useRef(SNAP_MIN);
  const featurePanelPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        featurePanelAnim.stopAnimation((val) => { featurePanelOffsetRef.current = val; });
      },
      onPanResponderMove: (_, g) => {
        const newVal = Math.max(SNAP_MAX, Math.min(SNAP_MIN, featurePanelOffsetRef.current + g.dy));
        featurePanelAnim.setValue(newVal);
      },
      onPanResponderRelease: (_, g) => {
        const cur = featurePanelOffsetRef.current + g.dy;
        const mid = (SNAP_MIN + SNAP_MAX) / 2;
        const target = cur > mid ? SNAP_MIN : SNAP_MAX;
        Animated.spring(featurePanelAnim, { toValue: target, useNativeDriver: false, bounciness: 4, speed: 14 }).start();
        featurePanelOffsetRef.current = target;
      },
    })
  ).current;
  const [selectedSatellite, setSelectedSatellite] = useState<any>(null);
  const satIsLookAt = useRef(false);
  const landingIsFirstPerson = useRef(false);
  const featureIsFirstPerson = useRef(false);
  const [showAR2Viewer, setShowAR2Viewer] = useState(false);
  const [showTempMap, setShowTempMap] = useState(false);
  const [showThermalGrid, setShowThermalGrid] = useState(false);
  const [showGravityMap, setShowGravityMap] = useState(false);
  const [gravityRange, setGravityRange] = useState({ min: -600, max: 600 });
  const [gravityGridMode, setGravityGridMode] = useState(false);
  const [showNeutronMap, setShowNeutronMap] = useState(false);
  const [neutronRange, setNeutronRange] = useState({ min: 100, max: 200 });
  const [neutronGridMode, setNeutronGridMode] = useState(false);
  const [isDayTemp, setIsDayTemp] = useState(true);
  const [showOptions, setShowOptions] = useState(false); // New Options Menu State
  const [currentZoomLevel, setCurrentZoomLevel] = useState(0);
  const [selectionDepth, setSelectionDepth] = useState(0);
  const MAX_ZOOM_LEVEL = 4;

  // 부가기능 패널 상태
  const [showFeaturePanel, setShowFeaturePanel] = useState(false);
  const [featureListView, setFeatureListView] = useState<'none' | 'landing' | 'terrain' | 'satellite'>('none');

  // 자원 스캐너 상태
  const [showResourceScanner, setShowResourceScanner] = useState(false);
  const [activeScannedResource, setActiveScannedResource] = useState<string | null>(null);
  const [showLandingSites, setShowLandingSites] = useState(false);
  const [showTerrain, setShowTerrain] = useState(false);
  const [showSatellites, setShowSatellites] = useState(false);
  // 광물 동적 범위 (히트맵 실제 min/max)
  const [mineralStats, setMineralStats] = useState<{ filter: string; min: number; max: number; unit: string } | null>(null);
  // 광물 셀 클릭 정보
  const [mineralCellInfo, setMineralCellInfo] = useState<{ latMin: number; latMax: number; lonMin: number; lonMax: number; value: number; filter: string; unit: string } | null>(null);
  // 광물 데이터 로딩 완료 여부
  const [mineralDataLoaded, setMineralDataLoaded] = useState(false);

  const [landmarkListData, setLandmarkListData] = useState<any>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<any>(null);
  const [selectedLandingSite, setSelectedLandingSite] = useState<LandingSite | null>(null);
  const [landingSiteDetailMode, setLandingSiteDetailMode] = useState<'detail' | 'view' | 'occupation'>('detail');
  const [landingSortMode, setLandingSortMode] = useState<'year' | 'country'>('year');
  const sortedLandingSites = useMemo(() => {
    return landingSortMode === 'year' ? sortByYear(LANDING_SITES) : sortByCountry(LANDING_SITES);
  }, [landingSortMode]);

  // ═══ 대표 지형 ═══
  const [selectedFeature, setSelectedFeature] = useState<LunarFeature | null>(null);
  const [featureDetailMode, setFeatureDetailMode] = useState<'detail' | 'view' | 'occupation'>('detail');
  const [featureSortMode, setFeatureSortMode] = useState<'type' | 'size'>('type');
  const sortedFeatures = useMemo(() => {
    return featureSortMode === 'type' ? sortByType(LUNAR_FEATURES) : sortBySize(LUNAR_FEATURES);
  }, [featureSortMode]);



  // ═══ Phase 2: GLB 모델 (+5초) ═══
  // 달 3D 타일 렌더링 안정화 후 모델 주입
  const glbLoadedRef = useRef(false);
  useEffect(() => {
    if (loading || glbLoadedRef.current) return;
    const timer = setTimeout(() => {
      glbLoadedRef.current = true;
      console.log('[Phase 2] GLB model loading started');
      (async () => {
        try {
          const apolloAsset = await Asset.fromModule(require('../../assets/3d/apollo11.glb')).downloadAsync();
          if (apolloAsset.localUri) {
            const b64 = await FileSystem.readAsStringAsync(apolloAsset.localUri, { encoding: FileSystem.EncodingType.Base64 });
            const uri = 'data:model/gltf-binary;base64,' + b64;
            webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_MODEL_URI', model: 'apollo', uri }));
            console.log('[Phase 2] Apollo GLB injected');
          }
        } catch (e) { console.warn('Apollo GLB load error:', e); }
        try {
          const danuriAsset = await Asset.fromModule(require('../../assets/3d/danuri.glb')).downloadAsync();
          if (danuriAsset.localUri) {
            const b64 = await FileSystem.readAsStringAsync(danuriAsset.localUri, { encoding: FileSystem.EncodingType.Base64 });
            const uri = 'data:model/gltf-binary;base64,' + b64;
            webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_MODEL_URI', model: 'danuri', uri }));
            console.log('[Phase 2] Danuri GLB injected');
          }
        } catch (e) { console.warn('Danuri GLB load error:', e); }
        console.log('[Phase 2] GLB model loading completed');
      })();
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  // 텔레메트리 (카메라/탐사 데이터) 상태
  const [telemetry, setTelemetry] = useState<{ lat: string, lon: string, alt: string, heading: string, pitch: string } | null>(null);

  // 위성 데이터 상태 추가
  const [satelliteData, setSatelliteData] = useState<any[]>([]);
  const [isLoadingSatellite, setIsLoadingSatellite] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // 필터 상태
  const [filters, setFilters] = useState({
    apollo: false,
    artemis: false,
    // 핵심 자원 (Major Oxides)
    feo: false,      // 철 (FeO)
    tio2: false,     // 티타늄 (TiO2)
    mgo: false,      // 마그네슘 (MgO)
    al2o3: false,    // 알루미늄 (Al2O3)
    sio2: false,     // 규소 (SiO2)
    cao: false,      // 칼슘 (CaO)
    // 희귀 원소 (Trace Elements)
    k: false,        // 칼륨 (K)
    th: false,       // 토륨 (Th)
    u: false,        // 우라늄 (U)
    // 물리 지표 (Physical Props)
    am: false,       // 원자 질량
    neutron: false,  // 중성자 밀도
  });

  // 광물 레이어 투명도
  const [mineralOpacity, setMineralOpacity] = useState(0.6);

  // 활성화된 광물 필터 추적
  const [activeMineralFilter, setActiveMineralFilter] = useState<string | null>(null);

  // 광물별 범위 정의
  const mineralRanges: Record<string, { min: number; max: number; unit: string; name: string }> = {
    feo: { min: 0, max: 25, unit: 'wt%', name: '철 (FeO)' },
    tio2: { min: 0, max: 15, unit: 'wt%', name: '티타늄 (TiO2)' },
    mgo: { min: 0, max: 35, unit: 'wt%', name: '마그네슘 (MgO)' },
    al2o3: { min: 0, max: 30, unit: 'wt%', name: '알루미늄 (Al2O3)' },
    sio2: { min: 0, max: 50, unit: 'wt%', name: '규소 (SiO2)' },
    cao: { min: 0, max: 20, unit: 'wt%', name: '칼슘 (CaO)' },
    k: { min: 0, max: 5000, unit: 'ppm', name: '칼륨 (K)' },
    th: { min: 0, max: 20, unit: 'ppm', name: '토륨 (Th)' },
    u: { min: 0, max: 10, unit: 'ppm', name: '우라늄 (U)' },
    am: { min: 20, max: 25, unit: 'g/mol', name: '원자 질량' },
    neutron: { min: 0, max: 1, unit: 'g/cm³', name: '중성자 밀도' },
  };


  // 유명 좌표 데이터
  const famousLocations = [
    { id: 'mare-serenitatis', name: '고요의 바다', lat: 28.0, lng: 17.5 },
    { id: 'oceanus-procellarum', name: '폭풍의 대양', lat: 18.4, lng: -57.4 },
    { id: 'tycho', name: '티코 분지구', lat: -43.3, lng: -11.2 },
  ];

  // ═══ Phase 3: 광물 데이터 (+8초) ═══
  useEffect(() => {
    if (loading) return;
    const loadData = async () => {
      try {
        console.log('[Phase 3] Mineral data loading started');
        const data = await loadMineralData();
        console.log('[Phase 3] Mineral data parsed:', data.length, 'entries');

        const chunkSize = 1000;
        const totalChunks = Math.ceil(data.length / chunkSize);
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const chunkIndex = i / chunkSize;
          setTimeout(() => {
            webviewRef.current?.postMessage(JSON.stringify({
              type: 'LOAD_MINERAL_DATA',
              data: chunk,
              isFirst: i === 0,
              isLast: i + chunkSize >= data.length
            }));
            // 마지막 청크 전송 후 로드 완료 표시
            if (i + chunkSize >= data.length) {
              console.log('[Phase 3] Mineral data loading completed (all chunks sent)');
              setMineralDataLoaded(true);
            }
          }, 100 * chunkIndex);
        }
      } catch (error) {
        console.error('[Phase 3] Error loading mineral data:', error);
      }
    };

    const timer = setTimeout(loadData, 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  // ═══ 광물 데이터 로드 완료 후, 이미 선택된 자원이 있으면 히트맵 재활성화 ═══
  useEffect(() => {
    if (mineralDataLoaded && activeScannedResource) {
      const mineralKeys = ['feo', 'tio2', 'mgo', 'al2o3', 'sio2', 'cao', 'k', 'th', 'u'];
      if (mineralKeys.includes(activeScannedResource)) {
        console.log('[Phase 3] Re-activating mineral filter after data load:', activeScannedResource);
        // 약간의 지연을 두어 WebView가 데이터를 완전히 처리한 뒤 필터 활성화
        setTimeout(() => {
          webviewRef.current?.postMessage(JSON.stringify({
            type: 'UPDATE_MINERAL_FILTER',
            filter: activeScannedResource,
            enabled: true
          }));
        }, 300);
      }
    }
  }, [mineralDataLoaded]);

  // 온도 맵 이미지 base64 변환 및 WebView 전달
  useEffect(() => {
    const loadTempMapImage = async () => {
      try {
        const asset = Asset.fromModule(require('@/assets/images/moon_avg_temp.webp'));
        await asset.downloadAsync();
        if (asset.localUri) {
          const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
            encoding: 'base64',
          });
          const dataUri = `data:image/webp;base64,${base64}`;
          webviewRef.current?.postMessage(JSON.stringify({
            type: 'LOAD_TEMP_MAP_IMAGE',
            data: dataUri,
          }));
        }
      } catch (error) {
        console.error('Error loading temp map image:', error);
      }
    };

    // 격자 온도 데이터 CSV 로드 및 전달
    const loadThermalGridData = async () => {
      try {
        // Use relative path matching mineralDataLoader pattern
        const asset = Asset.fromModule(require('../../assets/moon_thermal_1deg_grid.csv'));
        await asset.downloadAsync();

        if (asset.localUri) {
          // Use fetch like mineralDataLoader for consistency
          const response = await fetch(asset.localUri);
          const csvContent = await response.text();

          webviewRef.current?.postMessage(JSON.stringify({
            type: 'LOAD_THERMAL_GRID_DATA',
            data: csvContent,
          }));
        }
      } catch (error) {
        console.error('Error loading thermal grid csv:', error);
      }
    };

    // 중력 이상 데이터 CSV 로드 및 전달
    const loadGravityData = async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/moon_underground_gravity_1deg.csv'));
        await asset.downloadAsync();

        if (asset.localUri) {
          const response = await fetch(asset.localUri);
          const csvContent = await response.text();

          webviewRef.current?.postMessage(JSON.stringify({
            type: 'LOAD_GRAVITY_DATA',
            data: csvContent,
          }));
          console.log('Gravity data sent to WebView');
        }
      } catch (error) {
        console.error('Error loading gravity csv:', error);
      }
    };

    // 중성자 데이터 CSV 로드 및 전달
    const loadNeutronData = async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/moon_hydrogen_heatmap_final.csv'));
        await asset.downloadAsync();
        if (asset.localUri) {
          const response = await fetch(asset.localUri);
          const csvContent = await response.text();
          webviewRef.current?.postMessage(JSON.stringify({
            type: 'LOAD_NEUTRON_DATA',
            data: csvContent,
          }));
          console.log('Neutron data sent to WebView');
        }
      } catch (error) {
        console.error('Error loading neutron csv:', error);
      }
    };

    // ═══ Phase 4: CSV 데이터 (+12초) ═══
    if (!loading) {
      const timer = setTimeout(() => {
        console.log('[Phase 4] CSV data loading started');
        loadTempMapImage();
        loadThermalGridData();
        loadGravityData();
        loadNeutronData();
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // URL 파라미터 처리 (좌표 이동)
  const params = useLocalSearchParams();
  useEffect(() => {
    if (!loading && params.lat && params.lng) {
      const lat = parseFloat(params.lat as string);
      const lng = parseFloat(params.lng as string);
      console.log('Received params location:', lat, lng);

      // 약간의 지연 후 이동 (WebView 완전 로드 보장)
      setTimeout(() => {
        webviewRef.current?.postMessage(JSON.stringify({
          type: 'GO_TO_LOCATION',
          payload: { lat, lng }
        }));
      }, 1000);
    }
  }, [loading, params.lat, params.lng]);

  // magBalance를 WebView에 동기화
  useEffect(() => {
    if (!loading) {
      webviewRef.current?.postMessage(JSON.stringify({
        type: 'UPDATE_MAG_BALANCE',
        payload: { balance: magBalance }
      }));
    }
  }, [magBalance, loading]);


  // WebView 메시지 핸들러
  const handleWebViewMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      // TELEMETRY_UPDATE는 0.25초마다 오므로 로그 제외
      if (message.type !== 'TELEMETRY_UPDATE') {
        console.log('Message from WebView:', message);
      }

      switch (message.type) {
        // case 'DEBUG_LOG' removed as requested
        case 'CELL_SELECTED':
          console.log('[WebView] CELL_SELECTED:', message.payload);
          setSelectedCell(message.payload);
          setCellExpanded(false);
          setMagCost(message.payload.magCount || message.payload.cellCount || 1);
          // 점유모드2/3에서는 시트를 접힌 상태로 시작
          if (mainMode === 'occupation2' || mainMode === 'occupation3') {
            sheetTranslateY.setValue(SHEET_COLLAPSE);
            sheetOffset.current = SHEET_COLLAPSE;
          } else {
            sheetTranslateY.setValue(0);
            sheetOffset.current = 0;
          }
          break;
        case 'CELL_DESELECTED':
          setSelectedCell(null);
          setCellExpanded(false);
          break;
        case 'MAG_EXCEEDED':
          {
            const { Alert: RNAlert } = require('react-native');
            RNAlert.alert('Mag 부족', '보유 Mag가 부족합니다!\n현재 잔액: ' + magBalance + ' Mag');
          }
          break;
        case 'SATELLITE_SELECTED':
          console.log('[WebView] SATELLITE_SELECTED:', message.payload);
          // satelliteData에서 전체 정보 찾아서 설정
          const satName = message.payload?.name;
          if (satName && satelliteData.length > 0) {
            const fullSatData = satelliteData.find(s => s.name === satName);
            if (fullSatData) {
              setSelectedSatellite(fullSatData);
            } else {
              // fallback: payload 그대로 사용
              setSelectedSatellite(message.payload);
            }
          } else {
            setSelectedSatellite(message.payload);
          }
          break;
        case 'SATELLITE_DESELECTED':
          setSelectedSatellite(null);
          break;
        case 'DEPTH_CHANGED':
          setCanGoBack(message.payload.canGoBack);
          setSelectionDepth(message.payload.depth || 0);
          break;
        case 'ZOOM_LEVEL_CHANGED':
          setCurrentZoomLevel(message.payload.currentLevel);
          break;
        case 'TELEMETRY_UPDATE':
          setTelemetry(message.payload);
          break;
        case 'GRAVITY_RANGE':
          setGravityRange(message.payload);
          break;
        case 'NEUTRON_RANGE':
          setNeutronRange(message.payload);
          break;
        case 'LANDMARK_SELECTED':
          setSelectedLandmark(message.payload);
          break;
        case 'LANDMARK_LIST':
          setLandmarkListData(message.payload);
          break;
        case 'GRID_VISIBILITY_CHANGED':
          setShowGrid(message.payload.visible);
          break;
        case 'MINERAL_STATS':
          setMineralStats(message.payload);
          break;
        case 'MINERAL_CELL_INFO':
          setMineralCellInfo(message.payload);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  // 컨트롤 핸들러 — 탐사/점유 완전 독립
  const handleZoomIn = () => {
    if (mainMode === 'exploration') {
      // 탐사모드: 레벨 제한 없이 절대값 줌인
      webviewRef.current?.postMessage(JSON.stringify({ type: 'EXPLORE_ZOOM_IN' }));
    } else {
      // 점유모드: 화면 중앙 셀을 선택하여 뎁스 진입 (최대 3단계까지)
      if (selectionDepth >= 3) return; // 3단계 이상이면 + 무시
      webviewRef.current?.postMessage(JSON.stringify({ type: 'SELECT_CENTER_CELL' }));
    }
  };

  const handleZoomOut = () => {
    if (mainMode === 'exploration') {
      // 탐사모드: 레벨 제한 없이 절대값 줌아웃
      webviewRef.current?.postMessage(JSON.stringify({ type: 'EXPLORE_ZOOM_OUT' }));
    } else {
      // 점유모드: 이전 단계로 돌아감 (selectionStack pop)
      if (selectionDepth <= 0) return; // 초기화면이면 - 무시
      webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_BACK' }));
    }
  };

  const handleReset = () => {
    webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
  };

  const handleBack = () => {
    if (selectedCell) {
      // 3단계 셀 선택 상태: selectionStack은 유지, 셀 선택만 해제
      setSelectedCell(null);
      // WebView에 셀 선택 해제 + 격자 재렌더 요청
      webviewRef.current?.postMessage(JSON.stringify({ type: 'DESELECT_CELL' }));
    } else {
      // 일반 뒤로가기: selectionStack pop
      webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_BACK' }));
    }
  };

  const toggleOptions = () => {
    setShowOptions(!showOptions);
  };

  // 탐사 모드로 전환 시 열려있는 모든 오버레이/옵션 초기화
  useEffect(() => {
    if (mainMode === 'exploration') {
      setShowOptions(false);
      setShowFilterModal(false);

      if (showGrid) {
        setShowGrid(false);
        webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_GRID_VISIBILITY', visible: false }));
      }
      if (showThermalGrid) {
        setShowThermalGrid(false);
        webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_THERMAL_GRID', enabled: false }));
      }
      if (showTempMap) {
        setShowTempMap(false);
        webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_TEMP_MAP', enabled: false }));
      }
      if (showGravityMap) {
        setShowGravityMap(false);
        webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_GRAVITY_MAP', enabled: false }));
      }
      if (showNeutronMap) {
        setShowNeutronMap(false);
        webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_NEUTRON_MAP', enabled: false }));
      }
      if (activeMineralFilter) {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MINERAL_FILTER', filter: activeMineralFilter, enabled: false }));
        setActiveMineralFilter(null);
        setFilters(prev => {
          const newF = { ...prev };
          Object.keys(newF).forEach(k => { newF[k as keyof typeof filters] = false; });
          return newF;
        });
      }
      // PL/TR 모드 해제
      webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_PL_MODE' }));
      webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TR_MODE' }));
    } else {
      // 점유 모드(occupation/occupation2/occupation3)로 전환 시
      if (showLandingSites || showTerrain) {
        setShowLandingSites(false);
        setShowTerrain(false);
        webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_LANDMARKS', enabled: false }));
      }
      if (showSatellites) {
        setShowSatellites(false);
      }

      setSelectedLandmark(null);
      setShowFeaturePanel(false);
      setFeatureListView('none');

      // 점유 모드 진입 시 그리드 강제 활성화
      setShowGrid(true);
      webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_GRID_VISIBILITY', visible: true }));

      // PL/TR 모드 전환
      if (mainMode === 'occupation2') {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'ENTER_PL_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TR_MODE' }));
      } else if (mainMode === 'occupation3') {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_PL_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'ENTER_TR_MODE' }));
      } else {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_PL_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TR_MODE' }));
      }
    }
  }, [mainMode]);

  const toggleFilterModal = () => {
    // 옵션 메뉴 닫기 (겹치지 않게)
    setShowOptions(false);
    setShowFilterModal(!showFilterModal);
  };

  const toggleFilter = (filterKey: keyof typeof filters) => {
    setFilters(prev => {
      // 일반 필터(apollo, artemis 등)인 경우
      const mineralFilters = ['feo', 'tio2', 'mgo', 'al2o3', 'sio2', 'cao', 'k', 'th', 'u', 'am', 'neutron'];
      if (!mineralFilters.includes(filterKey)) {
        const newValue = !prev[filterKey];

        // WebView에 일반 필터 변경 메시지 전송 (현재는 아폴로/아르테미스 등 별도 처리 로직이 있다고 가정하거나 향후 구현)
        // 여기서는 기존 로직 유지
        webviewRef.current?.postMessage(JSON.stringify({
          type: 'UPDATE_MINERAL_FILTER',
          filter: filterKey,
          enabled: newValue
        }));

        return { ...prev, [filterKey]: newValue };
      }

      // 광물 필터인 경우 (단일 선택 로직)
      const isAlreadyActive = prev[filterKey];
      const newValue = !isAlreadyActive; // 토글

      // 1. 모든 광물 필터를 끄는 새 상태 객체 생성
      const newFilters = { ...prev };
      mineralFilters.forEach(k => {
        newFilters[k as keyof typeof filters] = false;
      });

      // 2. 선택된 필터만 상태 업데이트
      if (newValue) {
        newFilters[filterKey] = true;
      }

      // 3. WebView에 모든 광물 필터 끄기 메시지 전송 (현재 활성해제된 것들)
      mineralFilters.forEach(k => {
        if (prev[k as keyof typeof filters] && k !== filterKey) {
          webviewRef.current?.postMessage(JSON.stringify({
            type: 'UPDATE_MINERAL_FILTER',
            filter: k,
            enabled: false
          }));
        }
      });

      // 4. 선택된 필터에 대한 메시지 전송
      webviewRef.current?.postMessage(JSON.stringify({
        type: 'UPDATE_MINERAL_FILTER',
        filter: filterKey,
        enabled: newValue
      }));

      // 5. 활성 필터 추적 업데이트
      setActiveMineralFilter(newValue ? filterKey : null);

      return newFilters;
    });
  };

  // 온도 맵 토글 핸들러
  const toggleTempMap = () => {
    const newValue = !showTempMap;
    setShowTempMap(newValue);
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'TOGGLE_TEMP_MAP',
      enabled: newValue
    }));
  };

  const toggleThermalGrid = () => {
    const newValue = !showThermalGrid;
    setShowThermalGrid(newValue);
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'TOGGLE_THERMAL_GRID',
      enabled: newValue
    }));
  };

  // 중력 그리드 모드 토글 핸들러
  const toggleGravityGridMode = () => {
    const newValue = !gravityGridMode;
    setGravityGridMode(newValue);
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'TOGGLE_GRAVITY_GRID_MODE',
      enabled: newValue
    }));
  };

  // 중성자 맵 토글
  const toggleNeutronMap = () => {
    const newValue = !showNeutronMap;
    setShowNeutronMap(newValue);
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'TOGGLE_NEUTRON_MAP',
      enabled: newValue
    }));
  };

  // 중성자 그리드 모드 토글
  const toggleNeutronGridMode = () => {
    const newValue = !neutronGridMode;
    setNeutronGridMode(newValue);
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'TOGGLE_NEUTRON_GRID_MODE',
      enabled: newValue
    }));
  };

  const toggleThermalMode = () => {
    const newMode = !isDayTemp;
    setIsDayTemp(newMode);
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'UPDATE_THERMAL_MODE',
      isDay: newMode
    }));
  };

  // 중력 이상 맵 토글 핸들러
  const toggleGravityMap = () => {
    const newValue = !showGravityMap;
    setShowGravityMap(newValue);
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'TOGGLE_GRAVITY_MAP',
      enabled: newValue
    }));
  };

  // 그리드 토글 핸들러
  const toggleGrid = () => {
    const newValue = !showGrid;
    setShowGrid(newValue);
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'UPDATE_GRID_VISIBILITY',
      visible: newValue
    }));
  };

  // 자원 스캐너 — 자원 선택 핸들러 (기존 히트맵 토글 함수 재사용)
  const handleResourceSelect = (resourceKey: string) => {
    // 같은 자원 재클릭 = 무시 (항상 선택 상태 유지)
    if (activeScannedResource === resourceKey) {
      return;
    }

    // 이전 활성 자원 끄기
    if (activeScannedResource) {
      deactivateResource(activeScannedResource);
    }

    // 새 자원 켜기
    activateResource(resourceKey);
    setActiveScannedResource(resourceKey);
  };

  const activateResource = (key: string) => {
    const mineralKeys = ['feo', 'tio2', 'mgo', 'al2o3', 'sio2', 'cao', 'k', 'th', 'u'];
    if (mineralKeys.includes(key)) {
      // 이전 광물 필터 해제
      if (activeMineralFilter) {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MINERAL_FILTER', filter: activeMineralFilter, enabled: false }));
      }
      webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MINERAL_FILTER', filter: key, enabled: true }));
      setActiveMineralFilter(key);
    } else if (key === 'thermalGrid') {
      // 데이터 기반 온도 히트맵
      if (!showThermalGrid) { setShowThermalGrid(true); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_THERMAL_GRID', enabled: true })); }
    } else if (key === 'gravity') {
      if (!showGravityMap) { setShowGravityMap(true); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_GRAVITY_MAP', enabled: true })); }
    } else if (key === 'neutron') {
      if (!showNeutronMap) { setShowNeutronMap(true); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_NEUTRON_MAP', enabled: true })); }
    }
  };

  const deactivateResource = (key: string) => {
    const mineralKeys = ['feo', 'tio2', 'mgo', 'al2o3', 'sio2', 'cao', 'k', 'th', 'u'];
    if (mineralKeys.includes(key)) {
      webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MINERAL_FILTER', filter: key, enabled: false }));
      webviewRef.current?.postMessage(JSON.stringify({ type: 'CLEAR_MINERAL_HIGHLIGHT' }));
      setActiveMineralFilter(null);
      setMineralCellInfo(null);
      setMineralStats(null);
    } else if (key === 'thermalGrid') {
      setShowThermalGrid(false); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_THERMAL_GRID', enabled: false }));
    } else if (key === 'gravity') {
      setShowGravityMap(false); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_GRAVITY_MAP', enabled: false }));
    } else if (key === 'neutron') {
      setShowNeutronMap(false); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_NEUTRON_MAP', enabled: false }));
    }
  };

  const closeResourceScanner = () => {
    // 패널 닫을 때 활성 자원 해제
    if (activeScannedResource) {
      deactivateResource(activeScannedResource);
      setActiveScannedResource(null);
    }
    setMineralCellInfo(null);
    setMineralStats(null);
    setShowResourceScanner(false);
  };

  // 초기 그리드 상태 동기화
  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        webviewRef.current?.postMessage(JSON.stringify({
          type: 'UPDATE_GRID_VISIBILITY',
          visible: showGrid
        }));
      }, 500);
    }
  }, [loading]);

  // 모드 상태 동기화
  useEffect(() => {
    if (!loading) {
      webviewRef.current?.postMessage(JSON.stringify({
        type: 'UPDATE_MODE',
        payload: {
          mainMode,
          subMode
        }
      }));
    }
  }, [mainMode, subMode, loading]);

  // 1인칭 조이스틱 이동 핸들러
  const handleMove = (direction: string, isPressed: boolean) => {
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'FIRST_PERSON_MOVE',
      payload: { direction, isPressed }
    }));
  };

  // 위성 데이터 로딩 (앱 시작 시 백그라운드 로드)
  useEffect(() => {
    if (satelliteData.length === 0 && !isLoadingSatellite) {
      loadSpacecraftData();
    }
  }, []);

  const loadSpacecraftData = async () => {
    setIsLoadingSatellite(true);
    const results: any[] = [];
    let index = 0;

    for (const mission of LIVE_MISSIONS) {
      if (mission.apiEnabled) {
        try {
          const trajHours = mission.orbitHours || 24;
          // 궤도주기에 따른 샘플링 간격 (짧은 궤도=촘촘, 긴 궤도=넓게)
          const stepMin = trajHours <= 4 ? 3 : trajHours <= 48 ? 15 : 30;
          const [position, trajectory] = await Promise.all([
            fetchSpacecraftPosition(mission.id),
            fetchSpacecraftTrajectory(mission.id, trajHours, stepMin)
          ]);

          results.push({
            ...mission,
            position: position || undefined,
            trajectory: trajectory || undefined,
          });
        } catch (error) {
          console.error(`Failed to fetch ${mission.name}:`, error);
          results.push({ ...mission });
        }
        await new Promise(resolve => setTimeout(resolve, 200)); // API Rate Limit 방지
      } else {
        results.push({ ...mission });
      }
      index++;
    }

    setSatelliteData(results);
    setIsLoadingSatellite(false);
    // WebView 전송은 토글 ON 시에만 수행 (여기서는 데이터만 저장)
  };

  // 위성 데이터 로드 완료 감지: 토글 ON인데 데이터가 방금 로드되면 자동 전송
  useEffect(() => {
    if (showSatellites && satelliteData.length > 0 && !isLoadingSatellite) {
      webviewRef.current?.postMessage(JSON.stringify({
        type: 'LOAD_SATELLITE_DATA',
        data: satelliteData
      }));
    }
  }, [satelliteData, isLoadingSatellite]);


  // 검색 핸들러
  const handleSearch = () => {
    // 좌표 검색 (위도, 경도)
    const coordMatch = searchQuery.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      console.log('Search coordinates:', lat, lng);
      webviewRef.current?.postMessage(JSON.stringify({
        type: 'GO_TO_LOCATION',
        payload: { lat, lng }
      }));
      return;
    }

    console.log('Search:', searchQuery);
    // TODO: 지역 이름 검색 로직
  };

  // 유명 좌표로 이동
  const goToLocation = (location: typeof famousLocations[0]) => {
    setActiveLocation(location.id);
    console.log('Go to:', location.name, location.lat, location.lng);
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'GO_TO_LOCATION',
      payload: { lat: location.lat, lng: location.lng }
    }));
  };

  const handleCloseAIModal = () => {
    setShowAIModal(false);
  };

  const handleAISelectZone = (lat: number, lng: number, name: string) => {
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'FLY_TO_LOCATION',
      payload: { lat, lng, name }
    }));
  };


  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* 상단 헤더 영역 (모드 토글 및 점유모드 기능) */}
      <SafeAreaView style={styles.headerLayer} edges={['top', 'left', 'right']} pointerEvents="box-none">

        {/* 모드 선택 토글 */}
        <View style={styles.modeToggleContainer}>
          <View style={styles.modeToggleInner}>
            <TouchableOpacity
              style={[styles.modeTab, mainMode === 'exploration' && styles.modeTabActive]}
              onPress={() => setMainMode('exploration')}
            >
              <Text style={[styles.modeTabText, mainMode === 'exploration' && styles.modeTabTextActive]}>탐사 모드</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mainMode === 'occupation' && styles.modeTabActive]}
              onPress={() => setMainMode('occupation')}
            >
              <Text style={[styles.modeTabText, mainMode === 'occupation' && styles.modeTabTextActive]}>점유 모드</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mainMode === 'occupation2' && styles.modeTabActive]}
              onPress={() => setMainMode('occupation2')}
            >
              <Text style={[styles.modeTabText, mainMode === 'occupation2' && styles.modeTabTextActive]}>점유모드2</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mainMode === 'occupation3' && styles.modeTabActive]}
              onPress={() => setMainMode('occupation3')}
            >
              <Text style={[styles.modeTabText, mainMode === 'occupation3' && styles.modeTabTextActive]}>점유모드3</Text>
            </TouchableOpacity>

          </View>
        </View>



      </SafeAreaView>

      {/* 캔버스 영역 (Flex) */}
      <View style={styles.canvasSection}>
        {/* Cesium WebView */}
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: createCesiumHtml('', ''), baseUrl: 'https://moon.com' }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
        />

        {/* Mag 잔액 표시 (좌측 상단) */}
        {isOccupation && (
          <View style={styles.magDisplay}>
            <Text style={styles.magLabel}>MAG</Text>
            <View style={styles.magRow}>
              {selectedCell && magCost > 0 && (
                <><Text style={styles.magCost}>{magCost}</Text><Text style={styles.magSlash}> / </Text></>
              )}
              <Text style={styles.magBalance}>{magBalance}</Text>
            </View>
          </View>
        )}

        {/* 좌측 상단: 자원 스캐너 (토글 버튼+패널 통합) — ResourceScannerPanel 내부에서 렌더링 */}

        {/* 우측 상단 컨트롤 버튼 (+, 초기화, -) */}
        <SafeAreaView style={styles.rightControls} edges={['right']} pointerEvents="box-none">
          {/* 부가기능 패널 버튼 (탐사 모드) */}
          {mainMode === 'exploration' && (
            <TouchableOpacity
              style={[styles.controlBtn, showFeaturePanel && { backgroundColor: 'rgba(59,130,246,0.8)', borderColor: '#60A5FA' }]}
              onPress={() => setShowFeaturePanel(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="layers" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          {/* 옵션(설정) 버튼 - 주석처리 (나중에 다시 사용)
          {isOccupation && (
            <TouchableOpacity
              style={[styles.controlBtn, (showOptions || showFilterModal || showTempMap || showThermalGrid) && styles.controlBtnActive]}
              onPress={toggleOptions}
              activeOpacity={0.7}
            >
              <Ionicons name="options" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          */}

          {/* 확대 버튼 (+) */}
          <TouchableOpacity
            style={[styles.controlBtn, isOccupation && selectionDepth >= 3 && { opacity: 0.3 }]}
            onPress={handleZoomIn}
            activeOpacity={0.7}
            disabled={isOccupation && selectionDepth >= 3}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>

          {/* 초기화 버튼 */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>

          {/* 축소 버튼 (-) */}
          <TouchableOpacity
            style={[styles.controlBtn, isOccupation && selectionDepth <= 0 && { opacity: 0.3 }]}
            onPress={handleZoomOut}
            activeOpacity={0.7}
            disabled={isOccupation && selectionDepth <= 0}
          >
            <Ionicons name="remove" size={28} color="#fff" />
          </TouchableOpacity>

          {canGoBack && !isOccupation && (
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          {/* 점유모드3 디버그: 지형 재계산 버튼 */}
          {mainMode === 'occupation3' && (
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: 'rgba(234,179,8,0.8)', borderColor: '#EAB308' }]}
              onPress={() => {
                webviewRef.current?.postMessage(JSON.stringify({ type: 'RECALC_TERRAIN' }));
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="reload-circle" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </SafeAreaView>




        {/* AI 구역 추천 버튼 (우하단) - 점유 모드 전용 */}
        {isOccupation && (
          <View style={styles.aiRecommendContainer}>
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: 'rgba(59, 130, 246, 0.8)', borderColor: '#60A5FA', width: 48, height: 48, borderRadius: 24 }]}
              onPress={() => { setShowAIModal(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* 1인칭 조이스틱 UI — 버튼 제거됨. handleMove 로직은 지형 줌인/땅보기 등에서 재사용 가능 */}

        {/* 옵션 메뉴 오버레이 (Control Bar 옆에 표시) */}
        {showOptions && (
          <SafeAreaView style={[styles.rightControls, { right: 70, backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 12, padding: 10, alignItems: 'flex-start', width: 220, zIndex: 100 }]} edges={['right']} pointerEvents="auto">

            {/* 메뉴 타이틀 */}
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 15, marginLeft: 5 }}>설정 및 보기</Text>

            {/* AR 모드 메뉴는 점유 모드에서만 보이도록 처리 (선택) */}
            {isOccupation && (
              <>
                <TouchableOpacity style={styles.optionMenuItem} onPress={() => { setShowAR2Viewer(true); setShowOptions(false); }}>
                  <MaterialCommunityIcons name="compass-outline" size={20} color="#00f0ff" />
                  <Text style={[styles.optionMenuText, { color: '#00f0ff', fontWeight: 'bold' }]}>실제 달 찾기</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
              </>
            )}

            {/* 2. 필터 (광물/지역) - 점유 모드 전용 (주석처리) */}
            {/* {mainMode === 'occupation' && (
              <>
                <TouchableOpacity style={styles.optionMenuItem} onPress={toggleFilterModal}>
                  <MaterialCommunityIcons name="layers" size={20} color="#fff" />
                  <Text style={styles.optionMenuText}>데이터 필터</Text>
                  <Ionicons name="chevron-forward" size={16} color="#888" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
                <View style={styles.divider} />
              </>
            )} */}

            {/* 3. 그리드 토글 - 점유 모드 전용 */}
            {isOccupation && (
              <View style={styles.optionMenuItem}>
                <MaterialCommunityIcons name={showGrid ? "grid" : "grid-off"} size={20} color="#fff" />
                <Text style={styles.optionMenuText}>S2 그리드</Text>
                <Switch
                  value={showGrid}
                  onValueChange={toggleGrid}
                  trackColor={{ false: '#333', true: '#3B82F6' }}
                  thumbColor="#fff"
                  style={{ transform: [{ scale: 0.8 }], marginLeft: 'auto' }}
                />
              </View>
            )}

            {/* 4. 격자 온도 토글 */}
            <View style={styles.optionMenuItem}>
              <MaterialCommunityIcons name="grid" size={20} color={showThermalGrid ? '#3B82F6' : '#bbb'} />
              <Text style={styles.optionMenuText}>격자 온도</Text>
              <Switch
                value={showThermalGrid}
                onValueChange={toggleThermalGrid}
                trackColor={{ false: '#333', true: '#3B82F6' }}
                thumbColor="#fff"
                style={{ transform: [{ scale: 0.8 }], marginLeft: 'auto' }}
              />
            </View>

            {/* 5. 평균 온도 맵 토글 */}
            <View style={styles.optionMenuItem}>
              <MaterialCommunityIcons name="thermometer" size={20} color={showTempMap ? "#FF6B6B" : "#bbb"} />
              <Text style={styles.optionMenuText}>평균 온도 맵</Text>
              <Switch
                value={showTempMap}
                onValueChange={toggleTempMap}
                trackColor={{ false: '#333', true: '#FF6B6B' }}
                thumbColor="#fff"
                style={{ transform: [{ scale: 0.8 }], marginLeft: 'auto' }}
              />
            </View>

            {/* 6. 중력 이상 맵 토글 */}
            <View style={styles.optionMenuItem}>
              <MaterialCommunityIcons name="magnet" size={20} color={showGravityMap ? '#8B5CF6' : '#bbb'} />
              <Text style={styles.optionMenuText}>중력 이상</Text>
              <Switch
                value={showGravityMap}
                onValueChange={toggleGravityMap}
                trackColor={{ false: '#333', true: '#8B5CF6' }}
                thumbColor="#fff"
                style={{ transform: [{ scale: 0.8 }], marginLeft: 'auto' }}
              />
            </View>

            {/* 6-1. 중력 그리드 모드 토글 (중력 이상이 켜져있을 때만) */}
            {showGravityMap && (
              <View style={[styles.optionMenuItem, { paddingLeft: 36 }]}>
                <MaterialCommunityIcons name="grid" size={18} color={gravityGridMode ? '#A78BFA' : '#888'} />
                <Text style={[styles.optionMenuText, { fontSize: 13 }]}>그리드 표시</Text>
                <Switch
                  value={gravityGridMode}
                  onValueChange={toggleGravityGridMode}
                  trackColor={{ false: '#333', true: '#A78BFA' }}
                  thumbColor="#fff"
                  style={{ transform: [{ scale: 0.7 }], marginLeft: 'auto' }}
                />
              </View>
            )}

            {/* 7. 수소(중성자) 맵 토글 */}
            <View style={styles.optionMenuItem}>
              <MaterialCommunityIcons name="water" size={20} color={showNeutronMap ? '#3B82F6' : '#bbb'} />
              <Text style={styles.optionMenuText}>수소 히트맵</Text>
              <Switch
                value={showNeutronMap}
                onValueChange={toggleNeutronMap}
                trackColor={{ false: '#333', true: '#3B82F6' }}
                thumbColor="#fff"
                style={{ transform: [{ scale: 0.8 }], marginLeft: 'auto' }}
              />
            </View>

            {/* 7-1. 수소 그리드 모드 토글 */}
            {showNeutronMap && (
              <View style={[styles.optionMenuItem, { paddingLeft: 36 }]}>
                <MaterialCommunityIcons name="grid" size={18} color={neutronGridMode ? '#60A5FA' : '#888'} />
                <Text style={[styles.optionMenuText, { fontSize: 13 }]}>그리드 표시</Text>
                <Switch
                  value={neutronGridMode}
                  onValueChange={toggleNeutronGridMode}
                  trackColor={{ false: '#333', true: '#60A5FA' }}
                  thumbColor="#fff"
                  style={{ transform: [{ scale: 0.7 }], marginLeft: 'auto' }}
                />
              </View>
            )}

          </SafeAreaView>
        )}

        {/* 기존 스펙트럼 범례 제거됨 — 자원 스캐너 패널의 좌측 범례로 통일 */}

        {/* 자원 스캐너 패널 — 토글 버튼 내장 (탐사 모드) */}
        {mainMode === 'exploration' && (
          <ResourceScannerPanel
            visible={showResourceScanner}
            onToggle={() => {
              if (showResourceScanner) {
                closeResourceScanner();
              } else {
                setShowResourceScanner(true);
                setShowFeaturePanel(false);
                if (!activeScannedResource) {
                  handleResourceSelect('feo');
                }
              }
            }}
            onSelectResource={handleResourceSelect}
            activeResource={activeScannedResource}
            mineralStats={mineralStats}
            mineralDataLoaded={mineralDataLoaded}
            mineralCellInfo={mineralCellInfo}
            onClearCellInfo={() => setMineralCellInfo(null)}
          />
        )}



        {/* 필터 모달 (캔버스 영역 내부) */}
        {showFilterModal && (
          <SafeAreaView style={styles.filterModalContainer} edges={['left', 'bottom']} pointerEvents="box-none">
            <BlurView intensity={80} tint="dark" style={styles.filterModal}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                {/* 필터 헤더 */}
                <View style={styles.filterHeader}>
                  <MaterialCommunityIcons name="layers" size={20} color="#3B82F6" />
                  <Text style={styles.filterTitle}>지도 레이어 설정</Text>
                </View>

                {/* 탐색 지점 */}
                <View style={styles.filterSection}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="location" size={16} color="#888" />
                    <Text style={styles.sectionTitle}>탐색 지점</Text>
                  </View>
                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>아폴로(Apollo) 프로젝트</Text>
                    <Switch
                      value={filters.apollo}
                      onValueChange={() => toggleFilter('apollo')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>
                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>아르테미스(Artemis) 계획</Text>
                    <Switch
                      value={filters.artemis}
                      onValueChange={() => toggleFilter('artemis')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>

                {/* 자원 분포 */}
                <View style={styles.filterSection}>
                  <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons name="chart-bar" size={16} color="#888" />
                    <Text style={styles.sectionTitle}>자원 분포</Text>
                  </View>

                  {/* 핵심 자원 (Major Oxides) */}
                  <Text style={styles.subSectionTitle}>핵심 자원 (Major Oxides)</Text>

                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>철 (FeO)</Text>
                    <Switch
                      value={filters.feo}
                      onValueChange={() => toggleFilter('feo')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>티타늄 (TiO₂)</Text>
                    <Switch
                      value={filters.tio2}
                      onValueChange={() => toggleFilter('tio2')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>마그네슘 (MgO)</Text>
                    <Switch
                      value={filters.mgo}
                      onValueChange={() => toggleFilter('mgo')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>알루미늄 (Al₂O₃)</Text>
                    <Switch
                      value={filters.al2o3}
                      onValueChange={() => toggleFilter('al2o3')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>규소 (SiO₂)</Text>
                    <Switch
                      value={filters.sio2}
                      onValueChange={() => toggleFilter('sio2')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>칼슘 (CaO)</Text>
                    <Switch
                      value={filters.cao}
                      onValueChange={() => toggleFilter('cao')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* 희귀 원소 (Trace Elements) */}
                  <Text style={styles.subSectionTitle}>희귀 원소 (Trace Elements)</Text>

                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>칼륨 (K)</Text>
                    <Switch
                      value={filters.k}
                      onValueChange={() => toggleFilter('k')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>토륨 (Th)</Text>
                    <Switch
                      value={filters.th}
                      onValueChange={() => toggleFilter('th')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>우라늄 (U)</Text>
                    <Switch
                      value={filters.u}
                      onValueChange={() => toggleFilter('u')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* 물리 지표 (Physical Props) */}
                  <Text style={styles.subSectionTitle}>물리 지표 (Physical Props)</Text>

                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>원자 질량 (AM)</Text>
                    <Switch
                      value={filters.am}
                      onValueChange={() => toggleFilter('am')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={styles.filterItem}>
                    <Text style={styles.filterItemText}>중성자 밀도</Text>
                    <Switch
                      value={filters.neutron}
                      onValueChange={() => toggleFilter('neutron')}
                      trackColor={{ false: '#333', true: '#3B82F6' }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* 투명도 조절 */}
                  <View style={styles.opacitySection}>
                    <View style={styles.sectionHeader}>
                      <MaterialCommunityIcons name="opacity" size={16} color="#888" />
                      <Text style={styles.sectionTitle}>투명도 조절</Text>
                    </View>
                    <View style={styles.sliderContainer}>
                      <Text style={styles.sliderLabel}>광물 레이어 투명도</Text>
                      <View style={styles.sliderRow}>
                        <Text style={styles.sliderValue}>{(mineralOpacity * 100).toFixed(0)}%</Text>
                      </View>
                      <Text style={styles.sliderHint}>※ 슬라이더는 추후 구현 예정</Text>
                    </View>
                  </View>

                  {/* 색깔별 수치표 (Legend) */}
                  {(filters.feo || filters.tio2 || filters.mgo || filters.al2o3 || filters.sio2 || filters.cao || filters.k || filters.th || filters.u || filters.am || filters.neutron) && (
                    <View style={styles.legendSection}>
                      <View style={styles.legendHeader}>
                        <MaterialCommunityIcons name="palette" size={16} color="#888" />
                        <Text style={styles.sectionTitle}>색깔별 수치표</Text>
                      </View>

                      {filters.feo && (
                        <View style={styles.legendItem}>
                          <Text style={styles.legendTitle}>철 (FeO)</Text>
                          <View style={styles.gradientBar} />
                          <View style={styles.legendLabels}>
                            <Text style={styles.legendLabel}>MIN: 0.00 wt%</Text>
                            <Text style={styles.legendLabel}>MAX: 25.00 wt%</Text>
                          </View>
                        </View>
                      )}

                      {filters.tio2 && (
                        <View style={styles.legendItem}>
                          <Text style={styles.legendTitle}>티타늄 (TiO₂)</Text>
                          <View style={styles.gradientBar} />
                          <View style={styles.legendLabels}>
                            <Text style={styles.legendLabel}>MIN: 0.00 wt%</Text>
                            <Text style={styles.legendLabel}>MAX: 15.00 wt%</Text>
                          </View>
                        </View>
                      )}

                      {filters.mgo && (
                        <View style={styles.legendItem}>
                          <Text style={styles.legendTitle}>마그네슘 (MgO)</Text>
                          <View style={styles.gradientBar} />
                          <View style={styles.legendLabels}>
                            <Text style={styles.legendLabel}>MIN: 0.00 wt%</Text>
                            <Text style={styles.legendLabel}>MAX: 35.00 wt%</Text>
                          </View>
                        </View>
                      )}

                      {filters.al2o3 && (
                        <View style={styles.legendItem}>
                          <Text style={styles.legendTitle}>알루미늄 (Al₂O₃)</Text>
                          <View style={styles.gradientBar} />
                          <View style={styles.legendLabels}>
                            <Text style={styles.legendLabel}>MIN: 0.00 wt%</Text>
                            <Text style={styles.legendLabel}>MAX: 30.00 wt%</Text>
                          </View>
                        </View>
                      )}

                      {filters.sio2 && (
                        <View style={styles.legendItem}>
                          <Text style={styles.legendTitle}>규소 (SiO₂)</Text>
                          <View style={styles.gradientBar} />
                          <View style={styles.legendLabels}>
                            <Text style={styles.legendLabel}>MIN: 0.00 wt%</Text>
                            <Text style={styles.legendLabel}>MAX: 50.00 wt%</Text>
                          </View>
                        </View>
                      )}

                      {filters.cao && (
                        <View style={styles.legendItem}>
                          <Text style={styles.legendTitle}>칼슘 (CaO)</Text>
                          <View style={styles.gradientBar} />
                          <View style={styles.legendLabels}>
                            <Text style={styles.legendLabel}>MIN: 0.00 wt%</Text>
                            <Text style={styles.legendLabel}>MAX: 20.00 wt%</Text>
                          </View>
                        </View>
                      )}

                      {filters.k && (
                        <View style={styles.legendItem}>
                          <Text style={styles.legendTitle}>칼륨 (K)</Text>
                          <View style={styles.gradientBar} />
                          <View style={styles.legendLabels}>
                            <Text style={styles.legendLabel}>MIN: 0 ppm</Text>
                            <Text style={styles.legendLabel}>MAX: 5000 ppm</Text>
                          </View>
                        </View>
                      )}

                      {filters.th && (
                        <View style={styles.legendItem}>
                          <Text style={styles.legendTitle}>토륨 (Th)</Text>
                          <View style={styles.gradientBar} />
                          <View style={styles.legendLabels}>
                            <Text style={styles.legendLabel}>MIN: 0 ppm</Text>
                            <Text style={styles.legendLabel}>MAX: 20 ppm</Text>
                          </View>
                        </View>
                      )}

                      {filters.u && (
                        <View style={styles.legendItem}>
                          <Text style={styles.legendTitle}>우라늄 (U)</Text>
                          <View style={styles.gradientBar} />
                          <View style={styles.legendLabels}>
                            <Text style={styles.legendLabel}>MIN: 0 ppm</Text>
                            <Text style={styles.legendLabel}>MAX: 10 ppm</Text>
                          </View>
                        </View>
                      )}

                      {filters.am && (
                        <View style={styles.legendItem}>
                          <Text style={styles.legendTitle}>원자 질량 (AM)</Text>
                          <View style={styles.gradientBar} />
                          <View style={styles.legendLabels}>
                            <Text style={styles.legendLabel}>MIN: 20.0 g/mol</Text>
                            <Text style={styles.legendLabel}>MAX: 25.0 g/mol</Text>
                          </View>
                        </View>
                      )}

                      {filters.neutron && (
                        <View style={styles.legendItem}>
                          <Text style={styles.legendTitle}>중성자 밀도</Text>
                          <View style={styles.gradientBar} />
                          <View style={styles.legendLabels}>
                            <Text style={styles.legendLabel}>MIN: 0.0 g/cm³</Text>
                            <Text style={styles.legendLabel}>MAX: 1.0 g/cm³</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </ScrollView>
            </BlurView>
          </SafeAreaView>
        )}

        {/* 하단 셀 정보 카드 (와이어프레임 기반) */}
        {isOccupation && selectedCell && (
          <Animated.View style={[styles.bottomCardContainer, { transform: [{ translateY: sheetTranslateY }] }]}>
            <View style={styles.bottomCard2}>
              {/* 드래그 핸들 */}
              <View {...sheetPanResponder.panHandlers} style={styles.dragHandleArea}>
                <View style={styles.dragHandle} />
              </View>

              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false} scrollEnabled={true}>
                {/* 헤더: MAG ID + 크기 */}
                <View style={styles.cellHeaderRow}>
                  <View style={{ flex: 1 }}>
                    {selectedCell.isMultiSelect ? (
                      <>
                        <Text style={styles.cellMagId}>{selectedCell.cellCount + '개 셀 선택됨'}</Text>
                        <Text style={styles.cellS2Id}>
                          {(selectedCell.multiTokens || []).slice(0, 5).join(', ') + (selectedCell.cellCount > 5 ? ' ...' : '')}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.cellMagId}>{'MAG-L' + (selectedCell.level || 16) + '-' + (selectedCell.token || selectedCell.cellId)}</Text>
                        <Text style={styles.cellS2Id}>{'S2cellId: ' + (selectedCell.token || selectedCell.cellId)}</Text>
                      </>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.cellMagSize}>{(selectedCell?.magCount || 1) + ' Mag'}</Text>
                    <Text style={styles.cellMagLabel}>{selectedCell.isMultiSelect ? '합계' : '크기'}</Text>
                  </View>
                </View>

                {/* 면적 · 좌표 */}
                <Text style={styles.cellSubInfo}>
                  {'면적 ' + (selectedCell.area || '~0.5 km\u00B2') + '  \u00B7  ' + Math.abs(selectedCell.lat || 0).toFixed(2) + '\u00B0' + ((selectedCell.lat || 0) >= 0 ? 'N' : 'S') + ' ' + Math.abs(selectedCell.lng || 0).toFixed(2) + '\u00B0' + ((selectedCell.lng || 0) >= 0 ? 'E' : 'W')}
                </Text>

                {/* URN */}
                {!selectedCell.isMultiSelect && (
                  <Text style={styles.cellUrn}>{'urn: 301:' + (selectedCell.level || 16) + ':' + (selectedCell.token || selectedCell.cellId)}</Text>
                )}

                {/* 구분선 */}
                <View style={styles.cellDivider} />

                {/* 점유 가격 */}
                <Text style={styles.cellPriceLabel}>점유 가격:</Text>
                <Text style={styles.cellPriceValue}>{(selectedCell?.magCount || 1) + ' Mag'}</Text>

                {/* CTA 버튼 */}
                <TouchableOpacity
                  style={styles.occupyButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowOccupyConfirm(true);
                  }}
                >
                  <Text style={styles.occupyButtonText}>{'이 구역 점유하기  \u2192'}</Text>
                </TouchableOpacity>

                {/* 구분선 */}
                <View style={styles.cellDivider} />

                {/* 착륙 지점 */}
                <Text style={styles.sectionLabel}>착륙 지점</Text>
                <View style={styles.poiRow}>
                  <View style={styles.poiThumb}>
                    <Ionicons name="location" size={20} color="#999" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.poiName}>Apollo 11 착륙지</Text>
                    <Text style={styles.poiDetail}>1969 · NASA · 유인탐사</Text>
                    <Text style={styles.poiDistance}>인근 23km</Text>
                  </View>
                  <TouchableOpacity>
                    <Text style={styles.poiLink}>{'바로가기 \u2192'}</Text>
                  </TouchableOpacity>
                </View>

                {/* 구분선 */}
                <View style={styles.cellDivider} />

                {/* 주요 지형 */}
                <Text style={styles.sectionLabel}>주요 지형</Text>
                <View style={styles.poiRow}>
                  <View style={styles.poiThumb}>
                    <MaterialCommunityIcons name="terrain" size={20} color="#999" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.poiName}>Tycho Crater</Text>
                    <Text style={styles.poiDetail}>분화구 · 지름 85km · He-3 ★★★★</Text>
                    <Text style={styles.poiDistance}>인근 8km</Text>
                  </View>
                  <TouchableOpacity>
                    <Text style={styles.poiLink}>{'바로가기 \u2192'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        )}
      </View>



      {/* AR 탐사선 뷰어 (삭제됨) */}

      {/* AR 실제 달 찾기 뷰어 */}
      {
        showAR2Viewer && (
          <AR2MoonViewer onClose={() => setShowAR2Viewer(false)} />
        )
      }

      {/* 탐사 목록 패널 (토글+리스트 통합) */}
      <ExplorationListPanel
        visible={showFeaturePanel}
        onClose={() => { setShowFeaturePanel(false); }}
        showSatellites={showSatellites}
        showLandingSites={showLandingSites}
        showTerrain={showTerrain}
        onToggleSatellites={(val) => {
          setShowSatellites(val);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MODE', payload: { mainMode: 'exploration', subMode: val ? 'satellite' : subMode } }));
          if (val && satelliteData.length > 0) {
            // 데이터 로드 완료 → 즉시 전송
            webviewRef.current?.postMessage(JSON.stringify({
              type: 'LOAD_SATELLITE_DATA',
              data: satelliteData
            }));
          }
          // 데이터가 아직 로딩 중이면 useEffect에서 감지하여 자동 전송
        }}
        onToggleLandingSites={(val) => {
          setShowLandingSites(val);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_LANDING_SITES', enabled: val }));
        }}
        onToggleTerrain={(val) => {
          setShowTerrain(val);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_TERRAIN', enabled: val }));
        }}
        satelliteData={satelliteData}
        isLoadingSatellite={isLoadingSatellite}
        onSelectSatellite={(sat) => {
          setShowFeaturePanel(false);
          satPanelAnim.setValue(SAT_PANEL_COLLAPSED);
          satPanelOffsetRef.current = SAT_PANEL_COLLAPSED;
          satIsLookAt.current = false;
          setSelectedSatellite(sat);
          webviewRef.current?.postMessage(JSON.stringify({
            type: 'FOCUS_SATELLITE',
            payload: { name: sat.name, id: sat.id }
          }));
        }}
        onSelectLandingSite={(site) => {
          setShowFeaturePanel(false);
          landingPanelAnim.setValue(SNAP_MIN);
          landingPanelOffsetRef.current = SNAP_MIN;
          landingIsFirstPerson.current = false;
          setSelectedLandingSite(site);
          setLandingSiteDetailMode('detail');
          webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: site.lat, lng: site.lng } }));
        }}
        onSelectFeature={(feat) => {
          setShowFeaturePanel(false);
          featurePanelAnim.setValue(SNAP_MIN);
          featurePanelOffsetRef.current = SNAP_MIN;
          featureIsFirstPerson.current = false;
          setSelectedFeature(feat);
          setFeatureDetailMode('detail');
          webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: feat.lat, lng: feat.lng } }));
          webviewRef.current?.postMessage(JSON.stringify({ type: 'SHOW_FEATURE_AREA', payload: { lat: feat.lat, lng: feat.lng, diameterKm: feat.diameterKm, widthKm: feat.widthKm, angle: feat.angle, typeKr: feat.typeKr } }));
        }}
      />



      {/* 위성 상세 정보 패널 */}
      {selectedSatellite && mainMode === 'exploration' && (
          <Animated.View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            top: satPanelAnim,
            backgroundColor: '#111827',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
          }}>

            {/* 드래그 가능 영역: 핸들 + 제목행 */}
            <View {...satPanelPanResponder.panHandlers}>
            {/* 드래그 핸들 */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#4B5563', borderRadius: 2 }} />
            </View>
            {/* 헤더: ← + 제목 + 뷰전환 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedSatellite(null);
                  webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
                  setShowFeaturePanel(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ paddingRight: 8, paddingVertical: 4 }}
              >
                <Ionicons name="chevron-back" size={24} color="#9CA3AF" />
              </TouchableOpacity>
              <Text style={{ color: '#F9FAFB', fontSize: 20, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                {selectedSatellite.nameKo !== selectedSatellite.name ? selectedSatellite.nameKo : selectedSatellite.name}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (satIsLookAt.current) {
                    satIsLookAt.current = false;
                    webviewRef.current?.postMessage(JSON.stringify({
                      type: 'FOCUS_SATELLITE',
                      payload: { name: selectedSatellite.name, id: selectedSatellite.id }
                    }));
                  } else {
                    satIsLookAt.current = true;
                    webviewRef.current?.postMessage(JSON.stringify({
                      type: 'FOCUS_SATELLITE',
                      payload: { name: selectedSatellite.name, id: selectedSatellite.id, lookAt: true }
                    }));
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(96,165,250,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 }}
              >
                <Ionicons name="eye-outline" size={16} color="#60A5FA" />
                <Text style={{ color: '#60A5FA', fontSize: 13, fontWeight: '700' }}>뷰 전환</Text>
              </TouchableOpacity>
            </View>
            </View>

            {/* 구분선 */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 }} />

            <ScrollView style={{ paddingHorizontal: 20, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
              {/* 서브 정보 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                {selectedSatellite.nameKo !== selectedSatellite.name && (
                  <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '500' }}>{selectedSatellite.name}</Text>
                )}
                <Text style={{ color: '#6B7280', fontSize: 3 }}>●</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{selectedSatellite.agency || selectedSatellite.country}</Text>
                {selectedSatellite.launchDate && (
                  <>
                    <Text style={{ color: '#6B7280', fontSize: 3 }}>●</Text>
                    <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{selectedSatellite.launchDate}</Text>
                  </>
                )}
              </View>

              {/* 실시간 궤도 정보 */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#D1D5DB' }}>실시간 궤도 정보</Text>
                <View style={{ backgroundColor: '#065F46', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399', marginRight: 5 }} />
                  <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '600' }}>Live</Text>
                </View>
              </View>

              {/* 2x3 정보 카드 그리드 */}
              {(() => {
                const MOON_R = 1737.4;
                const pos = selectedSatellite.position;
                let latStr = '-', lonStr = '-';
                if (pos) {
                  const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
                  if (dist > 0) {
                    const lat = Math.asin(pos.z / dist) * (180 / Math.PI);
                    const lon = Math.atan2(pos.y, pos.x) * (180 / Math.PI);
                    latStr = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
                    lonStr = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
                  }
                }
                const speed = pos && pos.vx !== undefined
                  ? Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy + pos.vz * pos.vz).toFixed(2)
                  : null;
                const periodMin = selectedSatellite.orbitHours
                  ? (selectedSatellite.orbitHours * 60).toFixed(1)
                  : null;
                const cardStyle = { flex: 1, minWidth: '47%', backgroundColor: '#1F2937', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' } as any;
                const labelStyle = { color: '#6B7280', fontSize: 11, marginBottom: 4 };
                const valStyle = { color: 'white', fontSize: 18, fontWeight: '700' as const };

                return (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                    <View style={cardStyle}>
                      <Text style={labelStyle}>현재 위도</Text>
                      <Text style={valStyle}>{latStr}</Text>
                    </View>
                    <View style={cardStyle}>
                      <Text style={labelStyle}>현재 경도</Text>
                      <Text style={valStyle}>{lonStr}</Text>
                    </View>
                    <View style={cardStyle}>
                      <Text style={labelStyle}>현재 고도</Text>
                      <Text style={valStyle}>{pos?.altitude ? `${pos.altitude.toFixed(1)} km` : '-'}</Text>
                    </View>
                    <View style={cardStyle}>
                      <Text style={labelStyle}>공전 속도</Text>
                      <Text style={valStyle}>{speed ? `${speed} km/s` : '-'}</Text>
                    </View>
                    <View style={cardStyle}>
                      <Text style={labelStyle}>공전 주기</Text>
                      <Text style={valStyle}>{periodMin ? `${periodMin} 분` : '-'}</Text>
                    </View>
                    <View style={cardStyle}>
                      <Text style={labelStyle}>궤도 경사각</Text>
                      <Text style={valStyle}>{selectedSatellite.orbitInclination != null ? `${selectedSatellite.orbitInclination.toFixed(1)}°` : '-'}</Text>
                    </View>
                  </View>
                );
              })()}

              {/* 임무 목적 */}
              {selectedSatellite.missionObjective && (
                <View style={{ marginBottom: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 16 }}>
                  <Text style={{ color: '#D1D5DB', fontSize: 15, fontWeight: '700', marginBottom: 8 }}>임무 목적</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 13, lineHeight: 20 }}>
                    {selectedSatellite.missionObjective}
                  </Text>
                </View>
              )}

              {/* 탑재 장비 */}
              {selectedSatellite.instruments && selectedSatellite.instruments.length > 0 && (
                <View style={{ marginBottom: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 16 }}>
                  <Text style={{ color: '#D1D5DB', fontSize: 15, fontWeight: '700', marginBottom: 10 }}>탑재 장비</Text>
                  {selectedSatellite.instruments.map((inst: string, idx: number) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4B5563', marginRight: 10 }} />
                      <Text style={{ color: '#9CA3AF', fontSize: 13 }}>{inst}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </Animated.View>
      )}

      {/* ═══ 착륙지점 상세 패널 (50%, 풀 정보) ═══ */}
      {selectedLandingSite && mainMode === 'exploration' && (landingSiteDetailMode === 'detail' || landingSiteDetailMode === 'occupation') && (
        <Animated.View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: landingSiteDetailMode === 'occupation' ? 0 : landingPanelAnim,
          backgroundColor: '#111827',
          borderTopLeftRadius: landingSiteDetailMode === 'occupation' ? 0 : 24,
          borderTopRightRadius: landingSiteDetailMode === 'occupation' ? 0 : 24,
          overflow: 'hidden',
        }}>
          {landingSiteDetailMode === 'detail' ? (
          <>
          {/* 드래그 가능 영역: 핸들 + 제목행 */}
          <View {...landingPanelPanResponder.panHandlers}>
          {/* 드래그 핸들 */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#4B5563', borderRadius: 2 }} />
          </View>
          {/* 헤더: ← + 제목 + 뷰전환 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
            <TouchableOpacity
              onPress={() => {
                setSelectedLandingSite(null);
                setShowFeaturePanel(true);
                webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ paddingRight: 8, paddingVertical: 4 }}
            >
              <Ionicons name="chevron-back" size={24} color="#9CA3AF" />
            </TouchableOpacity>
            <Text style={{ color: '#F9FAFB', fontSize: 20, fontWeight: '800', flex: 1 }} numberOfLines={1}>
              {selectedLandingSite.nameKr}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (landingIsFirstPerson.current) {
                  // 상세보기 → 전체보기로
                  landingIsFirstPerson.current = false;
                  webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: selectedLandingSite.lat, lng: selectedLandingSite.lng } }));
                } else {
                  // 전체보기 → 상세보기(회전)로
                  landingIsFirstPerson.current = true;
                  webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: selectedLandingSite.lat, lng: selectedLandingSite.lng, orbit: true } }));
                }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(96,165,250,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 }}
            >
              <Ionicons name="eye-outline" size={16} color="#60A5FA" />
              <Text style={{ color: '#60A5FA', fontSize: 13, fontWeight: '700' }}>뷰 전환</Text>
            </TouchableOpacity>
          </View>
          </View>

          {/* 구분선 */}
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 }} />

          <ScrollView style={{ paddingHorizontal: 20, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
            {/* 서브 정보 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '500' }}>{selectedLandingSite.officialName}</Text>
              <Text style={{ color: '#6B7280', fontSize: 3 }}>●</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{selectedLandingSite.country} {selectedLandingSite.agency}</Text>
            </View>
            <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 8 }}>
              {selectedLandingSite.lat.toFixed(3)}°{selectedLandingSite.lat >= 0 ? 'N' : 'S'}, {Math.abs(selectedLandingSite.lng).toFixed(3)}°{selectedLandingSite.lng >= 0 ? 'E' : 'W'}
            </Text>

            {/* 상태 배지 */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: getContactColor(selectedLandingSite.contactType) + '20' }}>
                <Text style={{ color: getContactColor(selectedLandingSite.contactType), fontSize: 12, fontWeight: '600' }}>{selectedLandingSite.contactType}</Text>
              </View>
              {selectedLandingSite.mode === 'Manned' && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(252,211,77,0.2)' }}>
                  <Text style={{ color: '#FCD34D', fontSize: 12, fontWeight: '600' }}>유인 미션</Text>
                </View>
              )}
            </View>

            {/* 정보 카드 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#1F2937', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}>착륙 시점</Text>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{selectedLandingSite.landingDate}</Text>
              </View>
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#1F2937', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}>착륙 지역</Text>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{selectedLandingSite.regionName}</Text>
              </View>
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#1F2937', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}>미션 유형</Text>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{selectedLandingSite.missionType}</Text>
              </View>
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#1F2937', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}>운용 방식</Text>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{selectedLandingSite.mode === 'Manned' ? '유인' : '무인'}</Text>
              </View>
            </View>

            {/* 설명 */}
            <View style={{ marginBottom: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 16 }}>
              <Text style={{ color: '#D1D5DB', fontSize: 15, fontWeight: '700', marginBottom: 8 }}>설명</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 13, lineHeight: 20 }}>{selectedLandingSite.description}</Text>
            </View>

            {/* 관련 뉴스 + 점유 현황 버튼 */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#1F2937', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                onPress={() => router.push(`/(tabs)?search=${encodeURIComponent(selectedLandingSite.nameKr)}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="newspaper-outline" size={18} color="#60A5FA" style={{ marginBottom: 4 }} />
                <Text style={{ color: '#D1D5DB', fontSize: 13, fontWeight: '600' }}>관련 뉴스 →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#1F2937', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                onPress={() => setLandingSiteDetailMode('occupation')}
                activeOpacity={0.7}
              >
                <Ionicons name="grid-outline" size={18} color="#34D399" style={{ marginBottom: 4 }} />
                <Text style={{ color: '#D1D5DB', fontSize: 13, fontWeight: '600' }}>점유 현황 →</Text>
              </TouchableOpacity>
            </View>

            {/* 인근 탐사 지점 */}
            <View style={{ marginBottom: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 16 }}>
              <Text style={{ color: '#D1D5DB', fontSize: 15, fontWeight: '700', marginBottom: 10 }}>인근 탐사 지점</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {findNearbySites(selectedLandingSite, 2).map((nearby, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={{ flex: 1, backgroundColor: '#1F2937', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
                    onPress={() => {
                      setSelectedLandingSite(nearby);
                      setLandingSiteDetailMode('detail');
                      webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
                      setTimeout(() => {
                        webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: nearby.lat, lng: nearby.lng } }));
                      }, 300);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#F9FAFB', fontSize: 13, fontWeight: '600' }}>{nearby.nameKr}</Text>
                    <Text style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{nearby.country} · {nearby.year}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
          </>
          ) : (
            <OccupationStatusPanel
              onBack={() => setLandingSiteDetailMode('detail')}
              onGoToOccupation={() => {
                const lat = selectedLandingSite.lat;
                const lng = selectedLandingSite.lng;
                setSelectedLandingSite(null);
                setLandingSiteDetailMode('detail');
                setMainMode('occupation');
                setTimeout(() => {
                  webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat, lng } }));
                }, 300);
              }}
              target={{ name: selectedLandingSite.nameKr, lat: selectedLandingSite.lat, lng: selectedLandingSite.lng, radiusKm: 5 }}
            />
          )}
        </Animated.View>
      )}

      {/* ═══ 착륙지점 뷰 모드 (하단 20%, 타이틀만 + 화면 크게 보기) ═══ */}
      {selectedLandingSite && mainMode === 'exploration' && landingSiteDetailMode === 'view' && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#111827',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 14,
          paddingBottom: 28,
          paddingHorizontal: 20,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity
              onPress={() => {
                setLandingSiteDetailMode('detail');
                webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
                setTimeout(() => {
                  webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: selectedLandingSite.lat, lng: selectedLandingSite.lng } }));
                }, 300);
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={22} color="#9CA3AF" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ color: 'white', fontSize: 17, fontWeight: '800' }}>{selectedLandingSite.nameKr}</Text>
                <Text style={{ color: '#6B7280', fontSize: 13 }}>{selectedLandingSite.officialName}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                setSelectedLandingSite(null);
                webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ═══ 대표 지형 상세 패널 (50%, 풀 정보) ═══ */}
      {selectedFeature && mainMode === 'exploration' && featureDetailMode === 'detail' && (
        <Animated.View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: featurePanelAnim,
          backgroundColor: '#111827',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: 'hidden',
        }}>
          {/* 드래그 가능 영역: 핸들 + 제목행 */}
          <View {...featurePanelPanResponder.panHandlers}>
          {/* 드래그 핸들 */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#4B5563', borderRadius: 2 }} />
          </View>
          {/* 헤더: ← + 제목 + 뷰전환 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
            <TouchableOpacity
              onPress={() => {
                setSelectedFeature(null);
                setShowFeaturePanel(true);
                webviewRef.current?.postMessage(JSON.stringify({ type: 'HIDE_FEATURE_AREA' }));
                webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ paddingRight: 8, paddingVertical: 4 }}
            >
              <Ionicons name="chevron-back" size={24} color="#9CA3AF" />
            </TouchableOpacity>
            <Text style={{ color: '#F9FAFB', fontSize: 20, fontWeight: '800', flex: 1 }} numberOfLines={1}>
              {selectedFeature.nameKr}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (featureIsFirstPerson.current) {
                  // 상세보기 → 전체보기로
                  featureIsFirstPerson.current = false;
                  webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: selectedFeature.lat, lng: selectedFeature.lng } }));
                } else {
                  // 전체보기 → 상세보기(회전)로
                  featureIsFirstPerson.current = true;
                  webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: selectedFeature.lat, lng: selectedFeature.lng, orbit: true } }));
                }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(96,165,250,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 }}
            >
              <Ionicons name="eye-outline" size={16} color="#60A5FA" />
              <Text style={{ color: '#60A5FA', fontSize: 13, fontWeight: '700' }}>뷰 전환</Text>
            </TouchableOpacity>
          </View>
          </View>

          {/* 구분선 */}
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 }} />

          <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
            {/* 서브 정보 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '500' }}>{selectedFeature.nameEn}</Text>
              <Text style={{ color: '#6B7280', fontSize: 3 }}>●</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{selectedFeature.typeKr}</Text>
            </View>
            {/* 유형 + 위치 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: `${getFeatureTypeColor(selectedFeature.typeKr)}20` }}>
                <Text style={{ color: getFeatureTypeColor(selectedFeature.typeKr), fontSize: 12, fontWeight: '600' }}>{selectedFeature.typeKr}</Text>
              </View>
              <Text style={{ color: '#6B7280', fontSize: 12 }}>{isFarSide(selectedFeature) ? '🔙 뒷면' : '🌕 앞면'}</Text>
            </View>
            <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 6 }}>
              {selectedFeature.lat.toFixed(3)}°{selectedFeature.lat >= 0 ? 'N' : 'S'}, {Math.abs(selectedFeature.lng).toFixed(3)}°{selectedFeature.lng >= 0 ? 'E' : 'W'}
            </Text>

            {/* 주요 제원 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1F2937' }}>
              <View style={{ minWidth: '40%' }}>
                <Text style={{ color: '#6B7280', fontSize: 11 }}>직경</Text>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{selectedFeature.diameterKm} km</Text>
              </View>
              {selectedFeature.areaKm2 && (
                <View style={{ minWidth: '40%' }}>
                  <Text style={{ color: '#6B7280', fontSize: 11 }}>면적</Text>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{formatArea(selectedFeature.areaKm2)}</Text>
                </View>
              )}
              {selectedFeature.depthKm && (
                <View style={{ minWidth: '40%' }}>
                  <Text style={{ color: '#6B7280', fontSize: 11 }}>깊이</Text>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{selectedFeature.depthKm} km</Text>
                </View>
              )}
              {selectedFeature.widthKm !== selectedFeature.diameterKm && (
                <View style={{ minWidth: '40%' }}>
                  <Text style={{ color: '#6B7280', fontSize: 11 }}>폭</Text>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{selectedFeature.widthKm} km</Text>
                </View>
              )}
            </View>

            {/* 설명 */}
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1F2937' }}>
              <Text style={{ color: '#9CA3AF', fontSize: 13, lineHeight: 20 }}>{selectedFeature.description}</Text>
            </View>

            {/* 관련 뉴스 + 점유 현황 버튼 */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 20 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#1F2937', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                onPress={() => router.push(`/(tabs)?search=${encodeURIComponent(selectedFeature.nameKr)}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="newspaper-outline" size={18} color="#60A5FA" style={{ marginBottom: 4 }} />
                <Text style={{ color: '#D1D5DB', fontSize: 13, fontWeight: '600' }}>관련 뉴스 →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#1F2937', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                onPress={() => setFeatureDetailMode('occupation')}
                activeOpacity={0.7}
              >
                <Ionicons name="grid-outline" size={18} color="#34D399" style={{ marginBottom: 4 }} />
                <Text style={{ color: '#D1D5DB', fontSize: 13, fontWeight: '600' }}>점유 현황 →</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 30 }} />
          </ScrollView>
        </Animated.View>
      )}

      {/* ═══ 대표 지형 점유 현황 ═══ */}
      {selectedFeature && mainMode === 'exploration' && featureDetailMode === 'occupation' && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: 0,
          backgroundColor: '#111827',
          overflow: 'hidden',
        }}>
          <OccupationStatusPanel
            onBack={() => setFeatureDetailMode('detail')}
            onGoToOccupation={() => {
              const lat = selectedFeature.lat;
              const lng = selectedFeature.lng;
              setSelectedFeature(null);
              setFeatureDetailMode('detail');
              setMainMode('occupation');
              setTimeout(() => {
                webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat, lng } }));
              }, 300);
            }}
            target={{ name: selectedFeature.nameKr, lat: selectedFeature.lat, lng: selectedFeature.lng, diameterKm: selectedFeature.diameterKm, widthKm: selectedFeature.widthKm, angle: selectedFeature.angle }}
          />
        </View>
      )}

      {/* ═══ 대표 지형 전체화면 뷰 (하단 20% 타이틀바) ═══ */}
      {selectedFeature && mainMode === 'exploration' && featureDetailMode === 'view' && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#111827',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 14,
          paddingBottom: 28,
          paddingHorizontal: 20,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity
              onPress={() => {
                setFeatureDetailMode('detail');
                webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
                setTimeout(() => {
                  webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: selectedFeature.lat, lng: selectedFeature.lng } }));
                }, 300);
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={22} color="#9CA3AF" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ color: 'white', fontSize: 17, fontWeight: '800' }}>{getFeatureTypeEmoji(selectedFeature.typeKr)} {selectedFeature.nameKr}</Text>
                <Text style={{ color: '#6B7280', fontSize: 13 }}>{selectedFeature.nameEn}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                setSelectedFeature(null);
                webviewRef.current?.postMessage(JSON.stringify({ type: 'HIDE_FEATURE_AREA' }));
                webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      <Modal
        visible={!!selectedLandmark}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedLandmark(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setSelectedLandmark(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => { }}>
            <View style={{
              backgroundColor: '#1F2937',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 40,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.1)',
            }}>
              {/* 핸들 바 */}
              <View style={{ width: 40, height: 4, backgroundColor: '#4B5563', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

              {selectedLandmark && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 32, marginRight: 12 }}>{selectedLandmark.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#F9FAFB', fontSize: 20, fontWeight: '700' }}>
                        {selectedLandmark.name}
                      </Text>
                      {selectedLandmark.type === 'apollo' && (
                        <Text style={{ color: '#60A5FA', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                          🧑‍🚀 {selectedLandmark.crew}
                        </Text>
                      )}
                    </View>
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: 15, lineHeight: 24, marginBottom: 16 }}>
                    {selectedLandmark.desc}
                  </Text>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {selectedLandmark.date && (
                      <View style={{ backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                        <Text style={{ color: '#93C5FD', fontSize: 12, fontWeight: '600' }}>📅 {selectedLandmark.date}</Text>
                      </View>
                    )}
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                      <Text style={{ color: '#9CA3AF', fontSize: 12 }}>📍 {selectedLandmark.lat.toFixed(2)}°, {selectedLandmark.lng.toFixed(2)}°</Text>
                    </View>
                  </View>


                </>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>




      {/* 점유 확정 모달 (풀스크린) */}
      <Modal
        visible={showOccupyConfirm}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowOccupyConfirm(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingBottom: 40 }}>
          {/* 헤더 */}
          <View style={styles.occupyConfirmHeader}>
            <TouchableOpacity
              onPress={() => setShowOccupyConfirm(false)}
              style={{ padding: 12, marginLeft: -4 }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={styles.occupyConfirmTitle}>점유 확정</Text>
            <View style={{ width: 48 }} />
          </View>

          {/* 콘텐츠 */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {/* 점유할 구역 섹션 */}
            <Text style={styles.ocSectionTitle}>점유할 구역</Text>
            <View style={styles.ocCellCard}>
              <View style={styles.ocCellThumb}>
                <MaterialCommunityIcons name="grid" size={28} color="#aaa" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ocCellToken}>{selectedCell?.token || selectedCell?.cellId || ''}</Text>
                <Text style={styles.ocCellLocation}>
                  {'달 ' + ((selectedCell?.lat || 0) >= 0 ? '북부' : '남부') + ' \u00B7 Mare Nubium 인근'}
                </Text>
                <Text style={styles.ocCellMeta}>
                  {(selectedCell?.area || '~0.8 km\u00B2') + '  \u00B7  미점유  \u00B7  ' + Math.abs(selectedCell?.lat || 0).toFixed(2) + '\u00B0' + ((selectedCell?.lat || 0) >= 0 ? 'N' : 'S')}
                </Text>
              </View>
            </View>

            {/* 구분선 */}
            <View style={styles.cellDivider} />

            {/* 메그 내역 */}
            <Text style={styles.ocSectionTitle}>메그 내역</Text>

            <View style={styles.ocLedgerRow}>
              <Text style={styles.ocLedgerLabel}>현재 보유 메그</Text>
              <Text style={styles.ocLedgerValue}>40 Mag</Text>
            </View>

            <View style={[styles.ocLedgerRow, { borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 14 }]}>
              <Text style={styles.ocLedgerLabel}>이번 점유 비용</Text>
              <Text style={[styles.ocLedgerValue, { color: '#EF4444' }]}>{'- ' + magCost + ' Mag'}</Text>
            </View>

            <View style={styles.ocLedgerRow}>
              <Text style={[styles.ocLedgerLabel, { fontWeight: '700' }]}>차감 후 잔액</Text>
              <Text style={[styles.ocLedgerValue, { fontSize: 22, fontWeight: '800' }]}>{Math.max(0, magBalance - magCost) + ' Mag'}</Text>
            </View>
          </ScrollView>

          {/* 하단 확정 버튼 */}
          <View style={{ paddingHorizontal: 20 }}>
            <TouchableOpacity
              style={styles.occupyConfirmButton}
              activeOpacity={0.8}
              onPress={() => {
                // 다중선택이면 multiTokens, 아니면 단일 cellId
                const cellTokens = selectedCell?.isMultiSelect
                  ? (selectedCell.multiTokens || [])
                  : (selectedCell?.cellId ? [selectedCell.cellId] : []);
                setMagBalance(prev => Math.max(0, prev - magCost));
                setMagCost(0);
                setShowOccupyConfirm(false);
                setSelectedCell(null);
                webviewRef.current?.postMessage(JSON.stringify({
                  type: 'OCCUPY_CELLS',
                  payload: { tokens: cellTokens, level: occupySelectLevel }
                }));
                setTimeout(() => {
                  const { Alert: RNAlert } = require('react-native');
                  RNAlert.alert('점유 완료', '해당 구역의 점유가 완료되었습니다!');
                }, 300);
              }}
            >
              <Text style={styles.occupyConfirmButtonText}>{'점유 확정하기  ( -' + magCost + ' Mag )'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AI 추천 모달 (새 컴포넌트) */}
      <AIZoneRecommendModal
        visible={showAIModal}
        onClose={handleCloseAIModal}
        onSelectZone={handleAISelectZone}
      />

    </View >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // 상단 헤더 컨테이너
  headerLayer: {
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },

  // 모드 토글 (탐사/점유)
  modeToggleContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  modeToggleInner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 2,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeTabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
  },
  modeTabText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#fff',
  },

  // 서브 모드 토글 (우주/1인칭/위성)
  subModeToggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  subModeTab: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  subModeTabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  subModeTabText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  subModeTabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },

  // 점유모드 검색 영역
  topSearchSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingRight: 12,
  },
  searchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTabsContainer: {
    marginBottom: 4,
  },
  locationTabsContent: {
    gap: 8,
    paddingRight: 16,
  },
  locationTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  locationTabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderColor: '#3B82F6',
  },
  locationTabText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
  },
  locationTabTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },

  // 캔버스 영역
  canvasSection: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },


  // 우측 컨트롤 버튼
  rightControls: {
    position: 'absolute',
    right: 16,
    top: 16,
    gap: 12,
    zIndex: 10,
  },
  levelSelectContainer: {
    position: 'absolute',
    top: 110,
    left: 16,
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderRadius: 10,
    padding: 3,
    zIndex: 15,
  },
  levelSelectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  levelSelectBtnActive: {
    backgroundColor: '#3B82F6',
  },
  levelSelectText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  levelSelectTextActive: {
    color: '#fff',
  },
  aiRecommendContainer: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 10,
  },
  controlBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    borderColor: 'rgba(59, 130, 246, 1)',
  },
  controlBtnDisabled: {
    backgroundColor: 'rgba(30,30,30, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },

  // 1인칭 가상 조이스틱
  joystickContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    zIndex: 50,
  },
  joystickPad: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  joyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  joyCenter: {
    width: 32,
    height: 32,
    marginHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  joyBtnUp: { padding: 4 },
  joyBtnDown: { padding: 4 },
  joyBtnLeft: { padding: 4 },
  joyBtnRight: { padding: 4 },

  // 데이터 오버레이 정보 창
  arButton: {
    backgroundColor: 'rgba(156, 39, 176, 0.8)',
    borderColor: '#9C27B0',
  },

  // 필터 모달
  filterModalContainer: {
    position: 'absolute',
    left: 16,
    top: 16,
    bottom: 16,
    width: 280,
    zIndex: 15,
  },
  filterModal: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterContent: {
    padding: 16,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filterSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  filterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  filterItemText: {
    color: '#ddd',
    fontSize: 13,
    flex: 1,
    marginRight: 12,
  },

  // 서브섹션 타이틀
  subSectionTitle: {
    fontSize: 12,
    color: '#aaa',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    paddingLeft: 4,
  },

  // 투명도 조절
  opacitySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },

  sliderContainer: {
    marginVertical: 8,
  },

  sliderLabel: {
    fontSize: 13,
    color: '#ccc',
    marginBottom: 8,
  },

  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  sliderValue: {
    marginBottom: 4,
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },

  sliderHint: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // 범례 (Legend)
  legendSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },

  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  legendItem: {
    marginBottom: 16,
  },

  legendTitle: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 8,
  },

  gradientBar: {
    height: 20,
    borderRadius: 4,
    marginBottom: 6,
    // React Native에서는 linear gradient를 직접 지원하지 않으므로
    // 임시로 단색 배경 사용 (추후 react-native-linear-gradient 사용 가능)
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },

  legendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  legendLabel: {
    fontSize: 11,
    color: '#888',
  },


  // 하단 셀 정보 카드
  bottomCardContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomCard: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  bottomCard2: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  dragHandleArea: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: 0,
  },
  cellHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cellToken: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cellMagSize: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  cellMagLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  cellSubInfo: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  cellUrn: {
    fontSize: 12,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
    marginBottom: 4,
  },
  cellDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 14,
  },
  cellPriceLabel: {
    fontSize: 13,
    color: '#888',
  },
  cellPriceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginTop: 2,
    marginBottom: 14,
  },
  occupyButton: {
    backgroundColor: '#222',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  occupyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 10,
    textTransform: 'uppercase' as const,
  },
  poiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  poiThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  poiDetail: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  poiDistance: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 1,
  },
  poiLink: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  occupyConfirmContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  occupyConfirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  occupyConfirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  ocSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
  },
  ocCellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  ocCellThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocCellToken: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  ocCellLocation: {
    fontSize: 13,
    color: '#666',
    marginTop: 3,
  },
  ocCellMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  ocLedgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  ocLedgerLabel: {
    fontSize: 15,
    color: '#444',
  },
  ocLedgerValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  occupyConfirmButton: {
    backgroundColor: '#222',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  occupyConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardContent: {
    gap: 8,
  },
  cardCoords: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: '#888',
    fontSize: 14,
  },
  infoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },

  // 상세정보 펼쳐보기 버튼
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.15)',
  },
  expandButtonText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // 상세 정보 섹션
  detailSection: {
    marginTop: 8,
    paddingTop: 8,
  },
  detailSectionTitle: {
    color: 'rgba(255, 215, 0, 0.7)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  mineralGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mineralItem: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  mineralLabel: {
    color: '#888',
    fontSize: 11,
    marginBottom: 4,
  },
  mineralValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // 가격 섹션
  priceSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
  },
  priceLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  priceValue: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },

  // 구매 버튼
  buyButton: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FFD700',
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // 광물 범례 (맵 오버레이)
  mapLegendContainer: {
    position: 'absolute',
    bottom: 20,
    right: 80,
    zIndex: 10,
  },
  mapLegend: {
    backgroundColor: 'rgba(0, 5, 15, 0.9)',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00f0ff',
    minWidth: 200,
  },
  mapLegendTitle: {
    color: '#00f0ff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  mapGradientBar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  mapLegendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  // 옵션 메뉴 스타일
  optionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  optionMenuText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 5,
  },
  mapLegendValue: {
    color: '#00f0ff',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  mapLegendUnit: {
    color: '#aaa',
    fontSize: 10,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // 로딩
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  magDisplay: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 20,
  },
  magLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },
  magRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  magBalance: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  magCost: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '700',
  },
  magSlash: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '400',
  },
  cellMagId: {
    color: '#111',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cellS2Id: {
    color: 'rgba(0,0,0,0.4)',
    fontSize: 11,
    marginTop: 2,
  },

  /* ── 광물 셀 클릭 팝업 ── */
  mineralCellPopup: {
    position: 'absolute',
    top: 120,
    left: 12,
    zIndex: 12,
    maxWidth: Dimensions.get('window').width * 0.75,
  },
  mineralCellBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  mineralCellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mineralCellDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  mineralCellTitle: {
    color: '#ddd',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  mineralCellValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  mineralCellCoord: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
});
