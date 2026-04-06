import React, { useRef, useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Dimensions, ActivityIndicator, ScrollView, Switch, TextInput, Modal, Animated, PanResponder, Share, Alert, Image, AppState, DeviceEventEmitter } from 'react-native';
import { WebView } from 'react-native-webview';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, router } from 'expo-router';
import { createCesiumHtml } from '@/constants/cesium/CesiumHtml';
import { loadMineralData } from '@/utils/mineralDataLoader';
import AR2MoonViewer from '@/components/AR2MoonViewer';
import OccupationStatusPanel from '@/components/OccupationStatusPanel';
import AIZoneRecommendModal from '@/components/AIZoneRecommendModal';
import { useEll, ELL_PER_MAG } from '@/components/EllContext';
import ResourceScannerPanel from '@/components/ResourceScannerPanel';
import ExplorationListPanel, { PANEL_SCREEN_H, SNAP_MIN, SNAP_MAX } from '@/components/ExplorationListPanel';
import ExplorationListPanelB from '@/components/ExplorationListPanelB';
import ExplorationListPanelC from '@/components/ExplorationListPanelC';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { LIVE_MISSIONS, Spacecraft } from '@/constants/SpacecraftData';
import { fetchSpacecraftPosition, fetchSpacecraftTrajectory } from '@/services/HorizonsApi';
import { LANDING_SITES, LandingSite, sortByYear, sortByCountry, findNearbySites, getContactColor, COUNTRY_NAMES } from '@/constants/LandingSiteData';
import { LUNAR_FEATURES, LunarFeature, sortByType, sortBySize, getFeatureTypeColor, getFeatureTypeEmoji, formatArea, isFarSide, findNearbyFeatures } from '@/constants/LunarFeatureData';
import { LANDING_SITE_IMAGES, LUNAR_FEATURE_IMAGES } from '@/constants/LunarImages';
import { addScrapArea, removeScrapArea, isAreaScrapped } from '@/constants/scrapStore';
import { getAllOccupiedTokens, getUserOccupiedCells, getCellOwnerFromDB, occupyCell } from '@/services/CellService';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/components/AuthContext';
import * as Linking from 'expo-linking';
import { onJumpRequest, consumeJumpRequest } from '@/constants/jumpToCellStore';

