// cesiumInit.js — Cesium 뷰어 초기화 + 상태 변수 모듈
// S2 import, Cesium 토큰, Viewer 생성, 타일셋 로드, 좌표 변환 함수, sendToRN 등

export const CESIUM_INIT = `
    // --- S2 IMPORT ---
    import { s2 } from 'https://esm.sh/s2js';
    window.s2 = s2;

    // --- CESIUM TOKEN ---
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3MjNhYjIzZi0wMWU5LTQzOTEtODY3Ni1kY2JkNTEyMmE2NTgiLCJpZCI6Mzc2MDQ4LCJpYXQiOjE3Njc4MzYyNTR9.K6HpEEiCNNlC8AzsTe3zuuGtcg9AJKEAnt8mA2MIoMg';

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
      let isDayTempMode = true;

      // --- Gravity Anomaly Map ---
      let gravityPrimitive = null;
      let showGravityMap = false;
      let gravityDataLoaded = false;
      let gravityCsvContent = null;
      let gravityGridMode = false;

      // --- Neutron (Hydrogen) Map ---
      let neutronPrimitive = null;
      let showNeutronMap = false;
      let neutronDataLoaded = false;
      let neutronCsvContent = null;
      let neutronGridMode = false;

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
            webgl: { alpha: false }
        }
      });
      
      viewer.scene.screenSpaceCameraController.maximumMovementRatio = 15.0;
      viewer.scene.globe.show = false;

      let moonTileset;
      try {
        const resource = await Cesium.IonResource.fromAssetId(2684829);
        moonTileset = await Cesium.Cesium3DTileset.fromUrl(resource);
        viewer.scene.primitives.add(moonTileset);
        if (showTempMap) moonTileset.show = false;
        viewer.camera.flyToBoundingSphere(moonTileset.boundingSphere, { duration: 0 });

        viewer.scene.light = new Cesium.DirectionalLight({
          direction: new Cesium.Cartesian3(1, 0, -1)
        });
        
        // Hide Loading Overlay
        const loader = document.getElementById('loadingOverlay');
        if(loader) loader.style.display = 'none';

      } catch (error) {
        console.error('Moon tileset 로드 실패:', error);
        const loader = document.getElementById('loadingOverlay');
        if(loader) loader.style.display = 'none';
        return;
      }

      // --- STATE & UTILS (selectionStack 기반) ---
      let selectionStack = [];
      let currentAnimFrame = null;
      let showGrid = true;

      const gridPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      const pillarPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      const flashPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      const FIXED_HEIGHT = 10000;

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
      
      // Cesium Cartesian3 → S2 Point (단순 정규화)
      function cesiumToS2Point(cartesian) {
        if (!cartesian) return null;
        
        const magnitude = Math.sqrt(
          cartesian.x * cartesian.x + 
          cartesian.y * cartesian.y + 
          cartesian.z * cartesian.z
        );
        
        if (magnitude === 0) return null;
        
        const x = cartesian.x / magnitude;
        const y = cartesian.y / magnitude;
        const z = cartesian.z / magnitude;
        
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
        sendToRN('DEPTH_CHANGED', { canGoBack: selectionStack.length > 0 });
        sendToRN('ZOOM_LEVEL_CHANGED', {
            currentLevel: currentZoomLevel,
            maxLevel: ZOOM_LEVELS.length - 1,
            minLevel: 0
        });
      }

      function resetExplorer() {
        if (currentAnimFrame) { cancelAnimationFrame(currentAnimFrame); currentAnimFrame = null; }
        selectionStack = [];
        currentZoomLevel = 0;
        render();
        pillarPrimitives.removeAll();
        updateUI();
        sendToRN('CELL_DESELECTED', {});
        if(moonTileset) viewer.camera.flyToBoundingSphere(moonTileset.boundingSphere, { duration: 1.0 });
      }

      function goBack() {
        if (selectionStack.length === 0) return;
        var wasBlockLevel = s2.cellid.level(selectionStack[selectionStack.length - 1]) >= 15;
        selectionStack.pop();
        render();
        updateUI();
        if (wasBlockLevel) {
            sendToRN('CELL_DESELECTED', {});
        }
        if (selectionStack.length > 0) {
            flyToCell(selectionStack[selectionStack.length - 1]);
        } else {
            sendToRN('CELL_DESELECTED', {});
            if (currentAnimFrame) { cancelAnimationFrame(currentAnimFrame); currentAnimFrame = null; }
            if(moonTileset) viewer.camera.flyToBoundingSphere(moonTileset.boundingSphere, { duration: 1.0 });
        }
      }
`;
