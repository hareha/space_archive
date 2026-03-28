// cesiumInit.js — Cesium 뷰어 초기화 + 상태 변수 모듈
// S2 import, Cesium 토큰, Viewer 생성, 타일셋 로드, 좌표 변환 함수, sendToRN 등

export const CESIUM_INIT = `
    // --- S2 IMPORT ---
    import { s2 } from 'https://esm.sh/s2js';
    window.s2 = s2;

    // --- CESIUM TOKEN ---
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3MjNhYjIzZi0wMWU5LTQzOTEtODY3Ni1kY2JkNTEyMmE2NTgiLCJpZCI6Mzc2MDQ4LCJpYXQiOjE3Njc4MzYyNTR9.K6HpEEiCNNlC8AzsTe3zuuGtcg9AJKEAnt8mA2MIoMg';

    // ═══ 글로벌 메시지 큐 ═══
    // initMoon()이 완료되기 전에 도착하는 postMessage를 버퍼링
    window._messageQueue = [];
    window._initComplete = false;
    function _earlyMessageHandler(event) {
        if (window._initComplete) return; // 이미 초기화 완료됨
        try {
            var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data && data.type) {
                console.log('[Queue] Buffered early message:', data.type);
                window._messageQueue.push(event.data);
            }
        } catch(e) {}
    }
    document.addEventListener('message', _earlyMessageHandler);
    window.addEventListener('message', _earlyMessageHandler);

    async function initMoon() {
      const moonEllipsoid = Cesium.Ellipsoid.MOON;
      const moonRadius = moonEllipsoid.maximumRadius;

      // --- Temperature Map Globals (Hoisted) ---
      let tempMapPrimitive = null;
      let tempMapImageData = null;
      let showTempMap = false;

      let thermalGridPrimitive = null;
      let showThermalGrid = false;
      let thermalGridDataLoaded = false;
      let thermalGridCsvContent = null;
      let thermalGridParsed = []; // 파싱된 환경 데이터 (1도)
      let isDayTempMode = true;

      // --- Gravity Anomaly Map ---
      let gravityPrimitive = null;
      let showGravityMap = false;
      let gravityDataLoaded = false;
      let gravityCsvContent = null;
      let gravityParsed = []; // 파싱된 중력 데이터 (1도)
      let gravityGridMode = false;

      // --- Neutron (Hydrogen) Map ---
      let neutronPrimitive = null;
      let showNeutronMap = false;
      let neutronDataLoaded = false;
      let neutronCsvContent = null;
      let neutronParsed = []; // 파싱된 중성자 데이터 (1도)
      let neutronGridMode = false;
      let highlightedEnvCell = null; // 환경 하이라이트 셀
      let envHighlightEntity = null; // 환경 셀 하이라이트 Entity (별도)

      const viewer = new Cesium.Viewer('cesiumContainer', {
        globe: new Cesium.Globe(moonEllipsoid),
        baseLayer: false,
        skyAtmosphere: false,
        geocoder: false,
        timeline: false,
        animation: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        homeButton: false,
        infoBox: false,
        selectionIndicator: false,
        fullscreenButton: false,
        creditContainer: document.createElement('div'),
        scene3DOnly: true,
        contextOptions: {
            webgl: {
                alpha: false,
                antialias: true
            }
        }
      });
      
      // 해상도 스케일 (네이티브 레티나 해상도, 성능 문제 시 2.0으로 낮추기)
      try { viewer.resolutionScale = window.devicePixelRatio || 1; } catch(e) {}
      window.viewer = viewer; // 외부 스크립트(injectedJavaScript)에서 접근 가능하도록 노출
      
      viewer.scene.screenSpaceCameraController.maximumMovementRatio = 15.0;
      // 카메라 틸트(상하 회전) 잠금 — 모든 모드에서 적용
      viewer.scene.screenSpaceCameraController.enableTilt = true;
      viewer.scene.globe.show = false;

      let moonTileset;
      window.tilesetReady = false;
      try {
        const resource = await Cesium.IonResource.fromAssetId(2684829);
        moonTileset = await Cesium.Cesium3DTileset.fromUrl(resource);
        viewer.scene.primitives.add(moonTileset);
        window.tilesetReady = true;
        window.moonTileset = moonTileset; // 타일 로드 이벤트 감지용
        console.log('[Init] Moon tileset loaded, tilesetReady = true');
        var bs = moonTileset.boundingSphere;
        console.log('[Init] tileset boundingSphere center:', bs.center.x.toFixed(0), bs.center.y.toFixed(0), bs.center.z.toFixed(0), 'radius:', bs.radius.toFixed(0));
        console.log('[Init] MOON ellipsoid radius:', Cesium.Ellipsoid.MOON.maximumRadius);
        if (showTempMap) moonTileset.show = false;
        viewer.camera.flyToBoundingSphere(moonTileset.boundingSphere, { duration: 0 });

        // ─── 조명 설정 ───
        viewer.scene.highDynamicRange = false;
        viewer.scene.backgroundColor = Cesium.Color.BLACK;
        viewer.shadows = false;
        // 기본 Cesium 별 SkyBox 유지 (이음새 없음)

        // ─── 태양계 천체 (달에서 본 실제 각크기) ───
        // 모든 천체를 D=5억m 거리에 배치, sizeInMeters로 실제 각크기 재현
        // 각크기 = 실제지름 / 실제거리 (rad), 빌보드 크기 = D * 각크기
        var D = 5e8; // 배치 거리 (500,000km)

        // 🌍 지구 — 각크기 1.9° (달에서 본 크기, 지구에서 본 달의 ~3.7배)
        // 실제: 지름 12,742km / 거리 384,400km = 0.0332 rad
        var earthAngular = 12742 / 384400; // 0.0332 rad ≈ 1.9°
        var earthSize = D * earthAngular; // ~16,600,000m
        var earthPos = new Cesium.Cartesian3(D * 0.8, D * 0.3, D * 0.15);
        viewer.entities.add({
            position: earthPos,
            billboard: {
                image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Earth_Western_Hemisphere_transparent_background.png/240px-Earth_Western_Hemisphere_transparent_background.png',
                width: earthSize,
                height: earthSize,
                sizeInMeters: true
            },
            label: {
                text: 'Earth',
                font: '11px sans-serif',
                fillColor: Cesium.Color.fromCssColorString('#6CB4EE'),
                pixelOffset: new Cesium.Cartesian2(0, 40),
                showBackground: false,
                style: Cesium.LabelStyle.FILL
            }
        });

        // ☀️ 태양 — 각크기 0.53° (지구에서나 달에서나 거의 동일)
        // 실제: 지름 1,392,700km / 거리 150,000,000km = 0.00929 rad
        var sunAngular = 1392700 / 150000000; // 0.00929 rad ≈ 0.53°
        var sunSize = D * sunAngular; // ~4,644,000m
        var sunPos = new Cesium.Cartesian3(-D * 1.2, D * 0.6, D * 0.25);

        // 태양 이미지를 Canvas로 생성 (글로우 효과 포함)
        var sunCanvas = document.createElement('canvas');
        sunCanvas.width = 128;
        sunCanvas.height = 128;
        var ctx = sunCanvas.getContext('2d');
        // 외곽 글로우
        var grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,255,240,1)');
        grad.addColorStop(0.15, 'rgba(255,250,200,1)');
        grad.addColorStop(0.3, 'rgba(255,230,120,0.6)');
        grad.addColorStop(0.6, 'rgba(255,200,50,0.1)');
        grad.addColorStop(1, 'rgba(255,180,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        var sunDataUrl = sunCanvas.toDataURL();

        // 태양 코어 (sizeInMeters 빌보드)
        viewer.entities.add({
            position: sunPos,
            billboard: {
                image: sunDataUrl,
                width: sunSize * 3, // 글로우 포함 3배
                height: sunSize * 3,
                sizeInMeters: true
            },
            label: {
                text: 'Sun',
                font: '10px sans-serif',
                fillColor: new Cesium.Color(1.0, 0.95, 0.6, 1.0),
                pixelOffset: new Cesium.Cartesian2(0, 28),
                showBackground: false,
                style: Cesium.LabelStyle.FILL
            }
        });

        // 🪐 금성 (Venus) — 최대 각크기 ~1 arcmin = 0.017°
        // 맨눈으로 가장 밝은 행성, 매우 작은 점
        var planetPoints = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
        var venusPos = new Cesium.Cartesian3(-D * 0.9, D * 0.7, -D * 0.4);
        planetPoints.add({
            position: venusPos,
            pixelSize: 3,
            color: new Cesium.Color(1.0, 1.0, 0.92, 1.0)
        });
        viewer.entities.add({
            position: venusPos,
            label: {
                text: 'Venus',
                font: '9px sans-serif',
                fillColor: new Cesium.Color(1.0, 1.0, 0.85, 0.7),
                pixelOffset: new Cesium.Cartesian2(0, 10),
                showBackground: false,
                style: Cesium.LabelStyle.FILL
            }
        });

        // 🔴 화성 (Mars) — 최대 각크기 ~25 arcsec = 0.007°
        // 약간 붉은빛을 띄는 작은 점
        var marsPos = new Cesium.Cartesian3(D * 0.4, -D * 0.9, D * 0.5);
        planetPoints.add({
            position: marsPos,
            pixelSize: 2,
            color: new Cesium.Color(1.0, 0.55, 0.35, 1.0)
        });
        viewer.entities.add({
            position: marsPos,
            label: {
                text: 'Mars',
                font: '9px sans-serif',
                fillColor: new Cesium.Color(1.0, 0.55, 0.35, 0.7),
                pixelOffset: new Cesium.Cartesian2(0, 10),
                showBackground: false,
                style: Cesium.LabelStyle.FILL
            }
        });

        // ─── 배경 별 필드 ───
        var starField = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
        for (var si = 0; si < 500; si++) {
            var sTheta = Math.random() * 2 * Math.PI;
            var sPhi = Math.acos(2 * Math.random() - 1);
            var sDist = 3e8 + Math.random() * 5e8;
            var sx = sDist * Math.sin(sPhi) * Math.cos(sTheta);
            var sy = sDist * Math.sin(sPhi) * Math.sin(sTheta);
            var sz = sDist * Math.cos(sPhi);
            var sRand = Math.random();
            var sSize = sRand < 0.7 ? 0.5 + Math.random() * 0.8 :
                        sRand < 0.9 ? 1.2 + Math.random() * 0.8 :
                                      2.0 + Math.random() * 1.0;
            var cRand = Math.random();
            var sR, sG, sB;
            if (cRand < 0.5) { sR = 0.85 + Math.random() * 0.15; sG = 0.88 + Math.random() * 0.12; sB = 0.95 + Math.random() * 0.05; }
            else if (cRand < 0.75) { sR = 0.95 + Math.random() * 0.05; sG = 0.85 + Math.random() * 0.1; sB = 0.6 + Math.random() * 0.2; }
            else if (cRand < 0.9) { sR = 0.7 + Math.random() * 0.15; sG = 0.8 + Math.random() * 0.15; sB = 0.95 + Math.random() * 0.05; }
            else { sR = 0.95 + Math.random() * 0.05; sG = 0.6 + Math.random() * 0.2; sB = 0.4 + Math.random() * 0.2; }
            var sBright = 0.4 + Math.random() * 0.6;
            starField.add({
                position: new Cesium.Cartesian3(sx, sy, sz),
                pixelSize: sSize,
                color: new Cesium.Color(sR * sBright, sG * sBright, sB * sBright, 1.0)
            });
        }


        
        // Hide Loading Overlay (fade out)
        const loader = document.getElementById('loadingOverlay');
        if(loader) {
            loader.classList.add('fade-out');
            setTimeout(function() { loader.style.display = 'none'; }, 900);
        }

        // ─── 기본이 탐사모드이므로 점유모드 전용 UI 숨김 ───

      } catch (error) {
        console.error('Moon tileset 로드 실패:', error);
        const loader2 = document.getElementById('loadingOverlay');
        if(loader2) { loader2.classList.add('fade-out'); setTimeout(function() { loader2.style.display = 'none'; }, 900); }
        return;
      }

      // --- STATE & UTILS (selectionStack 기반) ---
      let selectionStack = [];
      let currentAnimFrame = null;
      let showGrid = true;
      let mainMode = 'exploration';
      let subMode = 'space';
      let firstPersonData = {
          handler: null,
      };

      const gridPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      const pillarPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      const parentPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      const flashPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      const selectionPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      const satellitePrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      const FIXED_HEIGHT = 10000;
      let lastRenderedDepth = 0;

      // --- Mineral Data ---
      let mineralDataArray = [];
      let mineralDataMap = new Map();
      let activeMineralFilter = null;
      let mineralOpacity = 0.5;
      let geologicPrimitive = null;
      let mineralStats = { min: 0, max: 1 };
      
      // 5단계 고정 줌 레벨 (RN 줌 버튼 연동용)
      const ZOOM_LEVELS = [
        { height: 6105648, s2Level: null, label: 'Global' },
        { height: 1500000, s2Level: 4,    label: 'S2 Level 4' },
        { height: 100000,  s2Level: 8,    label: 'S2 Level 8' },
        { height: 6000,    s2Level: 12,   label: 'S2 Level 12' },
        { height: 2400,     s2Level: 16,   label: 'S2 Level 16' },
      ];
      let currentZoomLevel = 0;

      // _getCamHPR: 현재 카메라의 heading/pitch/range를 계산하여 반환
      // changeZoomLevel (cesiumControls.js)에서 사용
      window._getCamHPR = function() {
        var cam = viewer.camera;
        var pos = cam.positionWC;
        var range = Cesium.Cartesian3.magnitude(pos);
        return {
          heading: cam.heading,
          pitch: cam.pitch,
          range: range
        };
      };

      // =====================================================
      // 좌표 변환 헬퍼 함수 (직접 스케일링 기반 통일)
      // =====================================================
      
      // S2 Point/Vertex (단위 구 좌표) → Cesium Cartesian3
      function s2PointToCesium(s2Point, altitude) {
        const mag = Math.sqrt(s2Point.x * s2Point.x + s2Point.y * s2Point.y + s2Point.z * s2Point.z);
        const nx = s2Point.x / mag;
        const ny = s2Point.y / mag;
        const nz = s2Point.z / mag;
        
        const radius = Cesium.Ellipsoid.MOON.maximumRadius + (altitude || 0);
        
        return new Cesium.Cartesian3(
          nx * radius,
          ny * radius,
          nz * radius
        );
      }
      
      // Cesium Cartesian3 → S2 Point (Cartographic 경유, 지형 높이 무시)
      function cesiumToS2Point(cartesian) {
        if (!cartesian) return null;
        
        // Cartesian3 → Cartographic (MOON 타원체 기준 위경도 추출)
        const carto = Cesium.Cartographic.fromCartesian(cartesian, Cesium.Ellipsoid.MOON);
        if (!carto) return null;
        
        const lon = carto.longitude; // radians
        const lat = carto.latitude;  // radians
        
        // 위경도 → 단위 구 좌표 (S2 Point)
        const cosLat = Math.cos(lat);
        const x = cosLat * Math.cos(lon);
        const y = cosLat * Math.sin(lon);
        const z = Math.sin(lat);
        
        return new s2.Point(x, y, z);
      }

      // --- RN Communication Helpers ---
      function sendToRN(type, payload) {
          if(window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
          }
      }

      // Listen for messages from RN
      document.addEventListener('message', function(event) {
         handleRNMessage(event.data);
      });
      window.addEventListener('message', function(event) {
         handleRNMessage(event.data);
      });

      function updateUI() {
        const lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
        const currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;
        sendToRN('STATE_UPDATE', { 
            level: currentLevel, 
            historyLength: selectionStack.length,
            selectedCellId: lastCellId ? s2.cellid.toToken(lastCellId) : null
        });
        sendToRN('DEPTH_CHANGED', { canGoBack: selectionStack.length > 0, depth: selectionStack.length });
        sendToRN('ZOOM_LEVEL_CHANGED', {
            currentLevel: currentZoomLevel,
            maxLevel: ZOOM_LEVELS.length - 1,
            minLevel: 0
        });
      }

      function resetExplorer() {
        if (currentAnimFrame) { cancelAnimationFrame(currentAnimFrame); currentAnimFrame = null; }
        // TR(테스트2모드) 전용 리소스 정리
        if (typeof _spreadAnimFrame !== 'undefined' && _spreadAnimFrame) { cancelAnimationFrame(_spreadAnimFrame); _spreadAnimFrame = null; }
        if (typeof stopCameraTracking === 'function') stopCameraTracking();
        if (typeof _isFlyingTo !== 'undefined') _isFlyingTo = false;
        selectionStack = [];
        currentZoomLevel = 0;
        lastRenderedDepth = 0;
        parentPrimitives.removeAll();
        pillarPrimitives.removeAll();
        selectionPrimitives.removeAll();
        window.selectionPrimMap = {};
        window.multiSelectedL16 = [];
        // PL primitive도 정리
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.removeAll();
        // TR primitive도 정리
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.removeAll();
        if (mainMode === 'test2') {
            renderTerrain();
        } else if (mainMode === 'test1') {
            renderPolyline();
        } else {
            render();
        }
        updateUI();
        sendToRN('CELL_DESELECTED', {});
        // lookAt 해제 (테스트2모드에서 필요)
        try { viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); } catch(e) {}
        // 진행 중인 카메라 비행 중단 후 초기 뷰로 이동
        viewer.camera.cancelFlight();
        if(moonTileset) viewer.camera.flyToBoundingSphere(moonTileset.boundingSphere, { duration: 1.0 });
      }

      function resetAndFlyTo(lat, lng) {
        console.log('[Init] resetAndFlyTo called:', lat, lng);
        // 1. 애니메이션 프레임 정리
        if (currentAnimFrame) { cancelAnimationFrame(currentAnimFrame); currentAnimFrame = null; }
        // TR(테스트2모드) 전용 리소스 정리
        if (typeof _spreadAnimFrame !== 'undefined' && _spreadAnimFrame) { cancelAnimationFrame(_spreadAnimFrame); _spreadAnimFrame = null; }
        if (typeof stopCameraTracking === 'function') stopCameraTracking();
        if (typeof _isFlyingTo !== 'undefined') _isFlyingTo = false;
        // 2. 상태 초기화
        selectionStack = [];
        currentZoomLevel = 0;
        lastRenderedDepth = 0;
        // 3. 프리미티브 정리
        parentPrimitives.removeAll();
        pillarPrimitives.removeAll();
        selectionPrimitives.removeAll();
        window.selectionPrimMap = {};
        window.multiSelectedL16 = [];
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.removeAll();
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.removeAll();
        // 4. 모드별 그리드 재렌더
        if (mainMode === 'test2') {
            renderTerrain();
        } else if (mainMode === 'test1') {
            renderPolyline();
        } else {
            render();
        }
        updateUI();
        sendToRN('CELL_DESELECTED', {});
        // 5. lookAt 해제 (테스트2모드에서 필요)
        try { viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); } catch(e) {}
        // 6. 진행 중인 카메라 비행 중단
        viewer.camera.cancelFlight();
        // 7. 지정 위치로 이동 (flyToBoundingSphere 없이 바로)
        var _mr = Cesium.Ellipsoid.MOON.maximumRadius;
        var dest = Cesium.Cartesian3.fromRadians(
            Cesium.Math.toRadians(lng),
            Cesium.Math.toRadians(lat),
            _mr + 50000,
            Cesium.Ellipsoid.MOON
        );
        viewer.camera.flyTo({
            destination: dest,
            orientation: {
                heading: 0,
                pitch: Cesium.Math.toRadians(-60),
                roll: 0
            },
            duration: 2.0
        });
        console.log('[Init] resetAndFlyTo flyTo started to:', lat, lng);
      }

      function goBack() {
        if (selectionStack.length === 0) return;
        window.multiSelectedL16 = [];
        // 셀 선택 하이라이트 정리
        if (typeof selectionPrimitives !== 'undefined' && selectionPrimitives) {
            selectionPrimitives.removeAll();
        }
        window.selectionPrimMap = {};
        var wasBlockLevel = s2.cellid.level(selectionStack[selectionStack.length - 1]) >= 15;
        selectionStack.pop();
        lastRenderedDepth = 0;
        parentPrimitives.removeAll();

        if (selectionStack.length > 0) {
          // 아직 뎁스가 남아있으면 해당 모드별 렌더링
          if (mainMode === 'test2') {
              renderTerrain();
          } else if (mainMode === 'test1') {
              renderPolyline();
          } else {
              render();
          }
          updateUI();
          if (wasBlockLevel) {
              sendToRN('CELL_DESELECTED', {});
          }
          if (mainMode === 'test2') {
              flyToCellTR(selectionStack[selectionStack.length - 1], function() {
                  renderDynamicGrid();
                  startCameraTracking();
              });
          } else if (mainMode === 'test1') {
              flyToCellPL(selectionStack[selectionStack.length - 1]);
          } else {
              flyToCell(selectionStack[selectionStack.length - 1]);
          }
        } else {
          // 스택이 완전히 비었 → 초기화면으로 복귀
          // terrain/polyline 애니메이션 정리
          if (currentAnimFrame) { cancelAnimationFrame(currentAnimFrame); currentAnimFrame = null; }
          // 모드별 그리드로 초기화
          if (mainMode === 'test2') {
              renderTerrain();
          } else if (mainMode === 'test1') {
              renderPolyline();
          } else {
              render();
          }
          updateUI();
          sendToRN('CELL_DESELECTED', {});
          // lookAt 해제 후 현재 방향 유지하면서 줌아웃
          try { viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); } catch(e) {}
          viewer.camera.cancelFlight();
          if (moonTileset) viewer.camera.flyToBoundingSphere(moonTileset.boundingSphere, { duration: 1.0 });
        }
      }
`;