export default function MoonScreen() {
  const { isLoggedIn, user, refreshUser } = useAuth();
  const webviewRef = useRef<WebView>(null);
  const skipCameraResetRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [cesiumHtmlUri, setCesiumHtmlUri] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showAd, setShowAd] = useState(false);
  const [tilesetLoading, setTilesetLoading] = useState(false);
  const pendingModeRef = useRef<string | null>(null); // WebView 미로드 시 대기할 모드
  const pendingJumpCellRef = useRef<string | null>(null); // TILESET_READY 후 JUMP_TO_CELL 대기
  const [webviewReady, setWebviewReady] = useState(false); // WebView JS 초기화 완료
  const [modeTransitioning, setModeTransitioning] = useState(false); // 모드 전환 중 잠금
  const [webviewKey, setWebviewKey] = useState(0); // WebView 크래시 복구용 키
  const appStateRef = useRef(AppState.currentState);

  // 스플래시 오버레이
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // 모드 상태 추가
  const [mainMode, setMainMode] = useState<'exploration' | 'occupation' | 'test1' | 'test2' | 'test3'>('exploration');
  const isOccupation = mainMode === 'occupation' || mainMode === 'test1' || mainMode === 'test2' || mainMode === 'test3';
  const [featureHighlight, setFeatureHighlight] = useState<{ name: string; lat: number; lng: number; radiusKm: number } | null>(null);
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
  const [showCellDetail, setShowCellDetail] = useState(false);
  const [showOccupyConfirm, setShowOccupyConfirm] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const [occupySelectLevel, setOccupySelectLevel] = useState(16);
  const { ellBalance, remainingMag, spendEll, purchasedTerritories, addDemoTerritory, refreshBalance } = useEll();
  const magBalance = remainingMag; // WebView 동기화 및 하위 호환용
  const [magCost, setMagCost] = useState(0);

  const insets = useSafeAreaInsets();

  // 바텀시트 드래그
  const SHEET_MAX_HEIGHT = 420;
  const SHEET_PEEK_HEIGHT = 260;
  const SHEET_COLLAPSE = SHEET_MAX_HEIGHT - SHEET_PEEK_HEIGHT;
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
        const vy = g.vy;
        let target;
        if (Math.abs(vy) > 0.5) {
          target = vy > 0 ? SHEET_COLLAPSE : 0;
        } else {
          target = cur > SHEET_COLLAPSE / 2 ? SHEET_COLLAPSE : 0;
        }
        Animated.spring(sheetTranslateY, { toValue: target, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
        sheetOffset.current = target;
      },
    })
  ).current;

  // B모드 바텀시트 (기본높이 절반, A모드보다 높게 확장 가능하되 SafeArea 침범 안함)
  const screenH = Dimensions.get('window').height;
  const SHEET_B_MAX = screenH * 0.75;
  const SHEET_B_PEEK = 140;
  const SHEET_B_COLLAPSE = SHEET_B_MAX - SHEET_B_PEEK;
  const sheetBCollapseRef = useRef(SHEET_B_COLLAPSE);
  sheetBCollapseRef.current = SHEET_B_COLLAPSE; // 매 렌더마다 최신값 갱신
  const sheetBTranslateY = useRef(new Animated.Value(SHEET_B_COLLAPSE)).current;
  const sheetBOffset = useRef(SHEET_B_COLLAPSE);
  const sheetBPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        sheetBTranslateY.stopAnimation((v) => { sheetBOffset.current = v; });
      },
      onPanResponderMove: (_, g) => {
        const collapse = sheetBCollapseRef.current;
        const newVal = Math.max(0, Math.min(collapse, sheetBOffset.current + g.dy));
        sheetBTranslateY.setValue(newVal);
      },
      onPanResponderRelease: (_, g) => {
        const collapse = sheetBCollapseRef.current;
        const cur = sheetBOffset.current + g.dy;
        const vy = g.vy;
        let target;
        if (Math.abs(vy) > 0.5) {
          target = vy > 0 ? collapse : 0;
        } else {
          target = cur > collapse / 2 ? collapse : 0;
        }
        Animated.spring(sheetBTranslateY, { toValue: target, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
        sheetBOffset.current = target;
      },
    })
  ).current;

  // 탐사 모드(Exploration) 동적 상태 및 위성 선택 상태
  // 위성 상세 패널: ExplorationListPanel과 정확히 동일한 공유 상수 (top값)
  const SAFE_TOP = insets.top || 54;
  const SAT_PANEL_COLLAPSED = SNAP_MIN; // top=70% (높이 30%)
  const SAT_PANEL_EXPANDED = SNAP_MAX;  // top=55% (높이 45%)
  const satPanelAnim = useRef(new Animated.Value(SAT_PANEL_COLLAPSED)).current;
  const satPanelOffsetRef = useRef(SAT_PANEL_COLLAPSED);
  const satPanelPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        const newVal = Math.max(SAFE_TOP, Math.min(SAT_PANEL_COLLAPSED, satPanelOffsetRef.current + g.dy));
        satPanelAnim.setValue(newVal);
      },
      onPanResponderRelease: (_, g) => {
        const cur = satPanelOffsetRef.current + g.dy;
        const vy = g.vy;
        let target;
        if (Math.abs(vy) > 0.5) {
          if (vy < 0) { target = SAFE_TOP; }
          else { target = SAT_PANEL_COLLAPSED; }
        } else if (cur < SAT_PANEL_EXPANDED * 0.5) { target = SAFE_TOP; }
        else { const mid = (SAT_PANEL_COLLAPSED + SAT_PANEL_EXPANDED) / 2; target = cur > mid ? SAT_PANEL_COLLAPSED : SAT_PANEL_EXPANDED; }
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
        const newVal = Math.max(SAFE_TOP, Math.min(SNAP_MIN, landingPanelOffsetRef.current + g.dy));
        landingPanelAnim.setValue(newVal);
      },
      onPanResponderRelease: (_, g) => {
        const cur = landingPanelOffsetRef.current + g.dy;
        const vy = g.vy;
        let target;
        if (Math.abs(vy) > 0.5) {
          if (vy < 0) { target = SAFE_TOP; }
          else { target = SNAP_MIN; }
        } else if (cur < SNAP_MAX * 0.5) { target = SAFE_TOP; }
        else { const mid = (SNAP_MIN + SNAP_MAX) / 2; target = cur > mid ? SNAP_MIN : SNAP_MAX; }
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
        const newVal = Math.max(SAFE_TOP, Math.min(SNAP_MIN, featurePanelOffsetRef.current + g.dy));
        featurePanelAnim.setValue(newVal);
      },
      onPanResponderRelease: (_, g) => {
        const cur = featurePanelOffsetRef.current + g.dy;
        const vy = g.vy;
        let target;
        if (Math.abs(vy) > 0.5) {
          if (vy < 0) { target = SAFE_TOP; }
          else { target = SNAP_MIN; }
        } else if (cur < SNAP_MAX * 0.5) { target = SAFE_TOP; }
        else { const mid = (SNAP_MIN + SNAP_MAX) / 2; target = cur > mid ? SNAP_MIN : SNAP_MAX; }
        Animated.spring(featurePanelAnim, { toValue: target, useNativeDriver: false, bounciness: 4, speed: 14 }).start();
        featurePanelOffsetRef.current = target;
      },
    })
  ).current;
  const [selectedSatellite, setSelectedSatellite] = useState<any>(null);
  const satIsLookAt = useRef(false);
  const [satIsLookAtState, setSatIsLookAtState] = useState(false);
   const landingIsFirstPerson = useRef(false);
  const featureIsFirstPerson = useRef(false);

  // ── 통합 네비게이션 헬퍼 ──
  const goToLandingSite = (site: LandingSite) => {
    setSelectedLandingSite(site);
    setLandingSiteDetailMode('detail');
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'GO_TO_LOCATION',
      payload: { lat: site.lat, lng: site.lng, orbit: landingIsFirstPerson.current }
    }));
  };

  const goToFeature = (feat: LunarFeature) => {
    setSelectedFeature(feat);
    setFeatureDetailMode('detail');
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'GO_TO_LOCATION',
      payload: { lat: feat.lat, lng: feat.lng, orbit: featureIsFirstPerson.current }
    }));
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'SHOW_FEATURE_AREA',
      payload: { lat: feat.lat, lng: feat.lng, diameterKm: feat.diameterKm, widthKm: (feat as any).widthKm, angle: (feat as any).angle, typeKr: feat.typeKr, typeEn: (feat as any).typeEn }
    }));
  };

  const toggleLandingView = () => {
    if (!selectedLandingSite) return;
    if (landingIsFirstPerson.current) {
      landingIsFirstPerson.current = false;
      webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: selectedLandingSite.lat, lng: selectedLandingSite.lng } }));
    } else {
      landingIsFirstPerson.current = true;
      webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: selectedLandingSite.lat, lng: selectedLandingSite.lng, orbit: true } }));
    }
  };

  const toggleFeatureView = () => {
    if (!selectedFeature) return;
    if (featureIsFirstPerson.current) {
      featureIsFirstPerson.current = false;
      webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: selectedFeature.lat, lng: selectedFeature.lng } }));
    } else {
      featureIsFirstPerson.current = true;
      webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: selectedFeature.lat, lng: selectedFeature.lng, orbit: true } }));
    }
  };

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
  const [showFeaturePanelB, setShowFeaturePanelB] = useState(false);
  const [showFeaturePanelC, setShowFeaturePanelC] = useState(false);
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
  // 지질맵 상태
  const [showGeologyLinear, setShowGeologyLinear] = useState(false);
  const [showGeologyUnit, setShowGeologyUnit] = useState(false);
  const [geologyLinearLoaded, setGeologyLinearLoaded] = useState(false);
  const [geologyUnitLoaded, setGeologyUnitLoaded] = useState(false);

  const [landmarkListData, setLandmarkListData] = useState<any>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<any>(null);
  const [selectedLandingSite, setSelectedLandingSite] = useState<LandingSite | null>(null);
  const [landingSiteDetailMode, setLandingSiteDetailMode] = useState<'detail' | 'view' | 'occupation'>('detail');
  const [isLandingScrapped, setIsLandingScrapped] = useState(false);
  const [landingSortMode, setLandingSortMode] = useState<'year' | 'country'>('year');
  const sortedLandingSites = useMemo(() => {
    return landingSortMode === 'year' ? sortByYear(LANDING_SITES) : sortByCountry(LANDING_SITES);
  }, [landingSortMode]);

  // ═══ 대표 지형 ═══
  const [selectedFeature, setSelectedFeature] = useState<LunarFeature | null>(null);
  const [featureDetailMode, setFeatureDetailMode] = useState<'detail' | 'view' | 'occupation'>('detail');
  const [isFeatureScrapped, setIsFeatureScrapped] = useState(false);
  const [featureSortMode, setFeatureSortMode] = useState<'type' | 'size'>('type');
  const sortedFeatures = useMemo(() => {
    return featureSortMode === 'type' ? sortByType(LUNAR_FEATURES) : sortBySize(LUNAR_FEATURES);
  }, [featureSortMode]);


  // ── 스크랩 상태 체크 ──
  useEffect(() => {
    if (selectedLandingSite) {
      isAreaScrapped(`landing-${selectedLandingSite.officialName}`).then(setIsLandingScrapped);
    } else {
      setIsLandingScrapped(false);
    }
  }, [selectedLandingSite]);

  useEffect(() => {
    if (selectedFeature) {
      isAreaScrapped(`feature-${selectedFeature.id}`).then(setIsFeatureScrapped);
    } else {
      setIsFeatureScrapped(false);
    }
  }, [selectedFeature]);

  // 점유 현황 슬라이드 애니메이션
  const occupationSlideAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;
  useEffect(() => {
    if (landingSiteDetailMode === 'occupation' || featureDetailMode === 'occupation') {
      occupationSlideAnim.setValue(Dimensions.get('window').width);
      Animated.timing(occupationSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [landingSiteDetailMode, featureDetailMode]);


  // ═══ WebView 크래시 / 백그라운드 복귀 자동 복구 ═══
  const reloadWebView = () => {
    console.warn('[WebView] Reloading — saving current mode:', mainMode);
    // 현재 모드 저장 → WebView 재생성 후 INIT_COMPLETE 시 자동 복원
    if (mainMode === 'test2' || mainMode === 'test1' || mainMode === 'test3') {
      pendingModeRef.current = mainMode;
    }
    setLoading(true);
    setWebviewReady(false);
    setWebviewKey(prev => prev + 1);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // 백그라운드→포그라운드 전환 시 WebView 리로드
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[AppState] Foreground restored — checking WebView health');
        // WebView가 아직 메시지를 보낼 수 있는지 핑 체크
        const healthTimeout = setTimeout(() => {
          // 2초 안에 PONG 안 오면 WebView 죽은 것으로 판단
          console.warn('[AppState] WebView health check timeout — reloading');
          reloadWebView();
        }, 2000);
        // PING 보내기
        try {
          webviewRef.current?.injectJavaScript(`
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PONG' }));
            } catch(e) {}
            true;
          `);
        } catch (e) {
          // injectJavaScript 자체가 실패하면 즉시 리로드
          clearTimeout(healthTimeout);
          reloadWebView();
        }
        // PONG 수신 시 타이머 해제는 handleWebViewMessage에서 처리
        (globalThis as any).__webviewHealthTimeout = healthTimeout;
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, [mainMode]);

  // ═══ Phase 1.5: Cesium HTML을 파일로 저장 (file:// URI로 WebView 로드) ═══
  useEffect(() => {
    (async () => {
      try {
        // 지구 텍스처 base64 로드
        let earthBase64 = '';
        try {
          const earthAsset = Asset.fromModule(require('../../assets/images/earth.jpg'));
          await earthAsset.downloadAsync();
          if (earthAsset.localUri) {
            const b64 = await FileSystem.readAsStringAsync(earthAsset.localUri, { encoding: 'base64' });
            earthBase64 = `data:image/jpeg;base64,${b64}`;
            console.log('[Phase 1.5] Earth texture loaded, length:', earthBase64.length);
          }
        } catch (e) { console.warn('Earth texture load error:', e); }

        const htmlContent = createCesiumHtml('', '', earthBase64);
        const htmlPath = FileSystem.documentDirectory + 'cesium_viewer.html';
        await FileSystem.writeAsStringAsync(htmlPath, htmlContent, { encoding: FileSystem.EncodingType.UTF8 });
        setCesiumHtmlUri(htmlPath);
        console.log('[Phase 1.5] Cesium HTML saved to file:', htmlPath);
      } catch (e) { console.warn('HTML file save error:', e); }
    })();
  }, []);

  // ═══ Phase 2: GLB 모델 (+5초) ═══
  // 달 3D 타일 렌더링 안정화 후 모델 주입
  const glbLoadedRef = useRef(false);
  useEffect(() => {
    if (loading || glbLoadedRef.current) return;
    const timer = setTimeout(() => {
      glbLoadedRef.current = true;
      console.log('[Phase 2] GLB model loading started');
      (async () => {
        // 헬퍼: asset을 다운로드 → documentDirectory에 복사 → file:// URI로 전달
        // base64 변환은 수십 MB GLB에서 메모리 초과 → file:// URI 직접 사용
        async function injectGlb(requirePath: any, modelName: string) {
          try {
            const asset = await Asset.fromModule(requirePath).downloadAsync();
            if (!asset.localUri) return;

            // documentDirectory에 복사 (WebView와 같은 디렉토리 → file:// 접근 가능)
            const destPath = FileSystem.documentDirectory + modelName + '.glb';
            // 항상 최신 파일로 덮어쓰기 (캐시된 구버전 방지)
            const fileInfo = await FileSystem.getInfoAsync(destPath);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(destPath, { idempotent: true });
            }
            await FileSystem.copyAsync({ from: asset.localUri, to: destPath });
            const uri = destPath;
            const msg: any = { type: 'SET_MODEL_URI', model: modelName, uri };
            // apollo 모델의 경우 공유 사이트 데이터 첨부
            if (modelName === 'apollo') {
              const { LANDING_MODELS } = require('../../constants/landingModels');
              msg.sites = LANDING_MODELS.map((m: any) => ({ lat: m.lat, lng: m.lng, height: m.height, scale: m.scale }));
            }
            webviewRef.current?.postMessage(JSON.stringify(msg));
            console.log(`[Phase 2] ${modelName} GLB injected via file:// (${Math.round((asset.width || 0) / 1024)}KB)`);
          } catch (e) { console.warn(`${modelName} GLB load error:`, e); }
        }

        await injectGlb(require('../../assets/3d/apollo_11_lunar_module.glb'), 'apollo');
        await injectGlb(require('../../assets/3d/danuri.glb'), 'danuri');

        await injectGlb(require('../../assets/3d/capstone.glb'), 'capstone');
        await injectGlb(require('../../assets/3d/lro.glb'), 'lro');
        await injectGlb(require('../../assets/3d/artemis_ii.glb'), 'artemis_ii');
        await injectGlb(require('../../assets/3d/themis.glb'), 'themis');
        await injectGlb(require('../../assets/3d/chandrayaan-2.glb'), 'chandrayaan2');
        await injectGlb(require('../../assets/3d/flag.glb'), 'flag');

        console.log('[Phase 2] GLB model loading completed');
      })();
    }, 2000);
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

  // ═══ Phase 4: 지질맵 데이터 (+12초) ═══
  useEffect(() => {
    if (loading) return;
    const loadGeology = async () => {
      try {
        console.log('[Phase 4] Geology data loading started');
        const geojson = require('@/assets/data/lunar_linear_features.json');
        const features = geojson.features;
        console.log('[Phase 4] Geology linear features:', features.length);

        // 청크 분할 전송 (각 500개씩)
        const chunkSize = 500;
        for (let i = 0; i < features.length; i += chunkSize) {
          const chunk = features.slice(i, i + chunkSize);
          const isLast = i + chunkSize >= features.length;
          const chunkIdx = i / chunkSize;
          setTimeout(() => {
            webviewRef.current?.postMessage(JSON.stringify({
              type: 'LOAD_GEOLOGY_LINEAR',
              features: chunk,
            }));
            if (isLast) {
              console.log('[Phase 4] Geology linear data sent completely');
              setGeologyLinearLoaded(true);
            }
          }, 200 * chunkIdx);
        }
      } catch (error) {
        console.error('[Phase 4] Geology data error:', error);
      }
    };
    const timer = setTimeout(loadGeology, 12000);
    return () => clearTimeout(timer);
  }, [loading]);

  // 지질맵 토글 핸들러
  const toggleGeologyLinear = (enabled: boolean) => {
    setShowGeologyLinear(enabled);
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'TOGGLE_GEOLOGY_LINEAR', enabled
    }));
  };

  const toggleGeologyUnit = async (enabled: boolean) => {
    setShowGeologyUnit(enabled);
    if (enabled && !geologyUnitLoaded) {
      try {
        const { Asset } = require('expo-asset');
        const FileSystem = require('expo-file-system/legacy');
        const asset = Asset.fromModule(require('@/assets/images/geology_units.png'));
        await asset.downloadAsync();
        if (asset.localUri) {
          const base64 = await FileSystem.readAsStringAsync(asset.localUri, { encoding: 'base64' });
          const dataUri = 'data:image/png;base64,' + base64;
          webviewRef.current?.postMessage(JSON.stringify({
            type: 'LOAD_GEOLOGY_UNIT_IMAGE', data: dataUri
          }));
          setGeologyUnitLoaded(true);
          console.log('[Phase 4] Geology unit raster sent');
        }
      } catch (e) {
        console.error('[Phase 4] Geology unit load error:', e);
      }
    }
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'TOGGLE_GEOLOGY_UNIT', enabled
    }));
  };

  // ═══ 딥링크 수신 핸들러: 공유 링크로 앱 열릴 때 해당 위치로 이동 ═══
  useEffect(() => {
    if (loading) return;

    const handleDeepLink = (url: string) => {
      const parsed = Linking.parse(url);
      if (!parsed.queryParams?.lat || !parsed.queryParams?.lng) return;

      const lat = parseFloat(parsed.queryParams.lat as string);
      const lng = parseFloat(parsed.queryParams.lng as string);
      const type = parsed.queryParams.type as string;
      const name = parsed.queryParams.name as string;

      if (isNaN(lat) || isNaN(lng)) return;
      console.log('[DeepLink] Flying to:', name, lat, lng, type);

      // 카메라 이동
      setTimeout(() => {
        webviewRef.current?.postMessage(JSON.stringify({
          type: 'FLY_TO_LOCATION',
          payload: { lat, lng }
        }));

        // 착륙지/지형 상세패널 자동 오픈
        if (type === 'landing') {
          const site = LANDING_SITES.find(s => s.nameKr === name || (Math.abs(s.lat - lat) < 0.1 && Math.abs(s.lng - lng) < 0.1));
          if (site) {
            setShowLandingSites(true);
            webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_LANDING_SITES', enabled: true }));
            setSelectedLandingSite(site);
          }
        } else if (type === 'feature') {
          const feat = LUNAR_FEATURES.find(f => f.nameKr === name || (Math.abs(f.lat - lat) < 0.1 && Math.abs(f.lng - lng) < 0.1));
          if (feat) {
            setShowTerrain(true);
            webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_TERRAIN', enabled: true }));
            setSelectedFeature(feat);
          }
        }
      }, 1500); // WebView 로딩 후 실행
    };

    // 앱이 이미 열려있을 때 받는 딥링크
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // 앱이 딥링크로 처음 열렸을 때
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [loading]);

  // ═══ 개척모드 진입 시 탐사모드 필터 전체 초기화 ═══
  useEffect(() => {
    if (mainMode === 'occupation' || mainMode === 'test1' || mainMode === 'test2' || mainMode === 'test3') {
      // 자원 스캐너 비활성화
      if (showResourceScanner) {
        setShowResourceScanner(false);
      }
      if (activeScannedResource) {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MINERAL_FILTER', payload: { filter: activeScannedResource, enabled: false } }));
        setActiveScannedResource(null);
      }
      // 히트맵 하이라이트 클리어
      webviewRef.current?.postMessage(JSON.stringify({ type: 'CLEAR_MINERAL_HIGHLIGHT' }));
      setMineralCellInfo(null);

      // 위성/착륙지점/지형 표시 끄기
      setShowSatellites(false);
      setShowLandingSites(false);
      setShowTerrain(false);
      webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_LANDING_SITES', enabled: false }));
      webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_TERRAIN', enabled: false }));

      // 환경 히트맵 끄기
      webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_THERMAL_GRID', enabled: false }));
      webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_GRAVITY_MAP', enabled: false }));
      webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_NEUTRON_MAP', enabled: false }));

      // 탐사 패널 닫기
      setShowFeaturePanel(false);
      setShowFeaturePanelB(false);
      setShowFeaturePanelC(false);

      // 선택 항목 해제
      setSelectedSatellite(null);
      setSelectedLandingSite(null);
      setSelectedFeature(null);

      // 지형 영역 표시 제거
      webviewRef.current?.postMessage(JSON.stringify({ type: 'HIDE_FEATURE_AREA' }));
    }
  }, [mainMode]);

  // ═══ 점유모드 진입 시 자동으로 DB에서 토큰 로드 ═══
  useEffect(() => {
    if (mainMode === 'occupation' || mainMode === 'test1' || mainMode === 'test2' || mainMode === 'test3') {
      (async () => {
        try {
          // DB에서 현재 점유 토큰 로드 → WebView 전달
          const tokens = await getAllOccupiedTokens();
          const myCells = user?.id ? await getUserOccupiedCells(user.id) : [];
          const myTokens = myCells.map(c => c.cellId);
          console.log(`[Mode→${mainMode}] Loaded ${tokens.length} occupied, ${myTokens.length} mine`);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_OCCUPIED_TOKENS', payload: { tokens, myTokens } }));
        } catch (e) {
          console.log('[Mode] Failed to auto-load occupied tokens', e);
        }
      })();
    }
  }, [mainMode]);

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
    if (!loading && params.lat && params.lng && !params.cellToken) {
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

  // 내 구역 관리 → 추가 구역 개척 → 개척 모드 자동 전환
  useEffect(() => {
    if (!loading && params.mode === 'pioneer') {
      setMainMode('test2');
    }
  }, [loading, params.mode]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('switchToPioneer', () => {
      setMainMode('test2');
    });
    return () => sub.remove();
  }, []);

  // 인사이트 기사 하이퍼링크 → 탐사모드에서 착륙지/지형 선택
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('navigateToExploration', (data: { lat: number; lng: number; name: string; type: 'landing' | 'feature' }) => {
      if (loading) return;
      console.log('[NewsLink] navigateToExploration:', data.type, data.name, data.lat, data.lng);

      // 탐사모드로 전환 (개척모드였을 수 있음)
      setMainMode('exploration');

      // 기존에 열려있던 목록 패널 + 선택 상태 모두 초기화
      setShowFeaturePanel(false);
      setShowFeaturePanelB(false);
      setShowFeaturePanelC(false);
      setSelectedLandingSite(null);
      setSelectedFeature(null);
      setSelectedSatellite(null);

      setTimeout(() => {
        if (data.type === 'landing') {
          setShowLandingSites(true);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_LANDING_SITES', enabled: true }));
          const site = LANDING_SITES.find(s => s.nameKr === data.name || s.officialName === data.name);
          if (site) {
            setSelectedLandingSite(site);
            setLandingSiteDetailMode('detail');
            webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: site.lat, lng: site.lng } }));
          } else {
            webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: data.lat, lng: data.lng } }));
          }
        } else if (data.type === 'feature') {
          setShowTerrain(true);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_TERRAIN', enabled: true }));
          const feat = LUNAR_FEATURES.find(f => f.nameKr === data.name || f.nameEn === data.name);
          if (feat) {
            setSelectedFeature(feat);
            setFeatureDetailMode('detail');
            webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: feat.lat, lng: feat.lng } }));
            webviewRef.current?.postMessage(JSON.stringify({ type: 'SHOW_FEATURE_AREA', payload: { lat: feat.lat, lng: feat.lng, diameterKm: feat.diameterKm, widthKm: feat.widthKm, angle: feat.angle, typeKr: feat.typeKr } }));
          } else {
            webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: data.lat, lng: data.lng } }));
          }
        }
      }, 500);
    });
    return () => sub.remove();
  }, [loading]);

  // 스크랩북 관심영역 → 탐사모드에서 패널 열기 + 지점 선택
  useEffect(() => {
    if (!loading && params.highlightLat && params.highlightLng) {
      const lat = parseFloat(params.highlightLat as string);
      const lng = parseFloat(params.highlightLng as string);
      const name = (params.highlightName as string) || '';
      const scrapType = params.scrapType as string;
      const scrapName = params.scrapName as string;
      console.log('[Scrapbook] Request:', scrapType, scrapName, lat, lng);

      if (scrapType && scrapName) {
        // 탐사모드에서 해당 지점 선택
        setTimeout(() => {
          if (scrapType === 'landing') {
            // 착륙지 토글 켜기
            setShowLandingSites(true);
            webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_LANDING_SITES', enabled: true }));
            // 착륙지 이름으로 매칭
            const site = LANDING_SITES.find(s => s.nameKr === scrapName || s.officialName === scrapName);
            if (site) {
              setSelectedLandingSite(site);
              setLandingSiteDetailMode('detail');
              webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: site.lat, lng: site.lng } }));
            } else {
              // 매칭 실패 시 좌표로 이동
              webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat, lng } }));
            }
          } else if (scrapType === 'feature') {
            // 지형 토글 켜기
            setShowTerrain(true);
            webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_TERRAIN', enabled: true }));
            // 지형 이름으로 매칭
            const feat = LUNAR_FEATURES.find(f => f.nameKr === scrapName || f.nameEn === scrapName);
            if (feat) {
              setSelectedFeature(feat);
              setFeatureDetailMode('detail');
              webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: feat.lat, lng: feat.lng } }));
              webviewRef.current?.postMessage(JSON.stringify({ type: 'SHOW_FEATURE_AREA', payload: { lat: feat.lat, lng: feat.lng, diameterKm: feat.diameterKm, widthKm: feat.widthKm, angle: feat.angle, typeKr: feat.typeKr } }));
            } else {
              webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat, lng } }));
            }
          }
        }, 1500);
      } else {
        // 기존 하이라이트 방식 (scrapType 없는 경우)
        setTimeout(() => {
          webviewRef.current?.postMessage(JSON.stringify({
            type: 'GO_TO_LOCATION',
            payload: { lat, lng }
          }));
          setTimeout(() => {
            webviewRef.current?.postMessage(JSON.stringify({
              type: 'SET_FEATURE_HIGHLIGHT',
              payload: { lat, lng, name, radiusKm: 5 }
            }));
          }, 1500);
        }, 1000);
      }
    }
  }, [loading, params.highlightLat, params.highlightLng]);

  // 구역 상세 → 지도에서 보기: 글로벌 스토어 리스너로 점프 요청 처리
  const mainModeRef = useRef(mainMode);
  mainModeRef.current = mainMode;

  useEffect(() => {
    // 마운트 또는 loading 변경 시: 스토어 + ref 양쪽 확인
    if (!loading) {
      const pending = consumeJumpRequest();
      const pendingToken = pending?.token || pendingJumpCellRef.current;
      if (pendingToken) {
        pendingJumpCellRef.current = null;
        handleJumpToCell(pendingToken);
      }
    }

    const unsub = onJumpRequest((req) => {
      if (!req) return;
      consumeJumpRequest(); // 소비 처리
      if (!loading) {
        handleJumpToCell(req.token);
      } else {
        // loading 중이면 ref에 저장 → loading=false 될 때 위에서 처리
        pendingJumpCellRef.current = req.token;
      }
    });
    return unsub;
  }, [loading]);

  function handleJumpToCell(token: string) {
    console.log('[CellView] handleJumpToCell called:', token, 'currentMode:', mainModeRef.current, 'loading:', loading);
    pendingJumpCellRef.current = token;

    // mypage에서 올 수 있으므로 확실하게 index(moon) 탭으로 전환
    router.navigate('/(tabs)' as any);

    if (mainModeRef.current !== 'test2') {
      console.log('[CellView] switching to test2 mode');
      setMainMode('test2');
    } else {
      console.log('[CellView] already test2, re-sending ENTER_TEST2_MODE');
      // 이미 test2 모드: ENTER_TEST2_MODE 재전송 → TILESET_READY 트리거
      webviewRef.current?.postMessage(JSON.stringify({ type: 'REMOVE_ALL_3D_MODELS' }));
      webviewRef.current?.postMessage(JSON.stringify({ type: 'ENTER_TEST2_MODE' }));
      setTilesetLoading(true);
    }
  }

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
        // WebView 헬스체크 응답 — 타이머 해제
        case 'PONG':
          if ((globalThis as any).__webviewHealthTimeout) {
            clearTimeout((globalThis as any).__webviewHealthTimeout);
            (globalThis as any).__webviewHealthTimeout = null;
            console.log('[AppState] WebView is alive — skip reload');
          }
          break;
        // case 'DEBUG_LOG' removed as requested
        case 'DEBUG_LOG':
          console.log('[Cesium]', message.payload);
          break;
        case 'CELL_SELECTED':
          console.log('[WebView] CELL_SELECTED:', message.payload);
          const wasEmpty = !selectedCell;
          setSelectedCell(message.payload);
          setCellExpanded(false);
          setMagCost(message.payload.magCount || message.payload.cellCount || 1);
          // 처음 셀 선택 시에만 접힌 상태로 시작, 이후에는 현재 위치 유지
          if (wasEmpty) {
            sheetTranslateY.setValue(SHEET_COLLAPSE);
            sheetOffset.current = SHEET_COLLAPSE;
            sheetBTranslateY.setValue(SHEET_B_COLLAPSE);
            sheetBOffset.current = SHEET_B_COLLAPSE;
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
        case 'TILESET_LOADING':
          setTilesetLoading(true);
          break;
        case 'TILESET_READY':
          console.log('[CellView] TILESET_READY received, pendingJump:', pendingJumpCellRef.current);
          setTilesetLoading(false);
          setModeTransitioning(false);
          // pending jump가 있으면 tileset 준비 후 실행
          if (pendingJumpCellRef.current) {
            const jumpToken = pendingJumpCellRef.current;
            pendingJumpCellRef.current = null;
            console.log('[CellView] TILESET_READY → executing JUMP_TO_CELL:', jumpToken);
            setTimeout(() => {
              console.log('[CellView] Sending JUMP_TO_CELL to WebView');
              webviewRef.current?.postMessage(JSON.stringify({
                type: 'JUMP_TO_CELL',
                token: jumpToken,
              }));
            }, 1000); // L0 그리드 렌더 완료를 위한 딜레이
          }
          break;
        case 'INIT_COMPLETE':
          console.log('[Index] WebView JS init complete');
          setWebviewReady(true);
          break;
        case 'MODE_TRANSITION_COMPLETE':
          console.log('[Index] Mode transition complete');
          setModeTransitioning(false);
          break;
        case 'DEMO_TOKEN':
          if (message.payload?.token) {
            addDemoTerritory(
              message.payload.token,
              message.payload.lat ?? 30.0,
              message.payload.lng ?? 15.0
            );
            console.log('[Index] Demo territory added (local only):', message.payload.token);
          }
          break;
        case 'QUERY_CELL_OWNER':
          {
            const qToken = message.payload.token;
            const qLat = message.payload.lat;
            const qLng = message.payload.lng;
            const qIsMyTerritory = message.payload.isMyTerritory;
            (async () => {
              try {
                const owner = await getCellOwnerFromDB(qToken);
                webviewRef.current?.postMessage(JSON.stringify({
                  type: 'CELL_OWNER_INFO',
                  payload: {
                    token: qToken,
                    lat: qLat,
                    lng: qLng,
                    isMyTerritory: qIsMyTerritory,
                    nickname: owner?.nickname || '알 수 없음',
                    avatarColor: owner?.avatarColor || '#666',
                    userId: owner?.userId || null
                  }
                }));
              } catch (e) {
                console.log('[Index] QUERY_CELL_OWNER failed:', e);
              }
            })();
          }
          break;
        case 'DEBUG_MSG':
          console.log('[DEBUG]', message.payload?.msg || 'no msg');
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
      setSelectedCell(null);
      setCellExpanded(false);
      webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_BACK' }));
    }
  };

  const handleReset = () => {
    webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
    // 개척모드 셀 선택 즉시 해제
    setSelectedCell(null);
    setCellExpanded(false);
    // 위성 선택 해제 (토글 상태는 유지)
    setSelectedSatellite(null);
    // 착륙지/지형 선택 해제
    setSelectedLandingSite(null);
    setSelectedFeature(null);
    // 하이라이트 정리
    if (featureHighlight) {
      setFeatureHighlight(null);
      webviewRef.current?.postMessage(JSON.stringify({ type: 'CLEAR_FEATURE_HIGHLIGHT' }));
    }
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

  // WebView JS 초기화 완료(INIT_COMPLETE) 후 pending 모드 전환 처리
  useEffect(() => {
    if (webviewReady && pendingModeRef.current) {
      const pending = pendingModeRef.current;
      pendingModeRef.current = null;
      console.log('[Index] WebView JS ready, executing pending mode:', pending);
      if (pending === 'test2') {
        webviewRef.current?.postMessage(JSON.stringify({
          type: 'UPDATE_MODE',
          payload: { mainMode: 'test2', subMode }
        }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'REMOVE_ALL_3D_MODELS' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST1_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'ENTER_TEST2_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST3_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_GRID_VISIBILITY', visible: true }));
      }
    }
  }, [webviewReady]);

  // tilesetLoading 안전장치: 15초 타임아웃
  useEffect(() => {
    if (!tilesetLoading) return;
    const timer = setTimeout(() => {
      console.log('[Index] tilesetLoading timeout (15s), forcing ready');
      setTilesetLoading(false);
    }, 15000);
    return () => clearTimeout(timer);
  }, [tilesetLoading]);

  // modeTransitioning 안전장치: 5초 타임아웃
  useEffect(() => {
    if (!modeTransitioning) return;
    const timer = setTimeout(() => {
      console.log('[Index] modeTransitioning timeout (5s), forcing complete');
      setModeTransitioning(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [modeTransitioning]);

  // 탐사 모드로 전환 시 열려있는 모든 오버레이/옵션 초기화
  useEffect(() => {
    if (mainMode === 'exploration') {
      setShowOptions(false);
      setShowFilterModal(false);
      setCanGoBack(false);
      setSelectionDepth(0);

      // 셀 선택 / 하이라이트 완전 초기화
      setSelectedCell(null);
      if (featureHighlight) {
        setFeatureHighlight(null);
        webviewRef.current?.postMessage(JSON.stringify({ type: 'CLEAR_FEATURE_HIGHLIGHT' }));
      }

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
      // 모든 그리드/primitive 완전 리셋 (구 점유모드 포함)
      webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET' }));
      // PL/TR 모드 해제
      webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST1_MODE' }));
      webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST2_MODE' }));
      webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST3_MODE' }));
    } else {
      // 점유 모드(occupation/test1/test2)로 전환 시
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

      // PL/TR/T3 모드 전환
      if (mainMode === 'test1') {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'ENTER_TEST1_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST2_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST3_MODE' }));
      } else if (mainMode === 'test2') {
        if (!webviewReady) {
          // WebView JS 미초기화 → pending으로 저장
          pendingModeRef.current = 'test2';
          setTilesetLoading(true);
        } else {
          pendingModeRef.current = null;
          webviewRef.current?.postMessage(JSON.stringify({ type: 'REMOVE_ALL_3D_MODELS' }));
          webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST1_MODE' }));
          webviewRef.current?.postMessage(JSON.stringify({ type: 'ENTER_TEST2_MODE' }));
          webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST3_MODE' }));
          setTilesetLoading(true);
        }
      } else if (mainMode === 'test3') {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST1_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST2_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'ENTER_TEST3_MODE' }));
      } else {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST1_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST2_MODE' }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'EXIT_TEST3_MODE' }));
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
    const envKeys = ['thermalGrid', 'gravity', 'neutron'];

    // 이전 자원 해제 (광물이면 광물 필터 끄기, 환경이면 토글 끄기)
    if (activeMineralFilter && activeMineralFilter !== key) {
      if (mineralKeys.includes(activeMineralFilter)) {
        webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MINERAL_FILTER', filter: activeMineralFilter, enabled: false }));
      } else if (activeMineralFilter === 'thermalGrid') {
        setShowThermalGrid(false); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_THERMAL_GRID', enabled: false }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_ENV_MINERAL_FILTER', filter: null }));
      } else if (activeMineralFilter === 'gravity') {
        setShowGravityMap(false); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_GRAVITY_MAP', enabled: false }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_ENV_MINERAL_FILTER', filter: null }));
      } else if (activeMineralFilter === 'neutron') {
        setShowNeutronMap(false); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_NEUTRON_MAP', enabled: false }));
        webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_ENV_MINERAL_FILTER', filter: null }));
      }
    }
    setMineralCellInfo(null);

    if (mineralKeys.includes(key)) {
      webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MINERAL_FILTER', filter: key, enabled: true }));
      setActiveMineralFilter(key);
    } else if (key === 'thermalGrid') {
      setActiveMineralFilter('thermalGrid');
      if (!showThermalGrid) { setShowThermalGrid(true); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_THERMAL_GRID', enabled: true })); }
      webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_ENV_MINERAL_FILTER', filter: 'thermalGrid' }));
    } else if (key === 'gravity') {
      setActiveMineralFilter('gravity');
      if (!showGravityMap) { setShowGravityMap(true); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_GRAVITY_MAP', enabled: true })); }
      webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_ENV_MINERAL_FILTER', filter: 'gravity' }));
    } else if (key === 'neutron') {
      setActiveMineralFilter('neutron');
      if (!showNeutronMap) { setShowNeutronMap(true); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_NEUTRON_MAP', enabled: true })); }
      webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_ENV_MINERAL_FILTER', filter: 'neutron' }));
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
      webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_ENV_MINERAL_FILTER', filter: null }));
      setActiveMineralFilter(null);
      setMineralCellInfo(null);
    } else if (key === 'gravity') {
      setShowGravityMap(false); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_GRAVITY_MAP', enabled: false }));
      webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_ENV_MINERAL_FILTER', filter: null }));
      setActiveMineralFilter(null);
      setMineralCellInfo(null);
    } else if (key === 'neutron') {
      setShowNeutronMap(false); webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_NEUTRON_MAP', enabled: false }));
      webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_ENV_MINERAL_FILTER', filter: null }));
      setActiveMineralFilter(null);
      setMineralCellInfo(null);
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
      const skipCamera = skipCameraResetRef.current;
      skipCameraResetRef.current = false; // 한 번 사용하면 바로 초기화
      webviewRef.current?.postMessage(JSON.stringify({
        type: 'UPDATE_MODE',
        payload: {
          mainMode,
          subMode,
          skipCameraReset: skipCamera
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
            fetchSpacecraftTrajectory(mission.id, trajHours, stepMin, mission.launchDate)
          ]);

          results.push({
            ...mission,
            position: position || undefined,
            trajectory: trajectory || undefined,
          });
          // 디버그: 궤적 데이터 확인
          console.log(`[SAT] ${mission.name}: pos=${position ? 'OK' : 'NONE'}, traj=${trajectory ? trajectory.length + ' points' : 'NONE'}`);
          if (trajectory && trajectory.length > 0) {
            console.log(`[SAT] ${mission.name} traj[0]:`, JSON.stringify(trajectory[0]).substring(0, 120));
          }
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

  const handleAISelectZone = (lat: number, lng: number, name: string, diameterKm?: number) => {
    const radiusKm = (diameterKm || 50) / 2;
    setSelectedCell(null);
    setFeatureHighlight({ name: 'AI 추천 · ' + name, lat, lng, radiusKm });
    webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_GRID_ONLY' }));
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'ROTATE_TO_LOCATION',
      payload: { lat, lng }
    }));
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'SET_FEATURE_HIGHLIGHT',
      payload: { name, lat, lng, radiusKm }
    }));
  };


  return (
    <View style={styles.container}>
      {/* StatusBar는 _layout.tsx에서 탭별로 관리 */}


      {/* 상단 헤더 영역 (모드 토글 및 점유모드 기능) */}
      <SafeAreaView style={styles.headerLayer} edges={['top', 'left', 'right']} pointerEvents="box-none">

        {/* 모드 선택 토글 */}
        <View style={styles.modeToggleContainer}>
          <View style={styles.modeToggleInner}>
            <TouchableOpacity
              style={[styles.modeTab, mainMode === 'exploration' && styles.modeTabActive]}
              disabled={mainMode === 'exploration' || tilesetLoading || modeTransitioning}
              onPress={() => {
                if (mainMode === 'exploration' || tilesetLoading || modeTransitioning) return;
                setModeTransitioning(true);
                setMainMode('exploration');
                if (featureHighlight) {
                  setFeatureHighlight(null);
                  webviewRef.current?.postMessage(JSON.stringify({ type: 'CLEAR_FEATURE_HIGHLIGHT' }));
                }
              }}
            >
              <Text style={[styles.modeTabText, mainMode === 'exploration' && styles.modeTabTextActive, (mainMode !== 'exploration' && (tilesetLoading || modeTransitioning)) && { opacity: 0.4 }]}>탐사 모드</Text>
            </TouchableOpacity>
            {/* 구버전 개척모드(classification) — 숨김 처리
            <TouchableOpacity
              style={[styles.modeTab, mainMode === 'occupation' && styles.modeTabActive]}
              onPress={() => setMainMode('occupation')}
            >
              <Text style={[styles.modeTabText, mainMode === 'occupation' && styles.modeTabTextActive]}>개척 모드(구)</Text>
            </TouchableOpacity>
            */}
            {/* 테스트 1 — 추후 개발 후 복원 예정
            <TouchableOpacity
              style={[styles.modeTab, mainMode === 'test1' && styles.modeTabActive]}
              onPress={() => setMainMode('test1')}
            >
              <Text style={[styles.modeTabText, mainMode === 'test1' && styles.modeTabTextActive]}>테스트 1</Text>
            </TouchableOpacity>
            */}
            <TouchableOpacity
              style={[styles.modeTab, mainMode === 'test2' && styles.modeTabActive]}
              disabled={mainMode === 'test2' || tilesetLoading || modeTransitioning}
              onPress={() => {
                if (mainMode === 'test2' || tilesetLoading || modeTransitioning) return;
                setModeTransitioning(true);
                setMainMode('test2');
              }}
            >
              <Text style={[styles.modeTabText, mainMode === 'test2' && styles.modeTabTextActive, (mainMode !== 'test2' && (tilesetLoading || modeTransitioning)) && { opacity: 0.4 }]}>개척 모드</Text>
            </TouchableOpacity>


          </View>
        </View>



      </SafeAreaView>

      {/* 캔버스 영역 (Flex) */}
      <View style={styles.canvasSection}>
        {/* Cesium WebView */}
        <WebView
          key={webviewKey}
          ref={webviewRef}
          originWhitelist={['*']}
          source={cesiumHtmlUri ? { uri: cesiumHtmlUri } : { html: '<html><body style="background:#000"></body></html>' }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          onLoadEnd={() => {
            setLoading(false);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          allowingReadAccessToURL={'file:///'}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
          onContentProcessDidTerminate={() => {
            console.warn('[WebView] Content process terminated — reloading');
            reloadWebView();
          }}
          onRenderProcessGone={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('[WebView] Render process gone:', nativeEvent);
            reloadWebView();
          }}
        />

        {/* 개척모드 달 타일셋 로딩 오버레이 */}
        {tilesetLoading && mainMode === 'test2' && (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center', alignItems: 'center', zIndex: 50,
          }}>
            <ActivityIndicator size="large" color="#6ff59a" />
            <Text style={{
              color: '#fff', fontSize: 14, marginTop: 16,
              fontFamily: 'System', letterSpacing: 1,
            }}>달 지형 데이터 로딩 중...</Text>
            <Text style={{
              color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6,
            }}>잠시만 기다려주세요</Text>
          </View>
        )}

        {/* 지형 하이라이트 플로팅 버튼 (점유모드) */}
        {isOccupation && featureHighlight && (
          <View style={{
            position: 'absolute', top: 20, left: 16, zIndex: 30,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#2A2D3E',
            borderRadius: 8, paddingLeft: 14, overflow: 'hidden',
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6', marginRight: 8 }} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
              {featureHighlight.name}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setFeatureHighlight(null);
                webviewRef.current?.postMessage(JSON.stringify({ type: 'CLEAR_FEATURE_HIGHLIGHT' }));
              }}
              style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        )}

        {/* 좌측 상단: 자원 스캐너 (토글 버튼+패널 통합) — ResourceScannerPanel 내부에서 렌더링 */}

        {/* 우측 상단 컨트롤 버튼 (+, 초기화, -) — 점유 현황 뷰/스캐너 활성 시 숨김 */}
        {!showResourceScanner && !(selectedLandingSite && landingSiteDetailMode === 'occupation') && !(selectedFeature && featureDetailMode === 'occupation') && (
          <SafeAreaView style={styles.rightControls} edges={['right']} pointerEvents="box-none">
            {/* 레이어 버튼 (별도) */}
            {mainMode === 'exploration' && (
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  style={[styles.layerBtn, (showFeaturePanel || showFeaturePanelB || showFeaturePanelC || selectedSatellite || selectedLandingSite || selectedFeature) && { backgroundColor: 'rgba(60,87,233,0.8)' }]}
                  onPress={() => {
                    const anyOpen = showFeaturePanel || showFeaturePanelB || showFeaturePanelC || selectedSatellite || selectedLandingSite || selectedFeature;
                    if (anyOpen) {
                      // 모든 탐사 관련 창 닫기
                      setShowFeaturePanel(false);
                      setShowFeaturePanelB(false);
                      setShowFeaturePanelC(false);
                      if (selectedSatellite) { setSelectedSatellite(null); webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' })); }
                      if (selectedLandingSite) { setSelectedLandingSite(null); setLandingSiteDetailMode('detail'); webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' })); }
                      if (selectedFeature) { setSelectedFeature(null); setFeatureDetailMode('detail'); webviewRef.current?.postMessage(JSON.stringify({ type: 'HIDE_FEATURE_AREA' })); webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' })); }
                    } else {
                      setShowFeaturePanel(true);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Svg width={20} height={20} viewBox="0 0 22 22" fill="none">
                    <Path d="M18.4028 14.4245L20.5335 15.4894L11.0001 20.256L1.4668 15.4894L3.5975 14.4245L11.0001 18.1264L18.4028 14.4245ZM11.0001 10.7227L12.0097 11.228L11.0001 11.7331L9.99053 11.228L11.0001 10.7227Z" fill="#666666" />
                    <Path d="M18.4037 10.1626L20.5335 11.2283L11.0001 15.9949L1.4668 11.2283L3.59656 10.1626L11.0001 13.8653L18.4037 10.1626Z" fill="#999999" />
                    <Path d="M11.0001 2.20001L20.5335 6.96669L11.0001 11.7333L1.4668 6.96669L11.0001 2.20001Z" fill="white" />
                  </Svg>
                </TouchableOpacity>
              </View>
            )}

            {/* +/리셋/- 그룹 패널 */}
            <View style={styles.controlGroup}>
              {/* 확대 버튼 (+) */}
              <TouchableOpacity
                style={[styles.controlBtn, isOccupation && selectionDepth >= 3 && { opacity: 0.3 }]}
                onPress={handleZoomIn}
                activeOpacity={0.7}
                disabled={isOccupation && selectionDepth >= 3}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>

              <View style={styles.controlSep} />

              {/* 초기화 버튼 */}
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={handleReset}
                activeOpacity={0.7}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M8.687 5.396C8.687 5.396 10.321 5.339 11.919 5.339C13.517 5.339 15.08 5.813 16.409 6.701C17.738 7.588 18.773 8.85 19.385 10.327C19.997 11.804 20.157 13.428 19.845 14.996C19.533 16.563 18.763 18.003 17.633 19.133C16.503 20.263 15.063 21.033 13.496 21.345C11.928 21.657 10.303 21.497 8.827 20.885C7.35 20.273 6.088 19.238 5.2 17.909C4.312 16.58 3.838 15.018 3.838 13.419" stroke="#FFFFFF" strokeWidth={1.5} strokeMiterlimit={10} />
                  <Path d="M11.919 1.5L7.879 5.54L11.919 9.581" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="square" />
                </Svg>
              </TouchableOpacity>

              <View style={styles.controlSep} />

              {/* 축소 버튼 (-) */}
              <TouchableOpacity
                style={[styles.controlBtn, isOccupation && selectionDepth <= 0 && { opacity: 0.3 }]}
                onPress={handleZoomOut}
                activeOpacity={0.7}
                disabled={isOccupation && selectionDepth <= 0}
              >
                <Ionicons name="remove" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* AD 광고 토글 버튼 */}
            <TouchableOpacity
              style={[
                styles.controlGroup,
                { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
                showAd && { backgroundColor: 'rgba(60,87,233,0.8)' },
              ]}
              onPress={async () => {
                const next = !showAd;
                setShowAd(next);
                if (next) {
                  try {
                    const [asset] = await Asset.loadAsync(require('../../assets/images/ad_test.png'));
                    if (asset.localUri) {
                      const b64 = await FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 });
                      webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_AD', payload: { show: true, imageBase64: b64 } }));
                    }
                  } catch (e) { console.warn('AD load error:', e); }
                } else {
                  webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_AD', payload: { show: false } }));
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="megaphone" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>AD</Text>
            </TouchableOpacity>


          </SafeAreaView>
        )}

        {/* AI 구역 추천 버튼 (우하단) - 점유 모드 전용 */}
        {isOccupation && (
          <View style={styles.aiRecommendContainer}>
            <TouchableOpacity
              style={styles.aiPicksBtn}
              onPress={() => { setShowAIModal(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.aiPicksBtnText}>AI 추천</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 1인칭 조이스틱 UI — 버튼 제거됨. handleMove 로직은 지형 줌인/땅보기 등에서 재사용 가능 */}

        {/* 옵션 메뉴 오버레이 (Control Bar 옆에 표시) */}
        {showOptions && (
          <SafeAreaView style={[styles.rightControls, { right: 70, backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 2, padding: 10, alignItems: 'flex-start', width: 220, zIndex: 100 }]} edges={['right']} pointerEvents="auto">

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
        {mainMode === 'exploration' && !(selectedLandingSite && landingSiteDetailMode === 'occupation') && !(selectedFeature && featureDetailMode === 'occupation') && (
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
                  // 데이터 로드 후 stats 확실히 수신되도록 재전송
                  setTimeout(() => {
                    webviewRef.current?.postMessage(JSON.stringify({
                      type: 'UPDATE_MINERAL_FILTER', filter: 'feo', enabled: true
                    }));
                  }, 500);
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

        {/* 지질맵 토글 버튼 (좌측 하단, 스캐너 독립) */}
        {mainMode === 'exploration' && !showResourceScanner && !(selectedLandingSite && landingSiteDetailMode === 'occupation') && !(selectedFeature && featureDetailMode === 'occupation') && (
          <View style={{ position: 'absolute', left: 12, bottom: 100, gap: 8, zIndex: 9 }} pointerEvents="box-none">
            <TouchableOpacity
              style={{
                width: 44, height: 44, borderRadius: 10,
                backgroundColor: showGeologyLinear ? 'rgba(78,205,196,0.9)' : 'rgba(50,57,80,0.8)',
                borderWidth: 1, borderColor: showGeologyLinear ? 'rgba(78,205,196,0.5)' : 'rgba(255,255,255,0.07)',
                justifyContent: 'center', alignItems: 'center',
              }}
              onPress={() => toggleGeologyLinear(!showGeologyLinear)}
              activeOpacity={0.7}
            >
              <Ionicons name="git-branch-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                width: 44, height: 44, borderRadius: 10,
                backgroundColor: showGeologyUnit ? 'rgba(162,155,254,0.9)' : 'rgba(50,57,80,0.8)',
                borderWidth: 1, borderColor: showGeologyUnit ? 'rgba(162,155,254,0.5)' : 'rgba(255,255,255,0.07)',
                justifyContent: 'center', alignItems: 'center',
              }}
              onPress={() => toggleGeologyUnit(!showGeologyUnit)}
              activeOpacity={0.7}
            >
              <Ionicons name="map-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
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

        {/* 하단 셀 정보 카드 (기획서 기반) */}
        {isOccupation && selectedCell && (() => {
          const cellCount = selectedCell.isMultiSelect ? (selectedCell.cellCount || 1) : 1;
          const totalMag = selectedCell.magCount || 1;
          const pricePerMag = 25;
          const totalPrice = totalMag * pricePerMag;

          return (
            <>
              {/* ═══ 셀 정보 패널 ═══ */}
              <Animated.View style={[styles.bottomCardContainer, { transform: [{ translateY: sheetBTranslateY }] }]}>
                <View style={[styles.bottomCard2, { height: SHEET_B_MAX }]}>
                  {/* 드래그 핸들 */}
                  <View {...sheetBPanResponder.panHandlers} style={styles.dragHandleArea}>
                    <View style={styles.dragHandle} />
                  </View>

                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} scrollEnabled={true}>
                    {/* 헤더: 좌측 정보 + 우측 개척하기 버튼 */}
                    <View style={{ flexDirection: 'row', paddingTop: 4, paddingBottom: 20, gap: 14 }}>
                      {/* 좌측: MAG ID + 면적 + URN */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.cellMagId} numberOfLines={1}>
                            {'MAG-L' + (selectedCell.level || 16) + '-' + (selectedCell.token || selectedCell.cellId)}
                          </Text>
                          {selectedCell.isMultiSelect && cellCount > 1 ? <View style={{ borderWidth: 1, borderColor: '#666666', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10, marginLeft: 10 }}><Text style={{ color: '#fff', fontSize: 14 }}>{'+' + (cellCount - 1)}</Text></View> : null}
                        </View>
                        <Text style={{ fontSize: 14, color: '#666666', marginTop: 8 }}>
                          {(selectedCell.area || '1,740 m²') + '  ·  ' + Math.abs(selectedCell.lat || 0).toFixed(2) + '°' + ((selectedCell.lat || 0) >= 0 ? 'N' : 'S') + ' ' + Math.abs(selectedCell.lng || 0).toFixed(2) + '°' + ((selectedCell.lng || 0) >= 0 ? 'E' : 'W')}
                        </Text>
                        <Text style={{ fontSize: 14, color: '#666666', fontFamily: 'monospace', marginTop: 8 }}>{'urn: 301:' + (selectedCell.level || 16) + ':' + (selectedCell.token || selectedCell.cellId)}</Text>
                      </View>
                      {/* 우측: 개척하기 버튼 또는 상태 */}
                      {!selectedCell?.isOccupied ? (
                        <TouchableOpacity
                          style={{ backgroundColor: '#2175FA', borderRadius: 10, paddingHorizontal: 22, justifyContent: 'center', alignItems: 'center', height: 56, minWidth: 90 }}
                          activeOpacity={0.8}
                          onPress={() => {
                            if (!isLoggedIn) { router.push('/auth/login'); return; }
                            setShowOccupyConfirm(true);
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>개척하기</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 3 }}>{totalPrice + ' ELL'}</Text>
                        </TouchableOpacity>
                      ) : selectedCell?.isMyTerritory ? (
                        <View style={{ backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', height: 56, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' }}>
                          <Text style={{ color: '#4ADE80', fontSize: 13, fontWeight: '700' }}>✓ 소유 중</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', height: 56, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                          <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: '600' }}>점유됨</Text>
                        </View>
                      )}
                    </View>

                    {/* 구역 상세 (접기/펼치기) — 원형 화살표 버튼 */}
                    <TouchableOpacity
                      style={{ alignItems: 'center', paddingVertical: 10, marginTop: 4 }}
                      onPress={() => setShowCellDetail(!showCellDetail)}
                      activeOpacity={0.7}
                    >
                      <View style={{
                        width: 23, height: 23, borderRadius: 12,
                        backgroundColor: '#666666',
                        justifyContent: 'center', alignItems: 'center',
                      }}>
                        <Ionicons name={showCellDetail ? 'chevron-up' : 'chevron-down'} size={14} color="#fff" />
                      </View>
                    </TouchableOpacity>

                    {showCellDetail && (
                      <View style={{ marginBottom: 16, backgroundColor: '#2C3245', borderRadius: 10, overflow: 'hidden', paddingVertical: 16, paddingHorizontal: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', color: '#7295FE', marginBottom: 16 }}>구역 상세</Text>
                        {selectedCell.isMultiSelect && selectedCell.multiTokens ? (
                          selectedCell.multiTokens.map((token: string, idx: number) => (
                            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}>
                              <Text style={{ fontSize: 14, color: '#EBECF1', fontFamily: 'monospace' }}>{token}</Text>
                              <Text style={{ fontSize: 13, color: '#808080' }}>
                                {'LAT: ' + (selectedCell.multiLats?.[idx]?.toFixed(3) || '-') + ' | LON: ' + (selectedCell.multiLngs?.[idx]?.toFixed(3) || '-')}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <View>
                            {[
                              { label: selectedCell.token || selectedCell.cellId, value: 'LAT: ' + (selectedCell.lat || 0).toFixed(3) + ' | LON: ' + (selectedCell.lng || 0).toFixed(3) },
                            ].map((row, i) => (
                              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}>
                                <Text style={{ fontSize: 14, color: '#EBECF1', fontFamily: 'monospace' }}>{row.label}</Text>
                                <Text style={{ fontSize: 13, color: '#808080' }}>{row.value}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}


                    {/* 인근 착륙 지점 */}
                    <View>
                      <Text style={{ color: '#3C57E9', fontSize: 14, fontWeight: '500', marginBottom: 12 }}>인근 착륙 지점</Text>
                      {(() => {
                        const cellLat = selectedCell.lat || 0;
                        const cellLng = selectedCell.lng || 0;
                        const nearest = LANDING_SITES
                          .map(s => ({ site: s, dist: Math.sqrt(Math.pow(s.lat - cellLat, 2) + Math.pow(s.lng - cellLng, 2)) }))
                          .sort((a, b) => a.dist - b.dist)
                          .slice(0, 2);
                        return nearest.map((item, idx) => {
                          const distKm = Math.round(item.dist * 30);
                          return (
                            <TouchableOpacity key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderBottomWidth: idx < 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.07)' }} activeOpacity={0.7} onPress={() => {
                              setSelectedCell(null);
                              setFeatureHighlight({ name: item.site.nameKr, lat: item.site.lat, lng: item.site.lng, radiusKm: 5 });
                              webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_GRID_ONLY' }));
                              webviewRef.current?.postMessage(JSON.stringify({ type: 'ROTATE_TO_LOCATION', payload: { lat: item.site.lat, lng: item.site.lng } }));
                              webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_FEATURE_HIGHLIGHT', payload: { name: item.site.nameKr, lat: item.site.lat, lng: item.site.lng, radiusKm: 5 } }));
                            }}>
                              <View style={{ width: 68, height: 68, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', justifyContent: 'center', alignItems: 'center' }}>
                                {LANDING_SITE_IMAGES[item.site.officialName] ? (
                                  <Image source={LANDING_SITE_IMAGES[item.site.officialName]} style={{ width: 68, height: 68 }} resizeMode="cover" />
                                ) : (
                                  <Ionicons name="location" size={22} color={getContactColor(item.site.contactType)} />
                                )}
                              </View>
                              <View style={{ flex: 1, justifyContent: 'center' }}>
                                <Text style={{ color: '#EBECF1', fontSize: 16, fontWeight: '500' }} numberOfLines={1}>{item.site.nameKr}</Text>
                                <Text style={{ color: '#666666', fontSize: 12, marginTop: 2 }}>{item.site.year} · {item.site.agency} · {item.site.missionType}</Text>
                                <Text style={{ color: '#666666', fontSize: 12, marginTop: 3 }}>인근 {distKm}km</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        });
                      })()}



                      {/* 인근 주요 지형 */}
                      <Text style={{ color: '#3C57E9', fontSize: 14, fontWeight: '500', marginTop: 28, marginBottom: 12 }}>인근 주요 지형</Text>
                      {(() => {
                        const cellLat = selectedCell.lat || 0;
                        const cellLng = selectedCell.lng || 0;
                        const nearest = LUNAR_FEATURES
                          .map(f => ({ feat: f, dist: Math.sqrt(Math.pow(f.lat - cellLat, 2) + Math.pow(f.lng - cellLng, 2)) }))
                          .sort((a, b) => a.dist - b.dist)
                          .slice(0, 2);
                        return nearest.map((item, idx) => {
                          const distKm = Math.round(item.dist * 30);
                          return (
                            <TouchableOpacity key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderBottomWidth: idx < 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.07)' }} activeOpacity={0.7} onPress={() => {
                              const radiusKm = (item.feat.diameterKm || 10) / 2;
                              setSelectedCell(null);
                              setFeatureHighlight({ name: item.feat.nameKr, lat: item.feat.lat, lng: item.feat.lng, radiusKm });
                              webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_GRID_ONLY' }));
                              webviewRef.current?.postMessage(JSON.stringify({ type: 'ROTATE_TO_LOCATION', payload: { lat: item.feat.lat, lng: item.feat.lng } }));
                              webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_FEATURE_HIGHLIGHT', payload: { name: item.feat.nameKr, lat: item.feat.lat, lng: item.feat.lng, radiusKm } }));
                            }}>
                              <View style={{ width: 68, height: 68, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', justifyContent: 'center', alignItems: 'center' }}>
                                {LUNAR_FEATURE_IMAGES[item.feat.id] ? (
                                  <Image source={LUNAR_FEATURE_IMAGES[item.feat.id]} style={{ width: 68, height: 68 }} resizeMode="cover" />
                                ) : (
                                  <Text style={{ fontSize: 22 }}>{getFeatureTypeEmoji(item.feat.typeKr)}</Text>
                                )}
                              </View>
                              <View style={{ flex: 1, justifyContent: 'center' }}>
                                <Text style={{ color: '#EBECF1', fontSize: 16, fontWeight: '500' }} numberOfLines={1}>{item.feat.nameKr}</Text>
                                <Text style={{ color: '#666666', fontSize: 12, marginTop: 2 }}>{item.feat.typeKr} · 지름 {item.feat.diameterKm}km</Text>
                                <Text style={{ color: '#666666', fontSize: 12, marginTop: 3 }}>인근 {distKm}km</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        });
                      })()}

                      <View style={{ height: 40 }} />
                    </View>
                  </ScrollView>
                </View>
              </Animated.View>
            </>
          );
        })()}
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
          // 토글이 꺼져있으면 자동으로 켜기
          if (!showSatellites) {
            setShowSatellites(true);
            webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MODE', payload: { mainMode: 'exploration', subMode: 'satellite' } }));
            if (satelliteData.length > 0) {
              webviewRef.current?.postMessage(JSON.stringify({ type: 'LOAD_SATELLITE_DATA', data: satelliteData }));
            }
          }
          satPanelAnim.setValue(SAT_PANEL_COLLAPSED);
          satPanelOffsetRef.current = SAT_PANEL_COLLAPSED;
          satIsLookAt.current = false;
          setSatIsLookAtState(false);
          setSelectedSatellite(sat);
          webviewRef.current?.postMessage(JSON.stringify({
            type: 'FOCUS_SATELLITE',
            payload: { name: sat.name, id: sat.id }
          }));
        }}
        onSelectLandingSite={(site) => {
          setShowFeaturePanel(false);
          // 토글이 꺼져있으면 자동으로 켜기
          if (!showLandingSites) {
            setShowLandingSites(true);
            webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_LANDING_SITES', enabled: true }));
          }
          landingPanelAnim.setValue(SNAP_MIN);
          landingPanelOffsetRef.current = SNAP_MIN;
          landingIsFirstPerson.current = false;
          goToLandingSite(site);
        }}
        onSelectFeature={(feat) => {
          setShowFeaturePanel(false);
          // 토글이 꺼져있으면 자동으로 켜기
          if (!showTerrain) {
            setShowTerrain(true);
            webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_TERRAIN', enabled: true }));
          }
          featurePanelAnim.setValue(SNAP_MIN);
          featurePanelOffsetRef.current = SNAP_MIN;
          featureIsFirstPerson.current = false;
          setSelectedFeature(feat);
          setFeatureDetailMode('detail');
          webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: feat.lat, lng: feat.lng } }));
          webviewRef.current?.postMessage(JSON.stringify({ type: 'SHOW_FEATURE_AREA', payload: { lat: feat.lat, lng: feat.lng, diameterKm: feat.diameterKm, widthKm: feat.widthKm, angle: feat.angle, typeKr: feat.typeKr } }));
        }}
      />

      {/* ═══ Type B: 3행 토글+리스트 패널 (독립) ═══ */}
      <ExplorationListPanelB
        visible={showFeaturePanelB}
        onClose={() => { setShowFeaturePanelB(false); }}
        showSatellites={showSatellites}
        showLandingSites={showLandingSites}
        showTerrain={showTerrain}
        onToggleSatellites={(val) => {
          setShowSatellites(val);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MODE', payload: { mainMode: 'exploration', subMode: val ? 'satellite' : subMode } }));
          if (val && satelliteData.length > 0) {
            webviewRef.current?.postMessage(JSON.stringify({ type: 'LOAD_SATELLITE_DATA', data: satelliteData }));
          }
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
          setShowFeaturePanelB(false);
          satPanelAnim.setValue(SAT_PANEL_COLLAPSED);
          satPanelOffsetRef.current = SAT_PANEL_COLLAPSED;
          satIsLookAt.current = false;
          setSatIsLookAtState(false);
          setSelectedSatellite(sat);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'FOCUS_SATELLITE', payload: { name: sat.name, id: sat.id } }));
        }}
        onSelectLandingSite={(site) => {
          setShowFeaturePanelB(false);
          landingPanelAnim.setValue(SNAP_MIN);
          landingPanelOffsetRef.current = SNAP_MIN;
          goToLandingSite(site);
        }}
        onSelectFeature={(feat) => {
          setShowFeaturePanelB(false);
          featurePanelAnim.setValue(SNAP_MIN);
          featurePanelOffsetRef.current = SNAP_MIN;
          goToFeature(feat);
        }}
      />

      {/* ═══ Type C: 카테고리 선택 → 합산 리스트 (독립) ═══ */}
      <ExplorationListPanelC
        visible={showFeaturePanelC}
        onClose={() => { setShowFeaturePanelC(false); }}
        showSatellites={showSatellites}
        showLandingSites={showLandingSites}
        showTerrain={showTerrain}
        onToggleSatellites={(val, agencies) => {
          setShowSatellites(val);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MODE', payload: { mainMode: 'exploration', subMode: val ? 'satellite' : subMode } }));
          if (val && satelliteData.length > 0) {
            // 기관 필터가 있으면 해당 기관의 위성만 전달
            const filteredData = agencies && agencies.length > 0
              ? satelliteData.filter(s => agencies.includes(s.agencyCode))
              : satelliteData;
            webviewRef.current?.postMessage(JSON.stringify({ type: 'LOAD_SATELLITE_DATA', data: filteredData }));
          }
        }}
        onToggleLandingSites={(val, countries) => {
          setShowLandingSites(val);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_LANDING_SITES', enabled: val, countries: countries || null }));
        }}
        onToggleTerrain={(val, types) => {
          setShowTerrain(val);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_TERRAIN', enabled: val, types: types || null }));
        }}
        satelliteData={satelliteData}
        isLoadingSatellite={isLoadingSatellite}
        onSelectSatellite={(sat) => {
          setShowFeaturePanelC(false);
          satPanelAnim.setValue(SAT_PANEL_COLLAPSED);
          satPanelOffsetRef.current = SAT_PANEL_COLLAPSED;
          satIsLookAt.current = false;
          setSatIsLookAtState(false);
          setSelectedSatellite(sat);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'FOCUS_SATELLITE', payload: { name: sat.name, id: sat.id } }));
        }}
        onSelectLandingSite={(site) => {
          setShowFeaturePanelC(false);
          landingPanelAnim.setValue(SNAP_MIN);
          landingPanelOffsetRef.current = SNAP_MIN;
          goToLandingSite(site);
        }}
        onSelectFeature={(feat) => {
          setShowFeaturePanelC(false);
          featurePanelAnim.setValue(SNAP_MIN);
          featurePanelOffsetRef.current = SNAP_MIN;
          goToFeature(feat);
        }}
      />

      {/* 위성 Live 라벨 — lookAt(뷰 전환) 모드에서만 표시 */}
      {selectedSatellite && mainMode === 'exploration' && selectedSatellite.missionStatus === 'Active' && satIsLookAtState && (
        <View style={{ position: 'absolute', top: 140, left: 0, right: 0, alignItems: 'center', zIndex: 1001 }} pointerEvents="none">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#4ADE80' }} />
            <Text style={{ color: '#4ADE80', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 }}>Live</Text>
          </View>
        </View>
      )}

      {/* 위성 상세 정보 패널 */}
      {selectedSatellite && mainMode === 'exploration' && (
        <Animated.View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: satPanelAnim,
          backgroundColor: '#15171C',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          overflow: 'hidden',
          zIndex: 999,
          elevation: 999,
        }}>

          {/* 드래그 가능 영역: 핸들 + 제목행 */}
          <View {...satPanelPanResponder.panHandlers}>
            {/* 드래그 핸들 */}
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
              <View style={{ width: 49, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
            </View>
            {/* 헤더: ← + 제목 + 뷰전환 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedSatellite(null);
                  setSatIsLookAtState(false);
                  satIsLookAt.current = false;
                  webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
                  setShowFeaturePanel(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ paddingRight: 8, paddingVertical: 4 }}
              >
                <Ionicons name="chevron-back" size={24} color="#666666" />
              </TouchableOpacity>
              <Text style={{ color: '#EBECF1', fontSize: 20, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                {selectedSatellite.nameKo !== selectedSatellite.name ? selectedSatellite.nameKo : selectedSatellite.name}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (satIsLookAt.current) {
                    satIsLookAt.current = false;
                    setSatIsLookAtState(false);
                    webviewRef.current?.postMessage(JSON.stringify({
                      type: 'FOCUS_SATELLITE',
                      payload: { name: selectedSatellite.name, id: selectedSatellite.id }
                    }));
                  } else {
                    satIsLookAt.current = true;
                    setSatIsLookAtState(true);
                    webviewRef.current?.postMessage(JSON.stringify({
                      type: 'FOCUS_SATELLITE',
                      payload: { name: selectedSatellite.name, id: selectedSatellite.id, lookAt: true }
                    }));
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#3C57E9', paddingHorizontal: 24, paddingVertical: 9, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500' }}>뷰 전환</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 구분선 */}
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 16 }} />

          <ScrollView style={{ paddingHorizontal: 20, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
            {/* 영문 정식명칭 */}
            {selectedSatellite.fullName && (
              <Text style={{ color: '#666666', fontSize: 12, marginBottom: 4, lineHeight: 17 }}>{selectedSatellite.fullName}</Text>
            )}
            {/* 기관 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              {selectedSatellite.nameKo !== selectedSatellite.name && (
                <Text style={{ color: '#999999', fontSize: 14 }}>{selectedSatellite.name}</Text>
              )}
            </View>
            <Text style={{ color: '#999999', fontSize: 14, marginBottom: 2 }}>{selectedSatellite.agency || selectedSatellite.country}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              {selectedSatellite.launchDate && (
                <>
                  <Text style={{ color: '#3B4576', fontSize: 12 }}>발사 시점:</Text>
                  <Text style={{ color: '#3B4576', fontSize: 12 }}>{selectedSatellite.launchDate}</Text>
                </>
              )}

            </View>

            {/* 한줄 미션 설명 — Figma에서는 별도 박스 없이 본문으로 표시하지만, 시각적 구분을 위해 유지 */}
            {selectedSatellite.missionObjective && (
              <View style={{ marginBottom: 4 }} />
            )}

            {/* 실시간 궤도 정보 */}
            <View style={{ marginBottom: 20 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 6, paddingTop: 16, paddingBottom: 18, paddingHorizontal: 16 }}>
                <Text style={{ color: '#7295FE', fontSize: 14, fontWeight: '500', marginBottom: 14 }}>실시간 궤도 정보</Text>
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
                    ? (selectedSatellite.orbitHours * 60).toFixed(0)
                    : null;

                  const rows = [
                    { label: '현재 위도', value: latStr },
                    { label: '현재 경도', value: lonStr },
                    { label: '현재 고도', value: pos?.altitude ? `${pos.altitude.toFixed(1)} km` : '-' },
                    { label: '공전 속도', value: speed ? `${speed} km/s` : '-' },
                    { label: '공전 주기', value: periodMin ? `${periodMin} min` : '-' },
                    { label: '궤도 경사각', value: selectedSatellite.orbitInclination != null ? `${selectedSatellite.orbitInclination.toFixed(1)}°` : '-' },
                  ];

                  return rows.map((r, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < rows.length - 1 ? 6 : 0 }}>
                      <Text style={{ color: '#999999', fontSize: 14, fontWeight: '200', letterSpacing: 0.28 }}>{r.label}</Text>
                      <Text style={{ color: '#EBECF1', fontSize: 14, fontWeight: '500' }}>{r.value}</Text>
                    </View>
                  ));
                })()}
              </View>
            </View>

            {/* Mission Objectives */}
            {selectedSatellite.missionObjective && (
              <View style={{ marginBottom: 20, paddingTop: 10 }}>
                <Text style={{ color: '#7295FE', fontSize: 12, fontWeight: '400', letterSpacing: -0.24, marginBottom: 10 }}>임무 목적</Text>
                <Text style={{ color: '#999999', fontSize: 14, lineHeight: 21 }}>
                  {selectedSatellite.missionObjective}
                </Text>
              </View>
            )}

            {/* 구분선 */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 20 }} />

            {/* Scientific Payloads — border-left 스타일 */}
            {selectedSatellite.instruments && selectedSatellite.instruments.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#7295FE', fontSize: 12, fontWeight: '400', letterSpacing: -0.24, marginBottom: 10 }}>탑재 장비</Text>
                {selectedSatellite.instruments.map((inst: string, idx: number) => (
                  <View key={idx} style={{ borderLeftWidth: 2, borderLeftColor: '#333333', paddingLeft: 10, marginBottom: 13 }}>
                    <Text style={{ color: '#EBECF1', fontSize: 14, fontWeight: '500', lineHeight: 21 }}>{inst}</Text>
                    {selectedSatellite.instrumentDetails?.[inst] && (
                      <Text style={{ color: '#666666', fontSize: 12, lineHeight: 16.8 }}>
                        {selectedSatellite.instrumentDetails[inst]}
                      </Text>
                    )}
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
          top: landingPanelAnim,
          backgroundColor: '#15171C',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          overflow: 'hidden',
          zIndex: 999,
          elevation: 999,
        }}>
          <>
            {/* 드래그 가능 영역: 핸들 + 제목행 */}
            <View {...landingPanelPanResponder.panHandlers}>
              {/* 드래그 핸들 */}
              <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
                <View style={{ width: 49, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
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
                  <Ionicons name="chevron-back" size={24} color="#666666" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#EBECF1', fontSize: 20, fontWeight: '500' }} numberOfLines={1}>
                    {selectedLandingSite.nameKr}
                  </Text>
                  <Text style={{ color: '#666666', fontSize: 12, lineHeight: 16.8 }} numberOfLines={1}>
                    {selectedLandingSite.country} {selectedLandingSite.agency}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={toggleLandingView}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#3C57E9', paddingHorizontal: 24, paddingVertical: 9, borderRadius: 8 }}
                >
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500' }}>뷰 전환</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 구분선 */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 16 }} />

            <ScrollView style={{ paddingHorizontal: 20, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
              {/* Figma 기반 레이아웃: Title+Subtitle / 뷰전환 버튼 */}
              {/* 서브 정보: 타입 + 좌표 | share/bookmark 아이콘 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: '#999999', fontSize: 14, lineHeight: 21 }}>{selectedLandingSite.missionType || 'Lander'}</Text>
                  <Text style={{ color: '#3B4576', fontSize: 12, lineHeight: 16.8 }}>
                    {Math.abs(selectedLandingSite.lat).toFixed(3)}°{selectedLandingSite.lat >= 0 ? 'N' : 'S'}  {Math.abs(selectedLandingSite.lng).toFixed(3)}°{selectedLandingSite.lng >= 0 ? 'E' : 'W'}
                  </Text>
                </View>
                {/* 스크랩 / 내보내기 — 38px 원형 */}
                <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                  <TouchableOpacity
                    style={{ width: 38, height: 38, borderRadius: 20, borderWidth: 0.8, borderColor: '#808080', justifyContent: 'center', alignItems: 'center' }}
                    onPress={async () => {
                      if (!selectedLandingSite) return;
                      try {
                        const deepLink = Linking.createURL('/explore', { queryParams: { lat: String(selectedLandingSite.lat), lng: String(selectedLandingSite.lng), name: selectedLandingSite.nameKr, type: 'landing' } });
                        await Share.share({
                          message: `🌙 ${selectedLandingSite.nameKr} (${selectedLandingSite.officialName})\n📍 ${selectedLandingSite.lat.toFixed(3)}°, ${selectedLandingSite.lng.toFixed(3)}°\n🚀 ${selectedLandingSite.country} ${selectedLandingSite.agency} · ${selectedLandingSite.landingDate}\n\n${selectedLandingSite.description}\n\n👉 Plus Ultra에서 직접 탐사하기:\n${deepLink}`,
                        });
                      } catch (e) { }
                    }}
                  >
                    <Svg width={16} height={13} viewBox="0 0 16 13" fill="none"><Path d="M16 6.06667L9.77778 0V3.46667C3.55556 4.33333 0.888889 8.66667 0 13C2.22222 9.96667 5.33333 8.58 9.77778 8.58V12.1333L16 6.06667Z" fill="#808080" /></Svg>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ width: 38, height: 38, borderRadius: 20, borderWidth: 0.8, borderColor: '#808080', justifyContent: 'center', alignItems: 'center' }}
                    onPress={async () => {
                      if (!selectedLandingSite) return;
                      if (!isLoggedIn) { router.push('/auth/login'); return; }
                      const id = `landing-${selectedLandingSite.officialName}`;
                      if (isLandingScrapped) {
                        await removeScrapArea(id);
                        setIsLandingScrapped(false);
                      } else {
                        await addScrapArea({
                          id,
                          type: 'landing',
                          name: selectedLandingSite.nameKr,
                          lat: selectedLandingSite.lat,
                          lng: selectedLandingSite.lng,
                          extra: `${selectedLandingSite.country} · ${selectedLandingSite.year}`,
                          savedAt: Date.now(),
                        });
                        setIsLandingScrapped(true);
                      }
                    }}
                  >
                    <Svg width={10} height={14} viewBox="0 0 10 14" fill="none"><Path d="M9.5 0.5V13.2305L5.20312 11.3242L5 11.2344L4.79688 11.3242L0.5 13.2305V0.5H9.5Z" stroke={isLandingScrapped ? '#E9BE3C' : '#808080'} fill={isLandingScrapped ? '#E9BE3C' : 'none'} /></Svg>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 설명 */}
              {selectedLandingSite.description && (
                <Text style={{ color: '#999999', fontSize: 14, lineHeight: 21, marginBottom: 20 }}>{selectedLandingSite.description}</Text>
              )}

              {/* Mission Details 박스 */}
              <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 6, paddingTop: 16, paddingBottom: 18, paddingHorizontal: 16, marginBottom: 20 }}>
                <Text style={{ color: '#7295FE', fontSize: 14, fontWeight: '500', marginBottom: 14 }}>미션 상세</Text>
                {[
                  { label: '착륙 시점', value: selectedLandingSite.landingDate || selectedLandingSite.year },
                  { label: '착륙 지역', value: selectedLandingSite.regionName || (selectedLandingSite.lat > 90 ? '후면' : '전면') },
                  { label: '미션 유형', value: selectedLandingSite.missionType || (selectedLandingSite.mode === 'Manned' ? '유인 착륙선' : '무인 착륙선') },
                  { label: '상태', value: selectedLandingSite.contactType || '알 수 없음' },
                ].map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < 3 ? 6 : 0 }}>
                    <Text style={{ color: '#999999', fontSize: 14, fontWeight: '200', letterSpacing: 0.28 }}>{r.label}</Text>
                    <Text style={{ color: '#EBECF1', fontSize: 14, fontWeight: '500' }}>{r.value}</Text>
                  </View>
                ))}
              </View>

              {/* Mission Objectives */}
              {selectedLandingSite.description && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ color: '#7295FE', fontSize: 12, fontWeight: '400', letterSpacing: -0.24, marginBottom: 10 }}>임무 목적</Text>
                  <Text style={{ color: '#999999', fontSize: 14, lineHeight: 21 }}>{selectedLandingSite.description}</Text>
                </View>
              )}

              {/* 구분선 */}
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 10 }} />

              {/* Nearby Missions — 68x68 썸네일 리스트 */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#7295FE', fontSize: 12, fontWeight: '400', letterSpacing: -0.24, marginBottom: 10 }}>인근 탐사 지점</Text>
                {findNearbySites(selectedLandingSite, 2).map((nearby, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderBottomWidth: idx < 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.07)' }}
                    onPress={() => {
                      goToLandingSite(nearby);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 68, height: 68, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                      {LANDING_SITE_IMAGES[nearby.officialName] ? (
                        <Image source={LANDING_SITE_IMAGES[nearby.officialName]} style={{ width: 68, height: 68, borderRadius: 3 }} resizeMode="cover" />
                      ) : (
                        <Ionicons name="location" size={24} color="#3C57E9" />
                      )}
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <Text style={{ color: '#EBECF1', fontSize: 18, fontWeight: '500' }} numberOfLines={1}>{nearby.nameKr}</Text>
                      <Text style={{ color: '#666666', fontSize: 12, lineHeight: 16.8 }}>{nearby.year} · {nearby.country}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 하단 버튼 — Related News + Claim Status */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, paddingTop: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#EAECF6', borderRadius: 5, height: 56, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => router.push(`/(tabs)/moon?search=${encodeURIComponent(selectedLandingSite.nameKr)}`)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: '#1A1A1A', fontSize: 16, fontWeight: '600' }}>관련 뉴스</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#3C57E9', borderRadius: 5, height: 56, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => setLandingSiteDetailMode('occupation')}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>개척 현황</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </>
        </Animated.View>
      )}

      {/* ═══ 착륙지점 점유 현황 — 전체화면 슬라이드 ═══ */}
      {selectedLandingSite && mainMode === 'exploration' && landingSiteDetailMode === 'occupation' && (
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#15171C', zIndex: 1100, elevation: 1100, transform: [{ translateX: occupationSlideAnim }] }}>
          <OccupationStatusPanel
            onBack={() => {
              Animated.timing(occupationSlideAnim, { toValue: Dimensions.get('window').width, duration: 250, useNativeDriver: true }).start(() => {
                setLandingSiteDetailMode('detail');
              });
            }}
            onGoToOccupation={async () => {
              const lat = selectedLandingSite.lat;
              const lng = selectedLandingSite.lng;
              const name = selectedLandingSite.nameKr;
              setFeatureHighlight({ name, lat, lng, radiusKm: 5 });
              setSelectedLandingSite(null);
              setLandingSiteDetailMode('detail');
              skipCameraResetRef.current = true;
              setMainMode('test2');
              // DB에서 점유 토큰 로드 → WebView에 전달
              try {
                const tokens = await getAllOccupiedTokens();
                const myCells = user?.id ? await getUserOccupiedCells(user.id) : [];
                const myTokens = myCells.map(c => c.cellId);
                webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_OCCUPIED_TOKENS', payload: { tokens, myTokens } }));
              } catch (e) { console.log('[Index] Failed to load occupied tokens', e); }
              setTimeout(() => {
                webviewRef.current?.postMessage(JSON.stringify({ type: 'ROTATE_TO_LOCATION', payload: { lat, lng } }));
                webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_FEATURE_HIGHLIGHT', payload: { name, lat, lng, radiusKm: 5 } }));
              }, 800);
            }}
            target={{ name: selectedLandingSite.nameKr, lat: selectedLandingSite.lat, lng: selectedLandingSite.lng, radiusKm: 5 }}
          />
        </Animated.View>
      )}

      {/* ═══ 착륙지점 뷰 모드 (하단 20%, 타이틀만 + 화면 크게 보기) ═══ */}
      {selectedLandingSite && mainMode === 'exploration' && landingSiteDetailMode === 'view' && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#15171C',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
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
              <Ionicons name="chevron-back" size={22} color="#666666" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ color: '#EBECF1', fontSize: 17, fontWeight: '600' }}>{selectedLandingSite.nameKr}</Text>
                <Text style={{ color: '#666666', fontSize: 13 }}>{selectedLandingSite.officialName}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                setSelectedLandingSite(null);
                webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="close" size={20} color="#666666" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ═══ 대표 지형 상세 패널 (50%, 풀 정보) ═══ */}
      {selectedFeature && mainMode === 'exploration' && (featureDetailMode === 'detail' || featureDetailMode === 'occupation') && (
        <Animated.View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: featurePanelAnim,
          backgroundColor: '#15171C',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          overflow: 'hidden',
          zIndex: 999,
          elevation: 999,
        }}>
          {/* 드래그 가능 영역: 핸들 + 제목행 */}
          <View {...featurePanelPanResponder.panHandlers}>
            {/* 드래그 핸들 */}
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
              <View style={{ width: 49, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
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
                <Ionicons name="chevron-back" size={24} color="#666666" />
              </TouchableOpacity>
              <Text style={{ color: '#EBECF1', fontSize: 20, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                {selectedFeature.nameKr}
              </Text>
              <TouchableOpacity
                onPress={toggleFeatureView}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#3C57E9', paddingHorizontal: 24, paddingVertical: 9, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500' }}>뷰 전환</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 구분선 */}
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 16 }} />

          <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
            {/* 서브 정보: 유형 + 좌표 | share/book 아이콘 38px */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: '#999999', fontSize: 14, lineHeight: 21 }}>{selectedFeature.typeKr}</Text>
                <Text style={{ color: '#3B4576', fontSize: 12, lineHeight: 16.8 }}>
                  {Math.abs(selectedFeature.lat).toFixed(2)}°{selectedFeature.lat >= 0 ? 'N' : 'S'}  {Math.abs(selectedFeature.lng).toFixed(2)}°{selectedFeature.lng >= 0 ? 'E' : 'W'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <TouchableOpacity
                  style={{ width: 38, height: 38, borderRadius: 20, borderWidth: 0.8, borderColor: '#808080', justifyContent: 'center', alignItems: 'center' }}
                  onPress={async () => {
                    if (!selectedFeature) return;
                    try {
                      const deepLink = Linking.createURL('/explore', { queryParams: { lat: String(selectedFeature.lat), lng: String(selectedFeature.lng), name: selectedFeature.nameKr, type: 'feature' } });
                      await Share.share({
                        message: `🌙 ${selectedFeature.nameKr} (${selectedFeature.nameEn})\n📍 ${selectedFeature.lat.toFixed(3)}°, ${selectedFeature.lng.toFixed(3)}°\n🏔️ ${selectedFeature.typeKr} · 직경 ${selectedFeature.diameterKm}km\n\n${selectedFeature.description}\n\n👉 Plus Ultra에서 직접 탐사하기:\n${deepLink}`,
                      });
                    } catch (e) { }
                  }}
                >
                  <Svg width={16} height={13} viewBox="0 0 16 13" fill="none"><Path d="M16 6.06667L9.77778 0V3.46667C3.55556 4.33333 0.888889 8.66667 0 13C2.22222 9.96667 5.33333 8.58 9.77778 8.58V12.1333L16 6.06667Z" fill="#808080" /></Svg>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ width: 38, height: 38, borderRadius: 20, borderWidth: 0.8, borderColor: '#808080', justifyContent: 'center', alignItems: 'center' }}
                  onPress={async () => {
                    if (!selectedFeature) return;
                    if (!isLoggedIn) { router.push('/auth/login'); return; }
                    const id = `feature-${selectedFeature.id}`;
                    if (isFeatureScrapped) {
                      await removeScrapArea(id);
                      setIsFeatureScrapped(false);
                    } else {
                      await addScrapArea({
                        id,
                        type: 'feature',
                        name: selectedFeature.nameKr,
                        lat: selectedFeature.lat,
                        lng: selectedFeature.lng,
                        extra: selectedFeature.typeKr,
                        savedAt: Date.now(),
                      });
                      setIsFeatureScrapped(true);
                    }
                  }}
                >
                  <Svg width={10} height={14} viewBox="0 0 10 14" fill="none"><Path d="M9.5 0.5V13.2305L5.20312 11.3242L5 11.2344L4.79688 11.3242L0.5 13.2305V0.5H9.5Z" stroke={isFeatureScrapped ? '#E9BE3C' : '#808080'} fill={isFeatureScrapped ? '#E9BE3C' : 'none'} /></Svg>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3열 요약 Info — 균등 3등분 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 8, marginBottom: 12 }}>
              <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#999999', fontSize: 14, fontWeight: '500' }}>직경</Text>
                <Text style={{ color: '#EBECF1', fontSize: 14, fontWeight: '500' }}>{selectedFeature.diameterKm} km</Text>
              </View>
              <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#999999', fontSize: 14, fontWeight: '500' }}>깊이</Text>
                <Text style={{ color: '#EBECF1', fontSize: 14, fontWeight: '500' }}>{selectedFeature.depthKm ? `${selectedFeature.depthKm} km` : '-'}</Text>
              </View>
              <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#999999', fontSize: 14, fontWeight: '500' }}>면적</Text>
                <Text style={{ color: '#EBECF1', fontSize: 14, fontWeight: '500' }}>{selectedFeature.areaKm2 ? formatArea(selectedFeature.areaKm2) : '-'}</Text>
              </View>
            </View>

            {/* 설명 — #999 14px */}
            <Text style={{ color: '#999999', fontSize: 14, lineHeight: 21, marginBottom: 20 }}>{selectedFeature.description}</Text>

            {/* 지형 정보 — rgba(255,255,255,0.07) r6 박스 */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 6, paddingTop: 16, paddingBottom: 18, paddingHorizontal: 16, marginBottom: 20 }}>
              <Text style={{ color: '#7295FE', fontSize: 14, fontWeight: '500', marginBottom: 14 }}>지형 정보</Text>
              {[
                { label: '유형', value: selectedFeature.typeKr },
                { label: '위치', value: isFarSide(selectedFeature) ? '달 뒷면' : '달 앞면' },
              ].map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ color: '#999999', fontSize: 14, fontWeight: '200', letterSpacing: 0.28 }}>{r.label}</Text>
                  <Text style={{ color: '#EBECF1', fontSize: 14, fontWeight: '500' }}>{r.value}</Text>
                </View>
              ))}
            </View>

            {/* 구분선 */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 10 }} />

            {/* 인근 주요 지형 — 68x68 썸네일 리스트 */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: '#7295FE', fontSize: 12, fontWeight: '400', letterSpacing: -0.24, marginBottom: 10 }}>인근 주요 지형</Text>
              {findNearbyFeatures(selectedFeature, 2).map((nearby, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderBottomWidth: idx < 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.07)' }}
                  onPress={() => {
                    goToFeature(nearby);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ width: 68, height: 68, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                    {LUNAR_FEATURE_IMAGES[nearby.id] ? (
                      <Image source={LUNAR_FEATURE_IMAGES[nearby.id]} style={{ width: 68, height: 68, borderRadius: 3 }} resizeMode="cover" />
                    ) : (
                      <Ionicons name="earth" size={24} color="#3C57E9" />
                    )}
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={{ color: '#EBECF1', fontSize: 18, fontWeight: '500' }} numberOfLines={1}>{nearby.nameKr}</Text>
                    <Text style={{ color: '#666666', fontSize: 12, lineHeight: 16.8 }}>{nearby.typeKr} · {nearby.diameterKm}km</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* 하단 2버튼 — 관련 뉴스 + 개척 현황 */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, paddingTop: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#EAECF6', borderRadius: 5, height: 56, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => router.push(`/(tabs)/moon?search=${encodeURIComponent(selectedFeature.nameKr)}`)}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#1A1A1A', fontSize: 16, fontWeight: '600' }}>관련 뉴스</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#3C57E9', borderRadius: 5, height: 56, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setFeatureDetailMode('occupation')}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>개척 현황</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 30 }} />
          </ScrollView>
        </Animated.View>
      )}

      {/* ═══ 대표 지형 점유 현황 ═══ */}
      {selectedFeature && mainMode === 'exploration' && featureDetailMode === 'occupation' && (
        <Animated.View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: 0,
          backgroundColor: '#15171C',
          overflow: 'hidden',
          zIndex: 1100,
          elevation: 1100,
          transform: [{ translateX: occupationSlideAnim }],
        }}>
          <OccupationStatusPanel
            onBack={() => {
              Animated.timing(occupationSlideAnim, { toValue: Dimensions.get('window').width, duration: 250, useNativeDriver: true }).start(() => {
                setFeatureDetailMode('detail');
              });
            }}
            onGoToOccupation={async () => {
              const lat = selectedFeature.lat;
              const lng = selectedFeature.lng;
              const name = selectedFeature.nameKr;
              const radiusKm = (selectedFeature.diameterKm || 10) / 2;
              setFeatureHighlight({ name, lat, lng, radiusKm });
              setSelectedFeature(null);
              setFeatureDetailMode('detail');
              skipCameraResetRef.current = true;
              setMainMode('test2');
              try {
                const tokens = await getAllOccupiedTokens();
                const myCells = user?.id ? await getUserOccupiedCells(user.id) : [];
                const myTokens = myCells.map(c => c.cellId);
                webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_OCCUPIED_TOKENS', payload: { tokens, myTokens } }));
              } catch (e) { console.log('[Index] Failed to load occupied tokens', e); }
              setTimeout(() => {
                webviewRef.current?.postMessage(JSON.stringify({ type: 'ROTATE_TO_LOCATION', payload: { lat, lng } }));
                webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_FEATURE_HIGHLIGHT', payload: { name, lat, lng, radiusKm } }));
              }, 800);
            }}
            target={{ name: selectedFeature.nameKr, lat: selectedFeature.lat, lng: selectedFeature.lng, diameterKm: selectedFeature.diameterKm, widthKm: selectedFeature.widthKm, angle: selectedFeature.angle }}
          />
        </Animated.View>
      )}

      {/* ═══ 대표 지형 전체화면 뷰 (하단 20% 타이틀바) ═══ */}
      {selectedFeature && mainMode === 'exploration' && featureDetailMode === 'view' && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#15171C',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
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
              <Ionicons name="chevron-back" size={22} color="#666666" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ color: '#EBECF1', fontSize: 17, fontWeight: '600' }}>{getFeatureTypeEmoji(selectedFeature.typeKr)} {selectedFeature.nameKr}</Text>
                <Text style={{ color: '#666666', fontSize: 13 }}>{selectedFeature.nameEn}</Text>
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
              <Ionicons name="close" size={20} color="#666666" />
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
              <View style={{ width: 49, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

              {selectedLandmark && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 32, marginRight: 12 }}>{selectedLandmark.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#EBECF1', fontSize: 20, fontWeight: '600' }}>
                        {selectedLandmark.name}
                      </Text>
                      {selectedLandmark.type === 'apollo' && (
                        <Text style={{ color: '#3C57E9', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                          🧑‍🚀 {selectedLandmark.crew}
                        </Text>
                      )}
                    </View>
                  </View>

                  <Text style={{ color: '#666666', fontSize: 15, lineHeight: 24, marginBottom: 16 }}>
                    {selectedLandmark.desc}
                  </Text>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {selectedLandmark.date && (
                      <View style={{ backgroundColor: 'rgba(60,87,233,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5 }}>
                        <Text style={{ color: '#3C57E9', fontSize: 12, fontWeight: '600' }}>📅 {selectedLandmark.date}</Text>
                      </View>
                    )}
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5 }}>
                      <Text style={{ color: '#666666', fontSize: 12 }}>📍 {selectedLandmark.lat.toFixed(2)}°, {selectedLandmark.lng.toFixed(2)}°</Text>
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
        <View style={{ flex: 1, backgroundColor: '#15171C' }}>
          {/* ─── 헤더 ─── */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
            borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
          }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#EBECF1' }}>개척 확정</Text>
            <TouchableOpacity
              onPress={() => setShowOccupyConfirm(false)}
              style={{ position: 'absolute', right: 20, top: 60 }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {/* ─── 총 비용 + 합산 면적 ─── */}
          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
            <Text style={{ fontSize: 36, fontWeight: '800', color: '#F9FAFB' }}>
              {magCost + 'Mag'}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8 }}>
              {'총 면적: ' + (magCost * 0.8).toFixed(1) + ' km²  ·  ' + (magCost * 25) + ' ELL'}
            </Text>
          </View>

          {/* ─── 셀 목록 ─── */}
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 12 }}>셀 목록 ({magCost}개)</Text>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {(() => {
                const cellTokens = selectedCell?.isMultiSelect
                  ? (selectedCell.multiTokens || [])
                  : (selectedCell?.cellId ? [selectedCell.cellId] : []);
                const multiLats = selectedCell?.multiLats || [];
                const multiLngs = selectedCell?.multiLngs || [];
                return cellTokens.map((token: string, idx: number) => {
                  const lat = selectedCell?.isMultiSelect ? (multiLats[idx] ?? selectedCell?.lat ?? 0) : (selectedCell?.lat ?? 0);
                  const lng = selectedCell?.isMultiSelect ? (multiLngs[idx] ?? selectedCell?.lng ?? 0) : (selectedCell?.lng ?? 0);
                  const latStr = Math.abs(lat).toFixed(3) + '°' + (lat >= 0 ? 'N' : 'S');
                  const lngStr = Math.abs(lng).toFixed(3) + '°' + (lng >= 0 ? 'E' : 'W');
                  return (
                    <View key={idx} style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingVertical: 12,
                      borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#F9FAFB', flex: 1 }} numberOfLines={1}>
                        {token.toUpperCase()}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>
                        {latStr + '  ' + lngStr}
                      </Text>
                    </View>
                  );
                });
              })()}
            </ScrollView>
          </View>

          {/* ─── 하단 버튼 ─── */}
          <View style={{ paddingHorizontal: 28, paddingBottom: 40 }}>
            <TouchableOpacity
              style={{
                backgroundColor: '#2563EB', borderRadius: 14,
                paddingVertical: 18, alignItems: 'center',
                flexDirection: 'row', justifyContent: 'center', gap: 8,
              }}
              disabled={purchasing}
              activeOpacity={0.8}
              onPress={async () => {
                if (purchasing) return;
                setPurchasing(true);
                try {
                  const cellTokens = selectedCell?.isMultiSelect
                    ? (selectedCell.multiTokens || [])
                    : (selectedCell?.cellId ? [selectedCell.cellId] : []);
                  const multiLats = selectedCell?.multiLats || [];
                  const multiLngs = selectedCell?.multiLngs || [];

                  const territories = cellTokens.map((token: string, idx: number) => ({
                    token,
                    level: occupySelectLevel,
                    lat: selectedCell?.isMultiSelect ? (multiLats[idx] ?? selectedCell?.lat ?? 0) : (selectedCell?.lat ?? 0),
                    lng: selectedCell?.isMultiSelect ? (multiLngs[idx] ?? selectedCell?.lng ?? 0) : (selectedCell?.lng ?? 0),
                    area: '0.8',
                    magCost: 1,
                  }));

                  // 로컬 옵티미스틱 업데이트
                  spendEll(magCost, territories);

                  // 묶음 구매 ID 생성
                  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

                  // DB 연동: 셀별 구매 처리 (ELL 차감 + INSERT, 동일 batchId)
                  let successCount = 0;
                  const ellPerCell = ELL_PER_MAG;
                  for (const t of territories) {
                    if (user?.id) {
                      const ok = await occupyCell(user.id, t.token, t.lat, t.lng, t.magCost, ellPerCell, batchId);
                      if (ok) successCount++;
                    }
                  }

                  // activity_logs에 묶음 1건 기록
                  if (successCount > 0 && user?.id) {
                    try {
                      await supabase.from('activity_logs').insert({
                        user_id: user.id,
                        type: 'mag_claim',
                        description: successCount > 1
                          ? `MAG ${successCount}개 묶음 개척`
                          : `MAG 개척`,
                        ell_amount: successCount * ellPerCell,
                        mag_count: successCount,
                        metadata: { batch_id: batchId, cell_count: successCount },
                      });
                    } catch (logErr) {
                      console.warn('[Index] activity_logs insert skipped:', logErr);
                    }
                  }

                  // DB에서 최신 상태 갱신
                  const tokens = await getAllOccupiedTokens();
                  const myCells = user?.id ? await getUserOccupiedCells(user.id) : [];
                  const myTokens = myCells.map(c => c.cellId);
                  webviewRef.current?.postMessage(JSON.stringify({
                    type: 'SET_OCCUPIED_TOKENS', payload: { tokens, myTokens }
                  }));

                  // ELL 잔액 및 유저 정보 DB에서 새로고침
                  await refreshBalance();
                  await refreshUser();

                  setMagCost(0);
                  setShowOccupyConfirm(false);
                  setSelectedCell(null);
                  webviewRef.current?.postMessage(JSON.stringify({
                    type: 'OCCUPY_CELLS',
                    payload: { tokens: cellTokens, level: occupySelectLevel }
                  }));

                  if (successCount > 0) {
                    setTimeout(() => {
                      Alert.alert('개척 완료', `구역 개척 완료!\n소모: ${magCost * ELL_PER_MAG} ELL (${magCost} Mag)`);
                    }, 300);
                  } else {
                    setTimeout(() => {
                      Alert.alert('개척 실패', 'ELL 잔액이 부족하거나 오류가 발생했습니다.');
                    }, 300);
                    // 로컬 상태도 되돌리기
                    await refreshBalance();
                  }
                } finally {
                  setPurchasing(false);
                }
              }}
            >
              {purchasing ? (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>처리 중...</Text>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>개척 하기</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowOccupyConfirm(false)}
              style={{ alignItems: 'center', paddingVertical: 12, marginTop: 4 }}
            >
              <Text style={{ fontSize: 14, color: '#6B7280' }}>취소</Text>
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

  // 모드 토글 (탐사/점유) - 라인형
  modeToggleContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  modeToggleInner: {
    flexDirection: 'row',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modeTabActive: {
    borderBottomColor: '#3C57E9',
  },
  modeTabText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    fontWeight: '500',
  },
  modeTabTextActive: {
    color: '#EBECF1',
    fontWeight: '600',
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
    borderRadius: 2,
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
    borderRadius: 2,
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
    borderRadius: 2,
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
    gap: 10,
    zIndex: 10,
    alignItems: 'center',
  },
  layerBtn: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(50,57,80,0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlGroup: {
    backgroundColor: 'rgba(50,57,80,0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  controlBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlSep: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginHorizontal: 10,
  },
  levelSelectContainer: {
    position: 'absolute',
    top: 110,
    left: 16,
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderRadius: 2,
    padding: 3,
    zIndex: 15,
  },
  levelSelectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 2,
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
  aiPicksBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3C57E9',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  aiPicksBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
    borderRadius: 2,
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
    borderRadius: 4,
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
    borderRadius: 2,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  bottomCard2: {
    backgroundColor: '#15171C',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 0,
  },
  dragHandleArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 48,
    height: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
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
    color: '#F9FAFB',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cellMagSize: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  cellMagLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  cellSubInfo: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  cellUrn: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
    marginBottom: 4,
  },
  cellDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 14,
  },
  claimCard: {
    backgroundColor: '#2A2C30',
    borderRadius: 10,
    padding: 16,
    marginTop: 4,
  },
  cellPriceLabel: {
    fontSize: 13,
    color: '#3B82F6',
  },
  cellPriceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F9FAFB',
    marginTop: 4,
    marginBottom: 14,
  },
  occupyButton: {
    backgroundColor: '#2175FA',
    borderRadius: 10,
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
    color: '#3B82F6',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  poiDetail: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  poiDistance: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  poiLink: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  occupyConfirmContainer: {
    flex: 1,
    backgroundColor: '#15171C',
  },
  occupyConfirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  occupyConfirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  ocSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
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
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocCellToken: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  ocCellLocation: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 3,
  },
  ocCellMeta: {
    fontSize: 12,
    color: '#6B7280',
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
    color: '#9CA3AF',
  },
  ocLedgerValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  occupyConfirmButton: {
    backgroundColor: '#2175FA',
    borderRadius: 10,
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
    borderRadius: 2,
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
    borderRadius: 2,
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
    borderRadius: 2,
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
    borderRadius: 2,
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
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cellS2Id: {
    color: 'rgba(255,255,255,0.4)',
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
