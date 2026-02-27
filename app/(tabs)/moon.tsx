import React, { useRef, useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Dimensions, ActivityIndicator, ScrollView, Switch, TextInput, Modal, Animated } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams } from 'expo-router';
import { createCesiumHtml } from '@/constants/cesium/CesiumHtml';
import { loadMineralData } from '@/utils/mineralDataLoader';
import AR2MoonViewer from '@/components/AR2MoonViewer';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { LIVE_MISSIONS, Spacecraft } from '@/constants/SpacecraftData';
import { fetchSpacecraftPosition, fetchSpacecraftTrajectory } from '@/services/HorizonsApi';

export default function MoonScreen() {
  const webviewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  // 모드 상태 추가
  const [mainMode, setMainMode] = useState<'exploration' | 'occupation'>('exploration');
  const [subMode, setSubMode] = useState<'space' | 'firstPerson'>('space');
  const [canGoBack, setCanGoBack] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLocation, setActiveLocation] = useState<string | null>(null);

  // AI 땅 추천 상태
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [aiAnswers, setAiAnswers] = useState<Record<number, string>>({});
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [cellExpanded, setCellExpanded] = useState(false);

  // 탐사 모드(Exploration) 동적 상태 및 위성 선택 상태
  const [selectedSatellite, setSelectedSatellite] = useState<any>(null);
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
  const MAX_ZOOM_LEVEL = 4;

  // 부가기능 패널 상태
  const [showFeaturePanel, setShowFeaturePanel] = useState(false);
  const [featureListView, setFeatureListView] = useState<'none' | 'landing' | 'terrain' | 'satellite'>('none');
  const [showLandingSites, setShowLandingSites] = useState(false);
  const [showTerrain, setShowTerrain] = useState(false);
  const [showSatellites, setShowSatellites] = useState(false);

  const [landmarkListData, setLandmarkListData] = useState<any>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<any>(null);

  // Apollo GLB 로컬 Asset URI
  const [apolloModelUri, setApolloModelUri] = useState('');
  useEffect(() => {
    Asset.fromModule(require('../../assets/apollo_lm.glb')).downloadAsync().then(asset => {
      if (asset.localUri) setApolloModelUri(asset.localUri);
    }).catch(() => { });
  }, []);

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

  // 광물 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Loading mineral data...');
        const data = await loadMineralData();
        console.log('Mineral data loaded:', data.length, 'entries');

        // WebView가 준비되면 데이터 전송
        // 데이터가 크므로 청크로 나눠서 전송
        const chunkSize = 1000;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          setTimeout(() => {
            webviewRef.current?.postMessage(JSON.stringify({
              type: 'LOAD_MINERAL_DATA',
              data: chunk,
              isFirst: i === 0,
              isLast: i + chunkSize >= data.length
            }));
          }, 100 * (i / chunkSize)); // 각 청크를 100ms 간격으로 전송
        }
      } catch (error) {
        console.error('Error loading mineral data:', error);
      }
    };

    // WebView가 로드된 후 데이터 로딩
    const timer = setTimeout(loadData, 2000);
    return () => clearTimeout(timer);
  }, []);

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

    if (!loading) {
      const timer = setTimeout(() => {
        loadTempMapImage();
        loadThermalGridData();
        loadGravityData();
        loadNeutronData();
      }, 3000);
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
          break;
        case 'CELL_DESELECTED':
          setSelectedCell(null);
          setCellExpanded(false);
          break;
        case 'SATELLITE_SELECTED':
          console.log('[WebView] SATELLITE_SELECTED:', message.payload);
          setSelectedSatellite(message.payload);
          break;
        case 'SATELLITE_DESELECTED':
          setSelectedSatellite(null);
          break;
        case 'DEPTH_CHANGED':
          setCanGoBack(message.payload.canGoBack);
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
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  // 컨트롤 핸들러
  const handleZoomIn = () => {
    if (currentZoomLevel >= MAX_ZOOM_LEVEL) return;
    webviewRef.current?.postMessage(JSON.stringify({ type: 'ZOOM_IN' }));
  };

  const handleZoomOut = () => {
    if (currentZoomLevel <= 0) return;
    webviewRef.current?.postMessage(JSON.stringify({ type: 'ZOOM_OUT' }));
  };

  const handleReset = () => {
    webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
  };

  const handleBack = () => {
    webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_BACK' }));
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
    } else {
      // 점유 모드로 전환 시 부가기능 비활성화
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

  // 위성 데이터 로딩 (탐사모드 - 위성 토글 ON 시)
  useEffect(() => {
    if (mainMode === 'exploration' && showSatellites && satelliteData.length === 0 && !isLoadingSatellite) {
      loadSpacecraftData();
    }
  }, [mainMode, showSatellites]);

  const loadSpacecraftData = async () => {
    setIsLoadingSatellite(true);
    const results: any[] = [];
    let index = 0;

    for (const mission of LIVE_MISSIONS) {
      if (mission.apiEnabled) {
        try {
          const [position, trajectory] = await Promise.all([
            fetchSpacecraftPosition(mission.id),
            fetchSpacecraftTrajectory(mission.id, 24) // 기본 24시간 궤적
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

    // WebView로 데이터 전송
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'LOAD_SATELLITE_DATA',
      data: results
    }));
  };


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
    setAiStep(0);
    setAiAnswers({});
  };

  const aiQuestions = [
    { title: '목표 (설립 목적)', options: ['거주 기지 (안정성 중시)', '자원 채굴 (광물 중시)', '우주 관측 (시야/고도 중시)', '임시 전초기지 (접근성 중시)'] },
    { title: '위치 선호도', options: ['항구적 음영지역 (수자원 기대, 극지방)', '적도 부근 (태양광 에너지 유리)', '고요의 바다 등 광활한 평지', '크레이터 내부 (특수 지형)'] },
    { title: '필수 자원 우선순위', options: ['수자원 (얼음 형태)', '풍부한 티타늄/철 (구조물 자재)', '헬륨-3 (희귀 에너지원)', '적당한 일조량 (태양광 발전)'] },
    { title: '지형 특성', options: ['크고 평탄한 분지', '복잡하지만 자원이 밀집된 협곡', '높은 산맥 위', '적당한 구릉지대'] }
  ];

  const handleAIAnswer = (answer: string) => {
    const newAnswers = { ...aiAnswers, [aiStep]: answer };
    setAiAnswers(newAnswers);

    if (aiStep < aiQuestions.length - 1) {
      setAiStep(aiStep + 1);
    } else {
      // 분석(가짜 딜레이 후 결과 전송) 시작
      setAiStep(99); // 99는 분석 중 상태
      setTimeout(() => {
        // 응답에 따른 위경도 추론 (모의 로직)
        let targetLat = 0; // 기본 적도
        let targetLng = 0; // 기본 본초 자오선

        const locPref = newAnswers[1];
        if (locPref.includes('극지방')) targetLat = -85 + Math.random() * 5; // 남극 근처
        else if (locPref.includes('적도')) targetLat = -5 + Math.random() * 10;
        else if (locPref.includes('평지')) { targetLat = 20; targetLng = 30; } // 고요의 바다 인근
        else targetLat = 45; // 임의 위치

        // WebView에 전송
        setMainMode('occupation');
        webviewRef.current?.postMessage(JSON.stringify({
          type: 'RECOMMEND_LAND',
          payload: { lat: targetLat, lng: targetLng }
        }));

        handleCloseAIModal();
      }, 2000);
    }
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
          </View>
        </View>

        {/* 탐사 모드 서브 토글 (우주 뷰 / 1인칭 뷰) */}
        {mainMode === 'exploration' && (
          <View style={styles.subModeToggleContainer}>
            <TouchableOpacity onPress={() => setSubMode('space')} style={[styles.subModeTab, subMode === 'space' && styles.subModeTabActive]}>
              <Text style={[styles.subModeTabText, subMode === 'space' && styles.subModeTabTextActive]}>우주 뷰</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSubMode('firstPerson')} style={[styles.subModeTab, subMode === 'firstPerson' && styles.subModeTabActive]}>
              <Text style={[styles.subModeTabText, subMode === 'firstPerson' && styles.subModeTabTextActive]}>1인칭 뷰</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 점유 모드 검색 영역 */}
        {mainMode === 'occupation' && (
          <View style={styles.topSearchSection}>
            {/* 검색 바 */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="좌표 또는 지역 검색"
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* 유명 좌표 버튼 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.locationTabsContainer}
              contentContainerStyle={styles.locationTabsContent}
            >
              {famousLocations.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.locationTab,
                    activeLocation === location.id && styles.locationTabActive
                  ]}
                  onPress={() => goToLocation(location)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.locationTabText,
                    activeLocation === location.id && styles.locationTabTextActive
                  ]}>
                    {location.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

      </SafeAreaView>

      {/* 캔버스 영역 (Flex) */}
      <View style={styles.canvasSection}>
        {/* Cesium WebView */}
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: createCesiumHtml(apolloModelUri), baseUrl: 'https://moon.com' }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
        />

        {/* 우측 컨트롤 버튼 (캔버스 영역 내부) */}
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

          {/* AI 추천 버튼 (점유 모드) */}
          {mainMode === 'occupation' && (
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: 'rgba(59, 130, 246, 0.8)', borderColor: '#60A5FA', marginBottom: 10 }]}
              onPress={() => { setShowAIModal(true); setAiStep(0); setAiAnswers({}); }}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          {/* 옵션(설정) 버튼 - 점유 모드에서만 표시 */}
          {mainMode === 'occupation' && (
            <TouchableOpacity
              style={[styles.controlBtn, (showOptions || showFilterModal || showTempMap || showThermalGrid) && styles.controlBtnActive]}
              onPress={toggleOptions}
              activeOpacity={0.7}
            >
              <Ionicons name="options" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          {/* 확대 버튼 - 점유 모드 전용 */}
          {mainMode === 'occupation' && (
            <TouchableOpacity
              style={[styles.controlBtn, currentZoomLevel >= MAX_ZOOM_LEVEL && styles.controlBtnDisabled]}
              onPress={handleZoomIn}
              activeOpacity={0.7}
              disabled={currentZoomLevel >= MAX_ZOOM_LEVEL}
            >
              <Ionicons name="add" size={28} color={currentZoomLevel >= MAX_ZOOM_LEVEL ? '#555' : '#fff'} />
            </TouchableOpacity>
          )}

          {/* 축소 버튼 - 점유 모드 전용 */}
          {mainMode === 'occupation' && (
            <TouchableOpacity
              style={[styles.controlBtn, currentZoomLevel <= 0 && styles.controlBtnDisabled]}
              onPress={handleZoomOut}
              activeOpacity={0.7}
              disabled={currentZoomLevel <= 0}
            >
              <Ionicons name="remove" size={28} color={currentZoomLevel <= 0 ? '#555' : '#fff'} />
            </TouchableOpacity>
          )}

          {/* 리셋 버튼 */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>

          {canGoBack && (
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </SafeAreaView>

        {/* 일인칭 모드 가상 조이스틱 */}
        {mainMode === 'exploration' && subMode === 'firstPerson' && (
          <SafeAreaView style={styles.joystickContainer} edges={['bottom', 'left']} pointerEvents="box-none">
            <View style={styles.joystickPad}>
              <TouchableOpacity style={styles.joyBtnUp} onPressIn={() => handleMove('forward', true)} onPressOut={() => handleMove('forward', false)}>
                <Ionicons name="caret-up" size={32} color="#fff" />
              </TouchableOpacity>
              <View style={styles.joyRow}>
                <TouchableOpacity style={styles.joyBtnLeft} onPressIn={() => handleMove('left', true)} onPressOut={() => handleMove('left', false)}>
                  <Ionicons name="caret-back" size={32} color="#fff" />
                </TouchableOpacity>
                <View style={styles.joyCenter} />
                <TouchableOpacity style={styles.joyBtnRight} onPressIn={() => handleMove('right', true)} onPressOut={() => handleMove('right', false)}>
                  <Ionicons name="caret-forward" size={32} color="#fff" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.joyBtnDown} onPressIn={() => handleMove('backward', true)} onPressOut={() => handleMove('backward', false)}>
                <Ionicons name="caret-down" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}

        {/* 옵션 메뉴 오버레이 (Control Bar 옆에 표시) */}
        {showOptions && (
          <SafeAreaView style={[styles.rightControls, { right: 70, backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 12, padding: 10, alignItems: 'flex-start', width: 220, zIndex: 100 }]} edges={['right']} pointerEvents="auto">

            {/* 메뉴 타이틀 */}
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 15, marginLeft: 5 }}>설정 및 보기</Text>

            {/* AR 모드 메뉴는 점유 모드에서만 보이도록 처리 (선택) */}
            {mainMode === 'occupation' && (
              <>
                <TouchableOpacity style={styles.optionMenuItem} onPress={() => { setShowAR2Viewer(true); setShowOptions(false); }}>
                  <MaterialCommunityIcons name="compass-outline" size={20} color="#00f0ff" />
                  <Text style={[styles.optionMenuText, { color: '#00f0ff', fontWeight: 'bold' }]}>실제 달 찾기</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
              </>
            )}

            {/* 2. 필터 (광물/지역) - 점유 모드 전용 */}
            {mainMode === 'occupation' && (
              <>
                <TouchableOpacity style={styles.optionMenuItem} onPress={toggleFilterModal}>
                  <MaterialCommunityIcons name="layers" size={20} color="#fff" />
                  <Text style={styles.optionMenuText}>데이터 필터</Text>
                  <Ionicons name="chevron-forward" size={16} color="#888" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
                <View style={styles.divider} />
              </>
            )}

            {/* 3. 그리드 토글 - 점유 모드 전용 */}
            {mainMode === 'occupation' && (
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

        {/* 광물 범례 (활성 필터가 있을 때만 표시) */}
        {activeMineralFilter && mineralRanges[activeMineralFilter] && (
          <SafeAreaView style={styles.mapLegendContainer} edges={['right', 'bottom']} pointerEvents="none">
            <View style={styles.mapLegend}>
              <Text style={styles.mapLegendTitle}>
                {mineralRanges[activeMineralFilter].name}
              </Text>

              {/* 그라데이션 바 */}
              <View style={styles.mapGradientBar}>
                {/* 파란색에서 빨간색으로 그라데이션 */}
                {[...Array(20)].map((_, i) => {
                  const hue = 240 - (i / 19) * 240;
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        backgroundColor: `hsl(${hue}, 100%, 50%)`,
                      }}
                    />
                  );
                })}
              </View>

              {/* 최소/최대 값 레이블 */}
              <View style={styles.mapLegendLabels}>
                <Text style={styles.mapLegendValue}>
                  {mineralRanges[activeMineralFilter].min}
                </Text>
                <Text style={styles.mapLegendValue}>
                  {mineralRanges[activeMineralFilter].max}
                </Text>
              </View>

              {/* 단위 */}
              <Text style={styles.mapLegendUnit}>
                {mineralRanges[activeMineralFilter].unit}
              </Text>
            </View>
          </SafeAreaView>
        )}

        {/* 중력 이상 범례 (showGravityMap이 활성일 때만 표시) */}
        {mainMode === 'occupation' && showGravityMap && gravityGridMode && (
          <SafeAreaView style={styles.mapLegendContainer} edges={['right', 'bottom']} pointerEvents="none">
            <View style={styles.mapLegend}>
              <Text style={styles.mapLegendTitle}>
                중력 이상 (Gravity Anomaly)
              </Text>

              {/* Blue → White → Red 그라데이션 바 */}
              <View style={styles.mapGradientBar}>
                {[...Array(20)].map((_, i) => {
                  const t = i / 19; // 0 ~ 1
                  let r, g, b;
                  if (t < 0.5) {
                    // Blue → White (0 ~ 0.5)
                    const s = t / 0.5;
                    r = Math.round(255 * s);
                    g = Math.round(255 * s);
                    b = 255;
                  } else {
                    // White → Red (0.5 ~ 1)
                    const s = (t - 0.5) / 0.5;
                    r = 255;
                    g = Math.round(255 * (1 - s));
                    b = Math.round(255 * (1 - s));
                  }
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        backgroundColor: `rgb(${r},${g},${b})`,
                      }}
                    />
                  );
                })}
              </View>

              {/* min / 0 / max 레이블 */}
              <View style={[styles.mapLegendLabels, { justifyContent: 'space-between' }]}>
                <Text style={styles.mapLegendValue}>{gravityRange.min}</Text>
                <Text style={styles.mapLegendValue}>0</Text>
                <Text style={styles.mapLegendValue}>{gravityRange.max}</Text>
              </View>

              {/* 단위 */}
              <Text style={styles.mapLegendUnit}>mGal</Text>
            </View>
          </SafeAreaView>
        )}

        {/* 수소(중성자) 범례 */}
        {mainMode === 'occupation' && showNeutronMap && neutronGridMode && (
          <SafeAreaView style={styles.mapLegendContainer} edges={['right', 'bottom']} pointerEvents="none">
            <View style={styles.mapLegend}>
              <Text style={styles.mapLegendTitle}>
                수소 농도 (Neutron Count)
              </Text>

              {/* Blue → Gray 그라데이션 바 */}
              <View style={styles.mapGradientBar}>
                {[...Array(20)].map((_, i) => {
                  const t = i / 19;
                  const r = Math.round(30 + (180 - 30) * t);
                  const g = Math.round(100 + (180 - 100) * t);
                  const b = Math.round(255 + (180 - 255) * t);
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        backgroundColor: `rgb(${r},${g},${b})`,
                      }}
                    />
                  );
                })}
              </View>

              {/* min / max 레이블 */}
              <View style={styles.mapLegendLabels}>
                <Text style={styles.mapLegendValue}>{neutronRange.min}</Text>
                <Text style={styles.mapLegendValue}>{neutronRange.max}</Text>
              </View>

              <Text style={styles.mapLegendUnit}>Neutron Count (낮을수록 수소↑)</Text>
            </View>
          </SafeAreaView>
        )}

        {/* 온도 맵 범례 */}
        {mainMode === 'occupation' && showTempMap && (
          <SafeAreaView style={styles.mapLegendContainer} edges={['right', 'bottom']} pointerEvents="none">
            <View style={styles.mapLegend}>
              <Text style={styles.mapLegendTitle}>
                달 평균 온도
              </Text>

              {/* 그라데이션 바 */}
              <View style={styles.mapGradientBar}>
                {[...Array(20)].map((_, i) => {
                  const hue = 240 - (i / 19) * 240;
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        backgroundColor: `hsl(${hue}, 100%, 50%)`,
                      }}
                    />
                  );
                })}
              </View>

              {/* 최소/최대 값 레이블 */}
              <View style={styles.mapLegendLabels}>
                <Text style={styles.mapLegendValue}>-40</Text>
                <Text style={styles.mapLegendValue}>+40</Text>
              </View>

              {/* 단위 */}
              <Text style={styles.mapLegendUnit}>K (켈빈)</Text>
            </View>
          </SafeAreaView>
        )}

        {/* 격자 온도 범례 */}
        {mainMode === 'occupation' && showThermalGrid && (
          <SafeAreaView style={[styles.mapLegendContainer, { bottom: 180 }]} edges={['right']} pointerEvents="box-none">
            <View style={styles.mapLegend} pointerEvents="auto">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <Text style={styles.mapLegendTitle}>
                  {isDayTemp ? '주간 최고 (Day Max)' : '야간 최저 (Night Min)'}
                </Text>
              </View>

              {/* Day/Night Toggle (Pointer events enabled for this container) */}
              <View style={{ marginBottom: 8, alignItems: 'center' }} pointerEvents="box-none">
                <TouchableOpacity
                  onPress={toggleThermalMode}
                  style={{
                    flexDirection: 'row',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    borderRadius: 15,
                    padding: 2,
                    borderWidth: 1,
                    borderColor: '#555'
                  }}
                >
                  <View style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: isDayTemp ? '#FDB813' : 'transparent'
                  }}>
                    <Text style={{ color: isDayTemp ? '#000' : '#888', fontSize: 10, fontWeight: 'bold' }}>Day</Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: !isDayTemp ? '#3B82F6' : 'transparent'
                  }}>
                    <Text style={{ color: !isDayTemp ? '#fff' : '#888', fontSize: 10, fontWeight: 'bold' }}>Night</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* 그라데이션 바 */}
              <View style={styles.mapGradientBar}>
                {[...Array(20)].map((_, i) => {
                  const hue = 240 - (i / 19) * 240;
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        backgroundColor: `hsl(${hue}, 100%, 50%)`,
                      }}
                    />
                  );
                })}
              </View>

              {/* 최소/최대 값 레이블 */}
              <View style={styles.mapLegendLabels}>
                <Text style={styles.mapLegendValue}>{isDayTemp ? '200K' : '40K'}</Text>
                <Text style={styles.mapLegendValue}>{isDayTemp ? '390K' : '100K'}</Text>
              </View>

              {/* 단위 */}
              <Text style={styles.mapLegendUnit}>K (켈빈)</Text>
            </View>
          </SafeAreaView>
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

        {/* 탐사 모드 (Exploration) 전용 동적 상태정보창 — 상단 전체 너비 */}
        {mainMode === 'exploration' && (
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 }} edges={['top']} pointerEvents="box-none">
            <BlurView intensity={70} style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(10, 20, 40, 0.65)', borderBottomWidth: 1, borderBottomColor: 'rgba(59,130,246,0.4)', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              {subMode === 'space' && (
                <>
                  <Text style={{ color: '#60A5FA', fontSize: 12, fontWeight: 'bold' }}>🚀 우주 관측</Text>
                  {telemetry && (
                    <>
                      <Text style={{ color: '#aaa', fontSize: 11 }}>고도 {Number(telemetry.alt).toLocaleString()} m</Text>
                      <Text style={{ color: '#aaa', fontSize: 11 }}>{telemetry.lat}°, {telemetry.lon}°</Text>
                    </>
                  )}
                </>
              )}
              {subMode === 'firstPerson' && (
                <>
                  <Text style={{ color: '#34D399', fontSize: 12, fontWeight: 'bold' }}>🧑‍🚀 1인칭 탐사</Text>
                  {telemetry && (
                    <>
                      <Text style={{ color: '#aaa', fontSize: 11 }}>표면 고도 {Number(telemetry.alt).toLocaleString()} m</Text>
                      <Text style={{ color: '#aaa', fontSize: 11 }}>{telemetry.lat}°, {telemetry.lon}°</Text>
                      <Text style={{ color: '#aaa', fontSize: 11 }}>방위 {telemetry.heading}°</Text>
                    </>
                  )}
                </>
              )}
            </BlurView>
          </SafeAreaView>
        )}

        {/* 하단 셀 정보 카드 (캔버스 영역 내부 - 점유 모드 전용) */}
        {mainMode === 'occupation' && selectedCell && (
          <SafeAreaView style={styles.bottomCardContainer} edges={['bottom', 'left', 'right']}>
            <BlurView intensity={40} style={styles.bottomCard}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 18 }}>🌕</Text>
                  <View>
                    <Text style={styles.cardTitle}>{selectedCell.cellId}</Text>
                    {selectedCell.lat !== undefined && (
                      <Text style={styles.cardCoords}>{selectedCell.lat}° N · {selectedCell.lng}° E</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => { setSelectedCell(null); setCellExpanded(false); }}>
                  <Ionicons name="close" size={22} color="#888" />
                </TouchableOpacity>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Level</Text>
                  <Text style={styles.infoValue}>{selectedCell.level}</Text>
                </View>
                {selectedCell.area && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>면적 (추정)</Text>
                    <Text style={styles.infoValue}>{selectedCell.area}</Text>
                  </View>
                )}
                {selectedCell.unit && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>단위</Text>
                    <Text style={styles.infoValue}>{selectedCell.unit}</Text>
                  </View>
                )}
                {selectedCell.magTokens && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={[styles.infoLabel, { marginBottom: 4 }]}>포함 Mag 셀 (Lv.{selectedCell.childLevel || 16} × {selectedCell.magCount})</Text>
                    {selectedCell.magTokens.map((token: string, idx: number) => (
                      <Text key={idx} style={{ color: '#aaa', fontSize: 11, fontFamily: 'monospace', marginLeft: 8 }}>
                        Mag {idx + 1}  |  {token}  |  Lv.{selectedCell.childLevel || 16}
                      </Text>
                    ))}
                  </View>
                )}
              </View>

              {/* 상세정보 펼쳐보기 (15레벨 블록 선택 시) */}
              {selectedCell.level >= 15 && (
                <>
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={() => setCellExpanded(!cellExpanded)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={cellExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#FFD700"
                    />
                    <Text style={styles.expandButtonText}>
                      {cellExpanded ? '상세정보 접기' : '이 땅의 상세정보 펼쳐보기'}
                    </Text>
                    <Ionicons
                      name={cellExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#FFD700"
                    />
                  </TouchableOpacity>

                  {cellExpanded && selectedCell.minerals && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>광물 데이터</Text>
                      <View style={styles.mineralGrid}>
                        <View style={styles.mineralItem}>
                          <Text style={styles.mineralLabel}>FeO</Text>
                          <Text style={styles.mineralValue}>{selectedCell.minerals.feo}</Text>
                        </View>
                        <View style={styles.mineralItem}>
                          <Text style={styles.mineralLabel}>TiO₂</Text>
                          <Text style={styles.mineralValue}>{selectedCell.minerals.tio2}</Text>
                        </View>
                        <View style={styles.mineralItem}>
                          <Text style={styles.mineralLabel}>수소(물)</Text>
                          <Text style={styles.mineralValue}>{selectedCell.minerals.waterIce}</Text>
                        </View>
                        <View style={styles.mineralItem}>
                          <Text style={styles.mineralLabel}>표면온도</Text>
                          <Text style={styles.mineralValue}>{selectedCell.minerals.surfaceTemp}</Text>
                        </View>
                      </View>

                      {selectedCell.price && (
                        <View style={styles.priceSection}>
                          <Text style={styles.priceLabel}>예상 가치</Text>
                          <Text style={styles.priceValue}>{selectedCell.price}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* 구매하기 버튼 */}
                  <TouchableOpacity
                    style={styles.buyButton}
                    activeOpacity={0.8}
                    onPress={() => {
                      // TODO: 구매 플로우 연결
                      console.log('Purchase cell:', selectedCell.cellId);
                    }}
                  >
                    <Text style={styles.buyButtonText}>🚀 구매하기</Text>
                  </TouchableOpacity>
                </>
              )}
            </BlurView>
          </SafeAreaView>
        )}
      </View>

      {/* 로딩 */}
      {
        (loading || isLoadingSatellite) && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              {isLoadingSatellite ? '탐사선 궤도 데이터를 불러오는 중...' : '달 지도 로딩 중...'}
            </Text>
          </View>
        )
      }

      {/* AR 탐사선 뷰어 (삭제됨) */}

      {/* AR 실제 달 찾기 뷰어 */}
      {
        showAR2Viewer && (
          <AR2MoonViewer onClose={() => setShowAR2Viewer(false)} />
        )
      }

      {/* 부가기능 패널 */}
      <Modal
        visible={showFeaturePanel}
        transparent={true}
        animationType="slide"
        onRequestClose={() => { setShowFeaturePanel(false); setFeatureListView('none'); }}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { setShowFeaturePanel(false); setFeatureListView('none'); }} />
          <SafeAreaView style={{ backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' }} edges={['bottom']}>
            {/* 헤더 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#4B5563', borderRadius: 2, position: 'absolute', top: 10, alignSelf: 'center', left: '50%', marginLeft: -20 }} />
              <Text style={{ color: '#F9FAFB', fontSize: 18, fontWeight: '700', flex: 1, marginTop: 8 }}>
                {featureListView === 'none' ? '🛠 부가기능' : featureListView === 'landing' ? '🚀 주요 착륙지' : featureListView === 'terrain' ? '🌍 유명 지형' : '🛰️ 위성 궤도'}
              </Text>
              {featureListView !== 'none' ? (
                <TouchableOpacity onPress={() => setFeatureListView('none')} style={{ padding: 4 }}>
                  <Ionicons name="arrow-back" size={22} color="#60A5FA" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => { setShowFeaturePanel(false); setFeatureListView('none'); }}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 16 }}>
              {/* === 토글 뷰 === */}
              {featureListView === 'none' && (
                <View style={{ gap: 12, paddingVertical: 16 }}>
                  {/* 주요 착륙지 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#60A5FA', fontSize: 15, fontWeight: '700' }}>🚀 주요 착륙지</Text>
                      <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>Apollo 착륙지 3D 모델</Text>
                    </View>
                    <TouchableOpacity onPress={() => setFeatureListView('landing')} style={{ marginRight: 12, padding: 6 }}>
                      <Ionicons name="list" size={20} color="#60A5FA" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const next = !showLandingSites;
                        setShowLandingSites(next);
                        webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_LANDING_SITES', enabled: next }));
                      }}
                      style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: showLandingSites ? '#3B82F6' : '#374151', justifyContent: 'center', paddingHorizontal: 3 }}
                    >
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: showLandingSites ? 'flex-end' : 'flex-start' }} />
                    </TouchableOpacity>
                  </View>

                  {/* 유명 지형 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#A3A3A3', fontSize: 15, fontWeight: '700' }}>🌍 유명 지형</Text>
                      <Text style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>크레이터 · 바다 · 착륙지 깃발</Text>
                    </View>
                    <TouchableOpacity onPress={() => setFeatureListView('terrain')} style={{ marginRight: 12, padding: 6 }}>
                      <Ionicons name="list" size={20} color="#A3A3A3" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const next = !showTerrain;
                        setShowTerrain(next);
                        webviewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_TERRAIN', enabled: next }));
                      }}
                      style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: showTerrain ? '#3B82F6' : '#374151', justifyContent: 'center', paddingHorizontal: 3 }}
                    >
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: showTerrain ? 'flex-end' : 'flex-start' }} />
                    </TouchableOpacity>
                  </View>

                  {/* 위성 궤도 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(252,211,77,0.06)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(252,211,77,0.15)' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FCD34D', fontSize: 15, fontWeight: '700' }}>🛰️ 위성 궤도</Text>
                      <Text style={{ color: '#92820C', fontSize: 11, marginTop: 2 }}>달 궤도 인공위성 {satelliteData.length > 0 ? `${satelliteData.length}기` : ''}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setFeatureListView('satellite')} style={{ marginRight: 12, padding: 6 }}>
                      <Ionicons name="list" size={20} color="#FCD34D" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const next = !showSatellites;
                        setShowSatellites(next);
                        webviewRef.current?.postMessage(JSON.stringify({ type: 'UPDATE_MODE', payload: { mainMode: 'exploration', subMode: next ? 'satellite' : subMode } }));
                      }}
                      style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: showSatellites ? '#3B82F6' : '#374151', justifyContent: 'center', paddingHorizontal: 3 }}
                    >
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: showSatellites ? 'flex-end' : 'flex-start' }} />
                    </TouchableOpacity>
                  </View>

                </View>
              )}

              {/* === 착륙지 리스트 === */}
              {featureListView === 'landing' && (
                <View style={{ paddingVertical: 12 }}>
                  {(landmarkListData?.apollo || []).map((site: any) => (
                    <TouchableOpacity
                      key={site.id}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)' }}
                      onPress={() => {
                        setShowFeaturePanel(false);
                        setFeatureListView('none');
                        webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: site.lat, lng: site.lng } }));
                        setSelectedLandmark(site);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#F9FAFB', fontSize: 15, fontWeight: '600' }}>{site.name}</Text>
                        <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2 }}>{site.date} · {site.crew}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#60A5FA" />
                    </TouchableOpacity>
                  ))}
                  {(!landmarkListData?.apollo || landmarkListData.apollo.length === 0) && (
                    <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>착륙지 토글을 ON하면 목록이 표시됩니다</Text>
                  )}
                </View>
              )}

              {/* === 지형 리스트 === */}
              {featureListView === 'terrain' && (
                <View style={{ paddingVertical: 12 }}>
                  {(landmarkListData?.landmarks || []).map((site: any) => (
                    <TouchableOpacity
                      key={site.id}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                      onPress={() => {
                        setShowFeaturePanel(false);
                        setFeatureListView('none');
                        webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: site.lat, lng: site.lng } }));
                        setSelectedLandmark(site);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#F9FAFB', fontSize: 15, fontWeight: '600' }}>{site.name}</Text>
                        <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{site.desc}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#6B7280" />
                    </TouchableOpacity>
                  ))}
                  {(!landmarkListData?.landmarks || landmarkListData.landmarks.length === 0) && (
                    <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>지형 토글을 ON하면 목록이 표시됩니다</Text>
                  )}
                </View>
              )}

              {/* === 위성 리스트 === */}
              {featureListView === 'satellite' && (
                <View style={{ paddingVertical: 12 }}>
                  {isLoadingSatellite && (
                    <Text style={{ color: '#FCD34D', fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>위성 데이터 로딩 중...</Text>
                  )}
                  {satelliteData.map((sat: any, idx: number) => (
                    <TouchableOpacity
                      key={sat.id || idx}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(252,211,77,0.06)', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(252,211,77,0.15)' }}
                      onPress={() => {
                        setShowFeaturePanel(false);
                        setFeatureListView('none');
                        setSelectedSatellite(sat);
                        if (sat.position) {
                          webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LOCATION', payload: { lat: sat.position.lat || sat.lat, lng: sat.position.lng || sat.lng } }));
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FCD34D', fontSize: 15, fontWeight: '600' }}>{sat.name}</Text>
                        <Text style={{ color: '#92820C', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{sat.description || sat.agency || ''}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#FCD34D" />
                    </TouchableOpacity>
                  ))}
                  {!isLoadingSatellite && satelliteData.length === 0 && (
                    <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>위성 토글을 ON하면 데이터가 로드됩니다</Text>
                  )}
                </View>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* 랜드마크 정보 모달 */}
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

      {/* AI 추천 모달 (모던 풀스크린 UI) */}
      <Modal
        visible={showAIModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseAIModal}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }} edges={['top', 'bottom', 'left', 'right']}>
          {aiStep < 99 ? (
            <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 40, paddingBottom: 60, justifyContent: 'space-between' }}>
              <View>
                <TouchableOpacity onPress={handleCloseAIModal} style={{ alignSelf: 'flex-start', marginBottom: 30, padding: 8, marginLeft: -8 }}>
                  <Ionicons name="close" size={32} color="#9CA3AF" />
                </TouchableOpacity>
                <Text style={{ color: '#3B82F6', fontSize: 15, fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 }}>
                  AI 개척지 추천 · {aiStep + 1}/{aiQuestions.length}
                </Text>
                <Text style={{ color: '#F9FAFB', fontSize: 26, fontWeight: '800', lineHeight: 38, marginBottom: 40 }}>
                  {aiQuestions[aiStep].title}
                </Text>

                <View style={{ gap: 16 }}>
                  {aiQuestions[aiStep].options.map((option, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        paddingVertical: 20,
                        paddingHorizontal: 24,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onPress={() => handleAIAnswer(option)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: '#F3F4F6', fontSize: 17, fontWeight: '600' }}>{option}</Text>
                      <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
              <Ionicons name="planet" size={80} color="#3B82F6" style={{ marginBottom: 40 }} />
              <ActivityIndicator size="large" color="#60A5FA" style={{ marginBottom: 24 }} />
              <Text style={{ color: '#F9FAFB', fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
                최적의 개척지를 찾는 중...
              </Text>
              <Text style={{ color: '#9CA3AF', fontSize: 16, textAlign: 'center', lineHeight: 26 }}>
                요청하신 조건을 바탕으로 달의 지형, 온도,{'\n'}자원 데이터를 실시간 분석하고 있습니다.
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

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
    top: '50%',
    transform: [{ translateY: -120 }],
    gap: 12,
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
});
