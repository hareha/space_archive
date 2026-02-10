export const CESIUM_HTML = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no">
  <title>Moon 3D</title>
  
  <script src="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Cesium.js"></script>
  <link href="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/dat.gui@0.7.9/build/dat.gui.min.js"></script>
  
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto:wght@300;400;500&display=swap');
    
    html, body, #cesiumContainer {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #000;
      font-family: 'Roboto', sans-serif;
    }

    /* Loading Overlay */
    #loadingOverlay {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: #000;
        display: flex; flex-direction: column;
        justify-content: center; align-items: center;
        z-index: 9999;
    }
    #loadingText {
        color: #3B82F6; font-family: 'Orbitron', sans-serif; font-size: 24px; margin-bottom: 20px;
    }
    #errorDisplay {
        color: red; font-size: 14px; margin-top: 20px; white-space: pre-wrap; font-family: monospace; text-align: center; padding: 20px; display: none;
        max-width: 90%; overflow-x: auto; background: rgba(50,0,0,0.8); border: 1px solid red;
    }

    /* Controls hidden - handled by React Native */
    #controls, #cellInfo { display: none; }
  </style>

  <!-- Error Handler -->
  <script>
    window.onerror = function(msg, url, line, col, error) {
        var el = document.getElementById('errorDisplay');
        if(el) {
            el.innerText = "JS Error: " + msg + "\\nLocation: " + url + ":" + line + ":" + col + "\\n" + (error ? error.stack : 'No stack');
            el.style.display = 'block';
        }
        var loadText = document.getElementById('loadingText');
        if(loadText) loadText.style.display = 'none';
        var overlay = document.getElementById('loadingOverlay');
        if(overlay) overlay.style.display = 'flex';
    };
  </script>
  <style>
    .dg.ac { position: fixed !important; top: 60px !important; left: 10px !important; right: auto !important; z-index: 1000 !important; }
    .dg .cr { height: 32px !important; }
  </style>
</head>

