import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, ScrollView, Switch, TextInput } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams } from 'expo-router';
import { CESIUM_HTML } from '@/constants/CesiumHtml';
import { loadMineralData } from '@/utils/mineralDataLoader';

export default function MoonScreen() {
  const webviewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<any>(null);

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
      console.log('Message from WebView:', message);

      switch (message.type) {
        case 'CELL_SELECTED':
          setSelectedCell(message.payload);
          break;
        case 'DEPTH_CHANGED':
          setCanGoBack(message.payload.canGoBack);
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
    webviewRef.current?.postMessage(JSON.stringify({ type: 'ZOOM_IN' }));
  };

  const handleZoomOut = () => {
    webviewRef.current?.postMessage(JSON.stringify({ type: 'ZOOM_OUT' }));
  };

  const handleReset = () => {
    webviewRef.current?.postMessage(JSON.stringify({ type: 'RESET_VIEW' }));
  };

  const handleBack = () => {
    webviewRef.current?.postMessage(JSON.stringify({ type: 'GO_BACK' }));
  };

  const toggleFilterModal = () => {
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* 상단 검색 영역 (고정) */}
      <SafeAreaView style={styles.topSearchSection} edges={['top', 'left', 'right']}>
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
      </SafeAreaView>

      {/* 캔버스 영역 (Flex) */}
      <View style={styles.canvasSection}>
        {/* Cesium WebView */}
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: CESIUM_HTML, baseUrl: 'https://moon.com' }}
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
          {/* 필터 토글 버튼 */}
          <TouchableOpacity
            style={[styles.controlBtn, showFilterModal && styles.controlBtnActive]}
            onPress={toggleFilterModal}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="layers" size={24} color="#fff" />
          </TouchableOpacity>

          {/* 그리드 토글 버튼 */}
          <TouchableOpacity
            style={[styles.controlBtn, showGrid && styles.controlBtnActive]}
            onPress={toggleGrid}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name={showGrid ? "grid" : "grid-off"} size={24} color="#fff" />
          </TouchableOpacity>

          {/* 확대 버튼 */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleZoomIn}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>

          {/* 축소 버튼 */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleZoomOut}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={28} color="#fff" />
          </TouchableOpacity>

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

        {/* 하단 셀 정보 카드 (캔버스 영역 내부) */}
        {selectedCell && (
          <SafeAreaView style={styles.bottomCardContainer} edges={['bottom', 'left', 'right']}>
            <BlurView intensity={30} style={styles.bottomCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>선택된 셀 정보</Text>
                <TouchableOpacity onPress={() => setSelectedCell(null)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Cell ID:</Text>
                  <Text style={styles.infoValue}>{selectedCell.cellId}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Level:</Text>
                  <Text style={styles.infoValue}>{selectedCell.level}</Text>
                </View>
                {selectedCell.face !== undefined && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Face:</Text>
                    <Text style={styles.infoValue}>{selectedCell.face}</Text>
                  </View>
                )}
              </View>
            </BlurView>
          </SafeAreaView>
        )}
      </View>

      {/* 로딩 */}
      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>달 지도 로딩 중...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // 상단 검색 영역
  topSearchSection: {
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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

  // 우측 컨트롤
  rightControls: {
    position: 'absolute',
    right: 16,
    top: 16,
    gap: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(20, 20, 20, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderColor: '#3B82F6',
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
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
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