<body>
  <div id="cesiumContainer"></div>
  
  <div id="loadingOverlay">
      <div id="loadingText">INITIALIZING MOON...</div>
      <div id="errorDisplay"></div>
  </div>

  <script type="module">
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

      // --- STATE & UTILS ---
      const state = {
        level: 4,               // 현재 렌더링 레벨 (4, 8, 12, 16)
        showGrid: true,
        color: '#00FF00',
        selectedCellId: null,   // 현재 렌더링 기준 부모 (Drill-down 된 상태)
        focusedCellId: null,    // 현재 클릭(포커스)된 셀
        history: []             // 뒤로가기를 위한 {parentId, level} 스택
      };

      let gridPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      let selectedCellPrimitive = null;
      let hoveredCellPrimitive = null;
      let lastHoveredId = null;

      // --- Mineral Data ---
      let mineralDataArray = [];
      let mineralDataMap = new Map();
      let activeMineralFilter = null;
      let mineralOpacity = 0.5;
      let geologicPrimitive = null;
      let mineralStats = { min: 0, max: 1 };
      
      // Zoom Levels (Heights in meters)
      // Level 0: Global (Starting view)
      // Level 1: Regional
      // Level 2: Local
      // Level 3: Surface Detail
      const ZOOM_HEIGHTS = [4000000, 1500000, 400000, 50000];
      let currentZoomIndex = 0;

      // --- Temperature Map (Moved to top) ---

      // =====================================================
      // 좌표 변환 헬퍼 함수 (직접 스케일링 기반 통일)
      // =====================================================
      
      // S2 Point/Vertex (단위 구 좌표) → Cesium Cartesian3
      // [핵심 수정] lat/lon 경유 없이 직접 스케일링
      function s2PointToCesium(s2Point, altitude) {
        const mag = Math.sqrt(s2Point.x * s2Point.x + s2Point.y * s2Point.y + s2Point.z * s2Point.z);
        const nx = s2Point.x / mag;
        const ny = s2Point.y / mag;
        const nz = s2Point.z / mag;
        
        // Moon 반경 + altitude로 스케일링
        const radius = Cesium.Ellipsoid.MOON.maximumRadius + (altitude || 0);
        
        return new Cesium.Cartesian3(
          nx * radius,
          ny * radius,
          nz * radius
        );
      }
      
      // Cesium Cartesian3 → S2 Point (단순 정규화)
      // [핵심 수정] 타원체 변환 없이 직접 정규화
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

      function handleRNMessage(data) {
         try {
            const message = typeof data === 'string' ? JSON.parse(data) : data;
            if(message.type === 'GO_BACK') goBack();
            if(message.type === 'RESET') resetExplorer();
            if(message.type === 'TOGGLE_GRID') {
                state.showGrid = message.payload;
                updateS2Grid();
            }
            if(message.type === 'UPDATE_GRID_VISIBILITY') {
                updateGridVisibility(message.visible);
            }
            if(message.type === 'CHANGE_GRID_COLOR') {
                state.color = message.payload;
                updateS2Grid();
            }
            if(message.type === 'ZOOM_IN') {
                // viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.3);
                changeZoomLevel(1);
            }
            if(message.type === 'ZOOM_OUT') {
                // viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.5);
                changeZoomLevel(-1);
            }
            if(message.type === 'RESET_VIEW') {
                if(moonTileset) viewer.camera.flyToBoundingSphere(moonTileset.boundingSphere, { duration: 1.0 });
            }
            if(message.type === 'GO_TO_LOCATION') {
                const { lat, lng } = message.payload;
                const latRad = Cesium.Math.toRadians(lat);
                const lngRad = Cesium.Math.toRadians(lng);
                
                const altitude = 500000;
                const position = Cesium.Cartesian3.fromRadians(lngRad, latRad, altitude, Cesium.Ellipsoid.MOON);
                
                viewer.camera.flyTo({
                    destination: position,
                    orientation: {
                        heading: 0,
                        pitch: Cesium.Math.toRadians(-90),
                        roll: 0
                    },
                    duration: 2.0
                });
            }
            if(message.type === 'LOAD_MINERAL_DATA') {
                loadMineralData(message.data, message.isFirst, message.isLast);
            }
            if(message.type === 'UPDATE_MINERAL_FILTER') {
                updateMineralFilter(message.filter, message.enabled);
            }
            if(message.type === 'TOGGLE_TEMP_MAP') {
                toggleTempMap(message.enabled);
            }
            if(message.type === 'LOAD_TEMP_MAP_IMAGE') {
                loadTempMapImage(message.data);
            }
            if(message.type === 'TOGGLE_THERMAL_GRID') {
                toggleThermalGrid(message.enabled);
            }
            if(message.type === 'LOAD_THERMAL_GRID_DATA') {
                processThermalGridData(message.data);
            }
            if(message.type === 'UPDATE_THERMAL_MODE') {
                isDayTempMode = message.isDay;
                if (thermalGridCsvContent) {
                   renderThermalGridFromData();
                }
            }

         } catch(e) { console.error("Msg Error", e); }
      }

      function updateUI() {
        sendToRN('STATE_UPDATE', { 
            level: state.level, 
            historyLength: state.history.length,
            selectedCellId: state.selectedCellId ? s2.cellid.toToken(state.selectedCellId) : null
        });
        sendToRN('DEPTH_CHANGED', { canGoBack: state.history.length > 0 });
      }

      function resetExplorer() {
        state.level = 4;
        state.selectedCellId = null;
        state.focusedCellId = null;
        state.history = [];
        updateUI();
        updateS2Grid();
        if(moonTileset) viewer.camera.flyToBoundingSphere(moonTileset.boundingSphere);
        
        if (selectedCellPrimitive) {
          viewer.scene.primitives.remove(selectedCellPrimitive);
          selectedCellPrimitive = null;
        }
        if (hoveredCellPrimitive) {
          viewer.scene.primitives.remove(hoveredCellPrimitive);
          hoveredCellPrimitive = null;
        }
        lastHoveredId = null;
      }

      function goBack() {
        if (state.history.length === 0) return;
        const last = state.history.pop();
        
        state.level = last.level;
        state.selectedCellId = last.parentId;
        state.focusedCellId = null;

        updateUI();
        updateS2Grid();

        if (state.selectedCellId) {
           smoothZoomToCell(state.selectedCellId, 1000);
        } else {
           if(moonTileset) viewer.camera.flyToBoundingSphere(moonTileset.boundingSphere);
        }
        
        if(selectedCellPrimitive) {
            viewer.scene.primitives.remove(selectedCellPrimitive);
            selectedCellPrimitive = null;
        }
        if(hoveredCellPrimitive) {
            viewer.scene.primitives.remove(hoveredCellPrimitive);
            hoveredCellPrimitive = null;
        }
        lastHoveredId = null;
      }
      
      function getGridAltitude() { return 2000; }

      // Custom Camera Animation (직접 선형 보간 - arc 없이 직선 줌인)
      function smoothZoomToCell(cellId, duration = 1000) {
        const cell = s2.Cell.fromCellID(cellId);
        const center = cell.center();

        const gridAltitude = getGridAltitude();
        const centerCar3 = s2PointToCesium(center, gridAltitude);
        const level = s2.cellid.level(cellId);

        let additionalHeight;
        if (level <= 4) additionalHeight = 1500000;
        else if (level <= 8) additionalHeight = 200000;
        else if (level <= 12) additionalHeight = 15000;
        else additionalHeight = 4000;

        const normal = Cesium.Cartesian3.normalize(centerCar3, new Cesium.Cartesian3());
        const targetPosition = Cesium.Cartesian3.add(
          centerCar3,
          Cesium.Cartesian3.multiplyByScalar(normal, additionalHeight, new Cesium.Cartesian3()),
          new Cesium.Cartesian3()
        );

        // 직접 애니메이션 (arc 없이 직선 이동)
        const startPosition = Cesium.Cartesian3.clone(viewer.camera.position);
        const startHeading = viewer.camera.heading;
        const startPitch = viewer.camera.pitch;
        const targetPitch = Cesium.Math.toRadians(-90);
        let startTime = null;

        function animate(timestamp) {
          if (!startTime) startTime = timestamp;
          const progress = (timestamp - startTime) / duration;

          if (progress >= 1.0) {
            viewer.camera.setView({
              destination: targetPosition,
              orientation: {
                heading: startHeading,
                pitch: targetPitch,
                roll: 0.0
              }
            });
            return;
          }

          // Ease-out cubic
          const t = 1 - Math.pow(1 - progress, 3);

          // 위치 선형 보간
          const currentPos = new Cesium.Cartesian3();
          Cesium.Cartesian3.lerp(startPosition, targetPosition, t, currentPos);

          // 피치 보간
          const currentPitch = Cesium.Math.lerp(startPitch, targetPitch, t);

          viewer.camera.setView({
            destination: currentPos,
            orientation: {
              heading: startHeading,
              pitch: currentPitch,
              roll: 0.0
            }
          });

          requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
      }

      function getSegmentCount(level) {
        if (level <= 4) return 16;
        if (level <= 8) return 8;
        return 4;
      }

      // 동기 버전 (비동기 clampToHeight 제거)
      function getCellsToDraw(rootCellId, targetLevel, instances, color, renderRadius) {
        if (!rootCellId) {
          for (let f = 0; f < 6; f++) {
            const faceId = s2.cellid.fromFace(f);
            appendCellsRecursively(faceId, targetLevel, instances, color, renderRadius);
          }
        } else {
          appendCellsRecursively(rootCellId, targetLevel, instances, color, renderRadius);
        }
      }

      function appendCellsRecursively(currentId, targetLevel, instances, color, radius) {
        const currentLvl = s2.cellid.level(currentId);
        if (currentLvl === targetLevel) {
          const cell = s2.Cell.fromCellID(currentId);
          const segments = getSegmentCount(targetLevel);
          const positions = getCellBoundaryPositions(cell, radius, segments);
          instances.push(new Cesium.GeometryInstance({
            geometry: new Cesium.PolylineGeometry({
              positions: positions,
              width: 2.0
            }),
            attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) }
          }));
          return;
        }
        const children = s2.cellid.children(currentId);
        for (const child of children) {
          appendCellsRecursively(child, targetLevel, instances, color, radius);
        }
      }

      function interpolateCellEdge(cell, startIdx, endIdx, radius, segments) {
        const points = [];
        const v0 = cell.vertex(startIdx);
        const v1 = cell.vertex(endIdx);
        const altitude = getGridAltitude();

        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const x = v0.x * (1 - t) + v1.x * t;
          const y = v0.y * (1 - t) + v1.y * t;
          const z = v0.z * (1 - t) + v1.z * t;
          const cartesian = s2PointToCesium({ x, y, z }, altitude);
          points.push(cartesian);
        }
        return points;
      }

      function getCellBoundaryPositions(cell, radius, edgeSegments = 4) {
        const positions = [];
        for (let i = 0; i < 4; i++) {
          const nextIdx = (i + 1) % 4;
          const edgePoints = interpolateCellEdge(cell, i, nextIdx, radius, edgeSegments);
          if (i < 3) positions.push(...edgePoints.slice(0, -1));
          else positions.push(...edgePoints);
        }
        return positions;
      }

      // --- Mineral Data Functions ---
      
      function loadMineralData(dataArray, isFirst, isLast) {
        if (isFirst) {
          mineralDataArray = [];
        }
        mineralDataArray.push(...dataArray);
        
        if (isLast) {
          console.log('All mineral data loaded:', mineralDataArray.length, 'total entries');
          if (!geologicPrimitive) {
            createMineralSphere();
          }
        }
      }

      function updateMineralFilter(filter, enabled) {
        if (enabled) {
          activeMineralFilter = filter;
          calculateMineralStats(filter);
          updateMineralTexture();
          if (geologicPrimitive) {
            geologicPrimitive.show = true;
          }
        } else {
          activeMineralFilter = null;
          if (geologicPrimitive) {
            geologicPrimitive.show = false;
          }
        }
      }

      function updateGridVisibility(visible) {
        if (gridPrimitives) {
          gridPrimitives.show = visible;
        }
      }

      function calculateMineralStats(filter) {
        const values = mineralDataArray
          .map(item => getMineralValue(item, filter))
          .filter(v => !isNaN(v) && v !== null && v !== undefined);
        
        if (values.length > 0) {
          mineralStats.min = Math.min(...values);
          mineralStats.max = Math.max(...values);
        }
      }

      function getMineralValue(data, filter) {
        switch (filter) {
          case 'feo': return data.feo;
          case 'tio2': return data.tio2;
          case 'mgo': return data.mgo;
          case 'al2o3': return data.al2o3;
          case 'sio2': return data.sio2;
          case 'cao': return data.cao;
          case 'k': return data.k;
          case 'th': return data.th;
          case 'u': return data.u;
          case 'am': return data.am;
          case 'neutron': return data.neutron;
          default: return 0;
        }
      }

      function updateMineralTexture() {
        if (!activeMineralFilter || mineralDataArray.length === 0) {
          return;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        const range = mineralStats.max - mineralStats.min;
        if (range === 0) {
          return;
        }

        mineralDataArray.forEach(item => {
          const val = getMineralValue(item, activeMineralFilter);
          if (isNaN(val) || val === null || val === undefined) return;

          const latMax = item.latMax;
          const latMin = item.latMin;
          const lonMin = item.lonMin;
          const lonMax = item.lonMax;

          let normalized = (val - mineralStats.min) / range;
          normalized = Math.max(0, Math.min(1, normalized));

          const x = (lonMin + 180) * (canvas.width / 360);
          const y = (90 - latMax) * (canvas.height / 180);
          const w = (lonMax - lonMin) * (canvas.width / 360);
          const h = (latMax - latMin) * (canvas.height / 180);

          const hue = 240 - (normalized * 240);
          ctx.fillStyle = \`hsl(\${hue}, 100%, 50%)\`;
          ctx.fillRect(x, y, w + 0.5, h + 0.5);
        });

        if (geologicPrimitive && geologicPrimitive.appearance && geologicPrimitive.appearance.material) {
          geologicPrimitive.appearance.material.uniforms.image = canvas;
        }
      }

      function createMineralSphere() {
        const moonEllipsoid = Cesium.Ellipsoid.MOON;
        const geometry = new Cesium.EllipsoidGeometry({
          radii: new Cesium.Cartesian3(
            moonEllipsoid.maximumRadius + 18500,
            moonEllipsoid.maximumRadius + 18500,
            moonEllipsoid.maximumRadius + 18500
          )
        });

        geologicPrimitive = new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
          appearance: new Cesium.MaterialAppearance({
            material: new Cesium.Material({
              fabric: {
                type: 'LunarMineralMaterial',
                uniforms: {
                  image: document.createElement('canvas'),
                  u_offset: 0.5,
                  u_alpha: mineralOpacity
                },
                source: \`
                  czm_material czm_getMaterial(czm_materialInput materialInput) {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    vec2 st = materialInput.st;
                    st.x = fract(st.x + u_offset);
                    vec4 color = texture(image, st);
                    material.diffuse = color.rgb;
                    material.alpha = u_alpha;
                    return material;
                  }
                \`
              }
            })
          }),
          show: false
        });
        
        viewer.scene.primitives.add(geologicPrimitive);
      }

      // --- Temperature Map Functions ---

      function loadTempMapImage(base64Data) {
        tempMapImageData = base64Data;
        if (!tempMapPrimitive) {
          createTempMapSphere();
        }
        // 이미지 로드 후 텍스처 적용
        const img = new Image();
        img.onload = function() {
          if (tempMapPrimitive && tempMapPrimitive.appearance && tempMapPrimitive.appearance.material) {
            tempMapPrimitive.appearance.material.uniforms.image = img;
          }
        };
        img.src = base64Data;
      }

      function createTempMapSphere() {
        const moonEllipsoid = Cesium.Ellipsoid.MOON;
        const geometry = new Cesium.EllipsoidGeometry({
          radii: new Cesium.Cartesian3(
            moonEllipsoid.maximumRadius,
            moonEllipsoid.maximumRadius,
            moonEllipsoid.maximumRadius
          )
        });

        tempMapPrimitive = new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
          appearance: new Cesium.MaterialAppearance({
            material: new Cesium.Material({
              fabric: {
                type: 'LunarTempMapMaterial',
                uniforms: {
                  image: document.createElement('canvas'),
                  u_offset: 0.0,
                  u_alpha: 1.0
                },
                source: \`
                  czm_material czm_getMaterial(czm_materialInput materialInput) {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    vec2 st = materialInput.st;
                    st.x = fract(st.x + u_offset);
                    vec4 color = texture(image, st);
                    material.diffuse = color.rgb;
                    material.alpha = u_alpha;
                    return material;
                  }
                \`
              }
            }),
            renderState: {
              depthTest: { enabled: true },
              cull: { enabled: true, face: Cesium.CullFace.BACK }
            }
          }),
          show: showTempMap
        });

        viewer.scene.primitives.add(tempMapPrimitive);
      }

      function toggleTempMap(enabled) {
        showTempMap = enabled;
        // 온도 맵 ON → 3D 타일셋 숨기고 매끈한 구체 표시
        // 온도 맵 OFF → 타일셋 복원
        if (moonTileset) {
          moonTileset.show = !enabled;
        }
        if (tempMapPrimitive) {
          tempMapPrimitive.show = enabled;
        }
        // dat.gui (온도 맵과 독립적으로 동작)
        try {
          if (enabled) {
            if (!window._tempGui && typeof dat !== 'undefined') {
              var p = { opacity: 1.0, offset: 0.0 };
              window._tempGui = new dat.GUI({ width: 180 });
              window._tempGui.add(p, 'opacity', 0.05, 1.0, 0.01).name('투명도').onChange(function(v) {
                if (tempMapPrimitive && tempMapPrimitive.appearance && tempMapPrimitive.appearance.material)
                  tempMapPrimitive.appearance.material.uniforms.u_alpha = v;
              });
              window._tempGui.add(p, 'offset', -0.5, 0.5, 0.01).name('경도 오프셋').onChange(function(v) {
                if (tempMapPrimitive && tempMapPrimitive.appearance && tempMapPrimitive.appearance.material)
                  tempMapPrimitive.appearance.material.uniforms.u_offset = v;
              });
            }
          } else {
            if (window._tempGui) {
              window._tempGui.destroy();
              window._tempGui = null;
            }
          }
        } catch(e) { console.warn('dat.gui error:', e); }
      }

      // --- Thermal Grid Functions (New) ---
      
      function processThermalGridData(csvContent) {
        thermalGridCsvContent = csvContent;
        renderThermalGridFromData();
        thermalGridDataLoaded = true;
      }

      function renderThermalGridFromData() {
        if (!thermalGridCsvContent) return;

        // 기존 primitive 제거
        if (thermalGridPrimitive) {
          viewer.scene.primitives.remove(thermalGridPrimitive);
          thermalGridPrimitive = null;
        }

        console.log('Rendering thermal grid data... Day Mode:', isDayTempMode);
        const lines = thermalGridCsvContent.split('\\n');
        
        // Canvas 생성 (360 x 180)
        const width = 360;
        const height = 180;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, width, height);

        // 데이터 범위 설정 (Day vs Night)
        // 데이터 범위 설정 (Day vs Night)
        // Day: 200K ~ 390K (High contrast for hot areas)
        // Night: 40K ~ 100K
        const minTemp = isDayTempMode ? 200 : 40;
        const maxTemp = isDayTempMode ? 390 : 100;
        const tempRange = maxTemp - minTemp;
        
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        // CSV 파싱
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = line.split(',');
          if (parts.length < 4) continue; // max, min 둘다 필요할 수 있음
          
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          const dayMax = parseFloat(parts[2]);
          const nightMin = parseFloat(parts[3]);
          
          if (isNaN(lat) || isNaN(lon)) continue;

          // 모드에 따른 온도 값 선택
          const temp = isDayTempMode ? dayMax : nightMin;
          if (isNaN(temp)) continue;

          let y = Math.floor(90 - lat);
          let x = Math.floor(lon + 180);
          
          if (y >= height) y = height - 1;
          if (x >= width) x = width - 1;
          
          const index = (y * width + x) * 4;
          
          // 색상 계산
          let t = (temp - minTemp) / tempRange;
          
          // Contrast enhancing: Clamp strictly
          t = Math.max(0, Math.min(1, t));
          
          // Optional: Non-linear mapping to emphasize high temps?
          // t = Math.pow(t, 0.8); // 
          
          const hue = 240 * (1 - t);
          
          const [r, g, b] = hslToRgb(hue / 360, 1.0, 0.5);
          
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 160; // Slightly more opaque (160/255 ~= 0.6)
        }
        
        ctx.putImageData(imgData, 0, 0);
        createThermalGridSphere(canvas);
      }

      function hslToRgb(h, s, l) {
          let r, g, b;
          if (s === 0) {
              r = g = b = l; // achromatic
          } else {
              const hue2rgb = (p, q, t) => {
                  if (t < 0) t += 1;
                  if (t > 1) t -= 1;
                  if (t < 1 / 6) return p + (q - p) * 6 * t;
                  if (t < 1 / 2) return q;
                  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                  return p;
              };
              const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
              const p = 2 * l - q;
              r = hue2rgb(p, q, h + 1 / 3);
              g = hue2rgb(p, q, h);
              b = hue2rgb(p, q, h - 1 / 3);
          }
          return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      }

      function createThermalGridSphere(canvas) {
        const moonEllipsoid = Cesium.Ellipsoid.MOON;
        // 지형보다 20km 위에 표시 (기존 이미지는 표면 근처, 이건 약간 위)
        // 사용자가 "Wrapping"이라 했으므로 약간 띄우는게 격자 느낌 살리기 좋음
        const radius = moonEllipsoid.maximumRadius + 20000;
        
        const geometry = new Cesium.EllipsoidGeometry({
          radii: new Cesium.Cartesian3(radius, radius, radius)
        });

        thermalGridPrimitive = new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
          appearance: new Cesium.MaterialAppearance({
            material: new Cesium.Material({
              fabric: {
                type: 'LunarThermalGridMaterial',
                uniforms: {
                  image: canvas
                },
                source: \`
                  czm_material czm_getMaterial(czm_materialInput materialInput) {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    vec2 st = materialInput.st;

                    // Manual Nearest Neighbor Sampling for 360x180 grid
                    float width = 360.0;
                    float height = 180.0;

                    // Calculate center of the texel
                    float dx = 1.0 / width;
                    float dy = 1.0 / height;
                    vec2 st_nearest = vec2(
  (floor(st.x * width) + 0.5) * dx,
  (floor(st.y * height) + 0.5) * dy
);
                    
                    vec4 color = texture(image, st_nearest);

                    // Grid Lines Logic
                    // Calculate position within the cell (0.0 to 1.0)
                    float cellX = fract(st.x * width);
                    float cellY = fract(st.y * height);

                    // Define border thickness (e.g., 5% of cell size)
                    float border = 0.05;

  // Check if we are near the edge
  if (cellX < border || cellX > 1.0 - border || cellY < border || cellY > 1.0 - border) {
    // Make grid lines slightly darker and more opaque
    material.diffuse = color.rgb * 0.7; // Darker
    material.alpha = min(1.0, color.a + 0.2); // More distinct
  } else {
    material.diffuse = color.rgb;
    material.alpha = color.a;
  }

  return material;
}
\`
              }
            }),
            translucent: true,
            renderState: {
                depthTest: { enabled: true },
                cull: { enabled: true, face: Cesium.CullFace.BACK }
            }
          }),
          show: showThermalGrid
        });
        
        viewer.scene.primitives.add(thermalGridPrimitive);
        
        // 텍스처 필터링 강제 조정을 위한 꼼수 (Primitive 생성 후 Texture에 접근할 수 있다면)
        // Cesium Primitive는 내부적으로 Texture를 관리하므로 접근이 어려움.
        // Canvas 크기가 작아서 (360x180) 확대되면 자동으로 픽셀화되어 보일 수도 있음 (Linear여도).
      }

      function toggleThermalGrid(enabled) {
        showThermalGrid = enabled;
        if (thermalGridPrimitive) {
          thermalGridPrimitive.show = enabled;
        }
      }
      function updateS2Grid() {
        gridPrimitives.removeAll();
        if (!state.showGrid) return;
        const instances = [];
        const color = Cesium.Color.fromCssColorString(state.color).withAlpha(0.6);
        const altitude = getGridAltitude();
        const renderRadius = moonRadius + altitude;
        
        getCellsToDraw(state.selectedCellId, state.level, instances, color, renderRadius);
        
        console.log(\`Grid Updated: Level \${state.level}, Cells: \${instances.length}\`);

        if (instances.length > 0) {
          gridPrimitives.add(new Cesium.Primitive({
            geometryInstances: instances,
            appearance: new Cesium.PolylineColorAppearance({ flat: true }),
            asynchronous: true
          }));
        }
        updateUI();
      }

      // 호버 상태 관리
      function highlightHoveredCell(cellId) {
        if (lastHoveredId === cellId) return;
        lastHoveredId = cellId;
        if (hoveredCellPrimitive) {
          viewer.scene.primitives.remove(hoveredCellPrimitive);
          hoveredCellPrimitive = null;
        }
        if (!cellId) return;

        const cell = s2.Cell.fromCellID(cellId);
        const altitude = getGridAltitude();
        const segments = getSegmentCount(state.level);
        const positions = getCellBoundaryPositions(cell, moonRadius + altitude, segments);

        hoveredCellPrimitive = viewer.scene.primitives.add(new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({
            geometry: new Cesium.PolylineGeometry({
              positions: positions,
              width: 5.0
            }),
            attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.CYAN.withAlpha(0.8)) }
          }),
          appearance: new Cesium.PolylineColorAppearance({ flat: true }),
          asynchronous: false
        }));
      }

      function selectCell(cellId, latDeg, lngDeg) {
        if (selectedCellPrimitive) viewer.scene.primitives.remove(selectedCellPrimitive);

        const cell = s2.Cell.fromCellID(cellId);
        const level = s2.cellid.level(cellId);
        const token = s2.cellid.toToken(cellId);
        const face = s2.cellid.face(cellId);
        const altitude = getGridAltitude();
        const segments = getSegmentCount(level);
        const positions = getCellBoundaryPositions(cell, moonRadius + altitude, segments);

        selectedCellPrimitive = viewer.scene.primitives.add(new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({
            geometry: new Cesium.PolylineGeometry({
              positions: positions,
              width: 7.0
            }),
            attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.YELLOW) }
          }),
          appearance: new Cesium.PolylineColorAppearance({ flat: true }),
          asynchronous: false
        }));
        
        sendToRN('CELL_SELECTED', {
            cellId: token,
            token: token,
            face: face,
            lat: latDeg,
            lng: lngDeg,
            level: level
        });
      }

      function pickGridPoint(position) {
        if (!position) return null;
        
        const altitude = getGridAltitude();
        const r = Cesium.Ellipsoid.MOON.radii;
        const inflatedEllipsoid = new Cesium.Ellipsoid(
          r.x + altitude, r.y + altitude, r.z + altitude
        );
        
        const pickedPosition = viewer.camera.pickEllipsoid(position, inflatedEllipsoid);
        
        if (Cesium.defined(pickedPosition)) {
          return { position: pickedPosition, ellipsoid: inflatedEllipsoid };
        }
        
        return null;
      }

      function pickCellFromPosition(pickResult) {
        if (!pickResult || !pickResult.position) return null;
        // [수정] 단순 정규화 기반 변환 사용
        const s2Point = cesiumToS2Point(pickResult.position);
        if (!s2Point) return null;
        const leafCellId = s2.cellid.fromPoint(s2Point);
        return s2.cellid.parent(leafCellId, state.level);
      }

      // 클릭 핸들러
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement) => {
        const pickResult = pickGridPoint(movement.position);
        if (!pickResult) return;
        
        const position = pickResult.position;
        const cellAtStateLevel = pickCellFromPosition(pickResult);
        if (!cellAtStateLevel) return;

        // Drill-down 상태에서 현재 부모 영역 밖을 클릭했는지 체크
        if (state.selectedCellId) {
          const parentLevel = state.level - 4;
          const clickedCellParent = s2.cellid.parent(cellAtStateLevel, parentLevel);

          if (clickedCellParent !== state.selectedCellId) {
            // Lateral Switch
            state.selectedCellId = clickedCellParent;
            state.focusedCellId = null;
            lastHoveredId = null;

            updateUI();
            updateS2Grid();
            smoothZoomToCell(clickedCellParent, 1000);

            return;
          }
        }

        // Single Click Drill Down
        if (state.level < 16) {
          state.history.push({
            parentId: state.selectedCellId,
            level: state.level
          });

          const nextLevel = state.level + 4;
          state.level = nextLevel;
          state.selectedCellId = cellAtStateLevel;
          state.focusedCellId = null;

          lastHoveredId = null;

          updateUI();
          updateS2Grid();
          smoothZoomToCell(cellAtStateLevel, 1000);

          if (selectedCellPrimitive) {
            viewer.scene.primitives.remove(selectedCellPrimitive);
            selectedCellPrimitive = null;
          }
        } else {
          // 최대 레벨 (상세 보기)
          state.focusedCellId = cellAtStateLevel;
        } 
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // --- Zoom Level Function ---
      function changeZoomLevel(direction) {
        // Find nearest level first (in case of manual zoom)
        const currentHeight = viewer.camera.positionCartographic.height;
        let closestIndex = 0;
        let minDiff = Math.abs(currentHeight - ZOOM_HEIGHTS[0]);
        
        for (let i = 1; i < ZOOM_HEIGHTS.length; i++) {
            const diff = Math.abs(currentHeight - ZOOM_HEIGHTS[i]);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }
        
        let newIndex = closestIndex + direction;
        
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= ZOOM_HEIGHTS.length) newIndex = ZOOM_HEIGHTS.length - 1;
        
        if (newIndex !== currentZoomIndex || Math.abs(currentHeight - ZOOM_HEIGHTS[newIndex]) > 1000) {
          currentZoomIndex = newIndex;
          const targetHeight = ZOOM_HEIGHTS[currentZoomIndex];
          
          const center = viewer.camera.pickEllipsoid(new Cesium.Cartesian2(viewer.canvas.width / 2, viewer.canvas.height / 2));
          
          if (center) {
             const cartographic = Cesium.Cartographic.fromCartesian(center);
             cartographic.height = targetHeight;
             viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, targetHeight),
                duration: 1.0,
                easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
             });
          } else {
             const currentCart = viewer.camera.positionCartographic;
             viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromRadians(currentCart.longitude, currentCart.latitude, targetHeight),
                duration: 1.0
             });
          }
        }
      }

      // 마우스 호버 핸들러
      let lastMousePosition = null;
      function checkHoverAt(endPosition) {
         if(!endPosition) { highlightHoveredCell(null); return; }
         const pickResult = pickGridPoint(endPosition);
         if(!pickResult) { highlightHoveredCell(null); return; }
         const cell = pickCellFromPosition(pickResult);
         if(cell && cell !== state.focusedCellId) highlightHoveredCell(cell);
         else highlightHoveredCell(null);
      }

      handler.setInputAction((movement) => {
        lastMousePosition = Cesium.Cartesian2.clone(movement.endPosition);
        checkHoverAt(lastMousePosition);
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      viewer.scene.postRender.addEventListener(() => {
        if (lastMousePosition) checkHoverAt(lastMousePosition);
      });
      
      updateS2Grid();
    }

    // Start initialization
    initMoon().catch(err => {
        console.error("Top Level Init Error:", err);
        if(window.onerror) window.onerror(err.message, "initMoon", 0, 0, err);
    });
  </script>
</body>
</html>
`;
