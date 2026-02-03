export const CESIUM_HTML = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no">
  <title>Moon 3D</title>
  
  <script src="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Cesium.js"></script>
  <link href="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
  
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
      let mineralDataArray = []; // 전체 광물 데이터 배열
      let mineralDataMap = new Map(); // cellId -> MineralData
      let activeMineralFilter = null; // 현재 활성화된 필터 (하나만)
      let mineralOpacity = 0.5; // 광물 레이어 투명도 (고정)
      let geologicPrimitive = null; // 광물 텍스처 primitive
      let mineralStats = { min: 0, max: 1 }; // 현재 광물의 min/max

      // =====================================================
      // 좌표 변환 헬퍼 함수 (S2 ↔ Cesium 일관된 변환)
      // =====================================================
      
      // S2 Point/Vertex (단위 구 좌표) → Cesium Cartesian3
      function s2PointToCesium(s2Point, altitude) {
        const mag = Math.sqrt(s2Point.x * s2Point.x + s2Point.y * s2Point.y + s2Point.z * s2Point.z);
        const nx = s2Point.x / mag;
        const ny = s2Point.y / mag;
        const nz = s2Point.z / mag;
        
        // S2 좌표에서 lat/lon 계산
        // z = sin(lat), x = cos(lat)*cos(lon), y = cos(lat)*sin(lon)
        const lat = Math.asin(Math.max(-1, Math.min(1, nz)));  // clamp for safety
        const lon = Math.atan2(ny, nx);
        
        return Cesium.Cartesian3.fromRadians(lon, lat, altitude, Cesium.Ellipsoid.MOON);
      }
      
      // Cesium Cartesian3 → S2 Point (lat/lon 경유)
      function cesiumToS2Point(cartesian) {
        // Cesium의 Cartographic으로 변환하여 정확한 lat/lon 추출
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian, Cesium.Ellipsoid.MOON);
        if (!cartographic) return null;
        
        const lat = cartographic.latitude;  // radians
        const lon = cartographic.longitude; // radians
        
        // S2 Point: 단위 구의 (x, y, z)
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
                const camera = viewer.camera;
                const currentPos = Cesium.Cartesian3.clone(camera.position);
                const currentHeading = camera.heading;
                const currentPitch = camera.pitch;
                
                // Calculate current height
                const cartographic = Cesium.Cartographic.fromCartesian(currentPos, moonEllipsoid);
                const currentHeight = cartographic.height;
                
                // Target: 50% closer
                const targetHeight = currentHeight * 0.5;
                
                // Calculate target position maintaining direction
                const normal = Cesium.Cartesian3.normalize(currentPos, new Cesium.Cartesian3());
                const surfacePoint = Cesium.Cartesian3.multiplyByScalar(
                    normal, 
                    moonEllipsoid.maximumRadius, 
                    new Cesium.Cartesian3()
                );
                const targetPos = Cesium.Cartesian3.add(
                    surfacePoint,
                    Cesium.Cartesian3.multiplyByScalar(normal, targetHeight, new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                );
                
                // Smooth animation
                const duration = 800; // 0.8 seconds
                const startPosition = currentPos;
                let startTime = null;
                
                function animate(timestamp) {
                    if (!startTime) startTime = timestamp;
                    const progress = (timestamp - startTime) / duration;
                    
                    if (progress >= 1.0) {
                        camera.setView({
                            destination: targetPos,
                            orientation: {
                                heading: currentHeading,
                                pitch: currentPitch,
                                roll: 0.0
                            }
                        });
                        return;
                    }
                    
                    // Ease-out cubic
                    const t = 1 - Math.pow(1 - progress, 3);
                    const pos = Cesium.Cartesian3.lerp(startPosition, targetPos, t, new Cesium.Cartesian3());
                    
                    camera.setView({
                        destination: pos,
                        orientation: {
                            heading: currentHeading,
                            pitch: currentPitch,
                            roll: 0.0
                        }
                    });
                    
                    requestAnimationFrame(animate);
                }
                
                requestAnimationFrame(animate);
            }
            if(message.type === 'ZOOM_OUT') {
                const camera = viewer.camera;
                const currentPos = Cesium.Cartesian3.clone(camera.position);
                const currentHeading = camera.heading;
                const currentPitch = camera.pitch;
                
                // Calculate current height
                const cartographic = Cesium.Cartographic.fromCartesian(currentPos, moonEllipsoid);
                const currentHeight = cartographic.height;
                
                // Target: 2x farther
                const targetHeight = currentHeight * 2.0;
                
                // Calculate target position maintaining direction
                const normal = Cesium.Cartesian3.normalize(currentPos, new Cesium.Cartesian3());
                const surfacePoint = Cesium.Cartesian3.multiplyByScalar(
                    normal, 
                    moonEllipsoid.maximumRadius, 
                    new Cesium.Cartesian3()
                );
                const targetPos = Cesium.Cartesian3.add(
                    surfacePoint,
                    Cesium.Cartesian3.multiplyByScalar(normal, targetHeight, new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                );
                
                // Smooth animation
                const duration = 800; // 0.8 seconds
                const startPosition = currentPos;
                let startTime = null;
                
                function animate(timestamp) {
                    if (!startTime) startTime = timestamp;
                    const progress = (timestamp - startTime) / duration;
                    
                    if (progress >= 1.0) {
                        camera.setView({
                            destination: targetPos,
                            orientation: {
                                heading: currentHeading,
                                pitch: currentPitch,
                                roll: 0.0
                            }
                        });
                        return;
                    }
                    
                    // Ease-out cubic
                    const t = 1 - Math.pow(1 - progress, 3);
                    const pos = Cesium.Cartesian3.lerp(startPosition, targetPos, t, new Cesium.Cartesian3());
                    
                    camera.setView({
                        destination: pos,
                        orientation: {
                            heading: currentHeading,
                            pitch: currentPitch,
                            roll: 0.0
                        }
                    });
                    
                    requestAnimationFrame(animate);
                }
                
                requestAnimationFrame(animate);
            }
            if(message.type === 'GO_TO_LOCATION') {
                const { lat, lng } = message.payload;
                const latRad = Cesium.Math.toRadians(lat);
                const lngRad = Cesium.Math.toRadians(lng);
                
                // Calculate position on moon surface
                const altitude = getGridAltitude();
                const r = moonEllipsoid.radii;
                const Rx = r.x + altitude;
                const Ry = r.y + altitude;
                const Rz = r.z + altitude;
                
                const x = Math.cos(latRad) * Math.cos(lngRad);
                const y = Math.cos(latRad) * Math.sin(lngRad);
                const z = Math.sin(latRad);
                
                const s = 1.0 / Math.sqrt(
                  (x * x) / (Rx * Rx) +
                  (y * y) / (Ry * Ry) +
                  (z * z) / (Rz * Rz)
                );
                
                const surfacePoint = new Cesium.Cartesian3(x * s, y * s, z * s);
                
                // Camera position: 500km above the location
                const normal = Cesium.Cartesian3.normalize(surfacePoint, new Cesium.Cartesian3());
                const cameraHeight = 500000; // 500km
                const cameraPosition = Cesium.Cartesian3.add(
                  surfacePoint,
                  Cesium.Cartesian3.multiplyByScalar(normal, cameraHeight, new Cesium.Cartesian3()),
                  new Cesium.Cartesian3()
                );
                
                viewer.camera.flyTo({
                    destination: cameraPosition,
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
            if(message.type === 'UPDATE_MINERAL_OPACITY') {
                updateMineralOpacity(message.opacity);
            }

         } catch(e) { console.error("Msg Error", e); }
      }

      function updateUI() {
        sendToRN('STATE_UPDATE', { 
            level: state.level, 
            historyLength: state.history.length,
            selectedCellId: state.selectedCellId ? s2.cellid.toToken(state.selectedCellId) : null
        });
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

      // Custom Camera Animation: Linear Interpolation for "Zoom-in" feel without arc
      function smoothZoomToCell(cellId, duration = 1000) {
        const cell = s2.Cell.fromCellID(cellId);
        const center = cell.center();

        // 헬퍼 함수 사용하여 S2 중심점을 Cesium Cartesian3로 변환
        const gridAltitude = getGridAltitude();
        const centerCar3 = s2PointToCesium(center, gridAltitude);
        const level = s2.cellid.level(cellId);

        // Target Height Tuning (그리드 표면 위에서의 추가 높이)
        let additionalHeight;
        if (level <= 4) additionalHeight = 1500000;      // 1500km
        else if (level <= 8) additionalHeight = 200000;  // 200km
        else if (level <= 12) additionalHeight = 15000;  // 15km
        else additionalHeight = 4000;                    // 4km

        // Calculate Target Camera Position (Grid Surface + Normal * Additional Height)
        const normal = Cesium.Cartesian3.normalize(centerCar3, new Cesium.Cartesian3());
        const targetPosition = Cesium.Cartesian3.add(
          centerCar3,
          Cesium.Cartesian3.multiplyByScalar(normal, additionalHeight, new Cesium.Cartesian3()),
          new Cesium.Cartesian3()
        );

        // Animation Setup
        const startPosition = Cesium.Cartesian3.clone(viewer.camera.position);
        const startHeading = viewer.camera.heading;
        const startPitch = viewer.camera.pitch;
        const targetPitch = Cesium.Math.toRadians(-90);

        let startTime = null;

        function animate(timestamp) {
          if (!startTime) startTime = timestamp;
          const progress = (timestamp - startTime) / duration;

          if (progress >= 1.0) {
            // Finish
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

          // Ease-out Cubic for smoother stop
          const t = 1 - Math.pow(1 - progress, 3);

          // Interpolate Position
          const currentPos = new Cesium.Cartesian3();
          Cesium.Cartesian3.lerp(startPosition, targetPosition, t, currentPos);

          // Interpolate Pitch
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

      function getSegmentCount(level) {
        if (level <= 4) return 16;
        if (level <= 8) return 8;
        return 4;
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
          // S2 좌표에서 선형 보간
          const x = v0.x * (1 - t) + v1.x * t;
          const y = v0.y * (1 - t) + v1.y * t;
          const z = v0.z * (1 - t) + v1.z * t;
          
          // 헬퍼 함수 사용하여 일관된 변환
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

      // Cesium의 CullingVolume을 사용한 가시성 체크
      function isCellVisibleFromCamera(cellId, cullingVolume) {
        const cell = s2.Cell.fromCellID(cellId);
        const centerPoint = cell.center();

        // 헬퍼 함수 사용하여 S2 중심점을 Cesium Cartesian3로 변환
        const center = s2PointToCesium(centerPoint, 0);

        const level = s2.cellid.level(cellId);
        const cellRadius = (moonRadius * 2) / (1 << level);

        const boundingSphere = new Cesium.BoundingSphere(center, cellRadius);

        const visibility = cullingVolume.computeVisibility(boundingSphere);
        return visibility !== Cesium.Intersect.OUTSIDE;
      }

      // --- Mineral Data Functions ---
      
      // 광물 데이터 로딩
      function loadMineralData(dataArray, isFirst, isLast) {
        console.log('Loading mineral data chunk:', dataArray.length, 'entries');
        
        // 첫 번째 청크면 배열 초기화
        if (isFirst) {
          mineralDataArray = [];
        }
        
        // 배열에 추가
        mineralDataArray.push(...dataArray);
        
        console.log('Mineral data progress:', mineralDataArray.length, 'entries loaded');
        
        // 마지막 청크면 시각화 준비
        if (isLast) {
          console.log('All mineral data loaded:', mineralDataArray.length, 'total entries');
          // 광물 구체 생성 (처음 한 번만)
          if (!geologicPrimitive) {
            createMineralSphere();
          }
        }
      }

      // 광물 필터 업데이트
      function updateMineralFilter(filter, enabled) {
        if (enabled) {
          // 새 필터 활성화
          activeMineralFilter = filter;
          console.log('Activating filter:', filter);
          
          // 통계 계산 및 텍스처 업데이트
          calculateMineralStats(filter);
          updateMineralTexture();
          
          // 광물 구체 표시
          if (geologicPrimitive) {
            geologicPrimitive.show = true;
          }
          
          // 기본 그리드 숨기기 로직 제거 (독립 제어)
          // gridPrimitives.show = false; 
        } else {
          // 필터 비활성화
          activeMineralFilter = null;
          console.log('Deactivating filter');
          
          // 광물 구체 숨기기
          if (geologicPrimitive) {
            geologicPrimitive.show = false;
          }
          
          // 기본 그리드 표시 로직 제거 (독립 제어)
          // gridPrimitives.show = true;
        }
      }

      // 그리드 가시성 업데이트
      function updateGridVisibility(visible) {
        console.log('Updating grid visibility:', visible);
        if (gridPrimitives) {
          gridPrimitives.show = visible;
        }
      }

      // 광물 통계 계산
      function calculateMineralStats(filter) {
        const values = mineralDataArray
          .map(item => getMineralValue(item, filter))
          .filter(v => !isNaN(v) && v !== null && v !== undefined);
        
        if (values.length > 0) {
          mineralStats.min = Math.min(...values);
          mineralStats.max = Math.max(...values);
          console.log(\`Stats for \${filter}: min=\${mineralStats.min.toFixed(4)}, max=\${mineralStats.max.toFixed(4)}\`);
        }
      }

      // 광물 값 추출
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

      // 광물 텍스처 업데이트
      function updateMineralTexture() {
        if (!activeMineralFilter || mineralDataArray.length === 0) {
          console.log('No active filter or no data');
          return;
        }

        console.log('Updating mineral texture for:', activeMineralFilter);
        
        // 캔버스 생성
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        const range = mineralStats.max - mineralStats.min;
        if (range === 0) {
          console.warn('Range is zero, cannot normalize');
          return;
        }

        // 각 데이터 포인트를 캔버스에 그리기
        mineralDataArray.forEach(item => {
          const val = getMineralValue(item, activeMineralFilter);
          if (isNaN(val) || val === null || val === undefined) return;

          const latMax = item.latMax;
          const latMin = item.latMin;
          const lonMin = item.lonMin;
          const lonMax = item.lonMax;

          // 정규화 (0~1)
          let normalized = (val - mineralStats.min) / range;
          normalized = Math.max(0, Math.min(1, normalized));

          // 캔버스 좌표 계산
          const x = (lonMin + 180) * (canvas.width / 360);
          const y = (90 - latMax) * (canvas.height / 180);
          const w = (lonMax - lonMin) * (canvas.width / 360);
          const h = (latMax - latMin) * (canvas.height / 180);

          // 색상 계산: 파란색(240) -> 빨간색(0)
          const hue = 240 - (normalized * 240);
          ctx.fillStyle = \`hsl(\${hue}, 100%, 50%)\`;
          ctx.fillRect(x, y, w + 0.5, h + 0.5);
        });

        console.log('Texture canvas created');

        // Primitive의 material에 텍스처 적용
        if (geologicPrimitive && geologicPrimitive.appearance && geologicPrimitive.appearance.material) {
          geologicPrimitive.appearance.material.uniforms.image = canvas;
          console.log('Texture applied to primitive');
        }
      }

      // 광물 구체 생성 (point.html의 createDataSphere 참고)
      function createMineralSphere() {
        console.log('Creating mineral sphere...');
        
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
          show: false // 처음에는 숨김
        });
        
        viewer.scene.primitives.add(geologicPrimitive);
        console.log('Mineral sphere created and added to scene');
      }



      function updateS2Grid() {
        gridPrimitives.removeAll();
        if (!state.showGrid) return;
        const instances = [];
        const color = Cesium.Color.fromCssColorString(state.color).withAlpha(0.6);
        const altitude = getGridAltitude();
        const renderRadius = moonRadius + altitude;
        
        const startTime = performance.now();
        getCellsToDraw(state.selectedCellId, state.level, instances, color, renderRadius);
        console.log(\`Grid Updated: Level \${state.level}, Alt \${altitude}m, Cells: \${instances.length}, Time: \${(performance.now() - startTime).toFixed(0)}ms\`);

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
        
        // Notify App
        sendToRN('CELL_SELECTED', {
            cellId: token,  // BigInt 대신 token 문자열 사용
            token: token,
            face: face,
            lat: latDeg,
            lng: lngDeg,
            level: level
        });
      }

      function cartesianToS2Point(cartesian) {
        // [수정] lat/lon을 경유하여 일관된 변환 수행
        return cesiumToS2Point(cartesian);
      }

      // [시차 해결] 그리드 고도(2000m)와 동일한 Ellipsoid에서 피킹
      function pickGridPoint(position) {
        if (!position) return null;
        
        // 그리드 렌더링과 동일한 확장된 Ellipsoid 생성
        const altitude = getGridAltitude();
        const r = Cesium.Ellipsoid.MOON.radii;
        const inflatedEllipsoid = new Cesium.Ellipsoid(
          r.x + altitude, r.y + altitude, r.z + altitude
        );
        
        // 확장된 Ellipsoid에서 피킹 - 그리드와 동일한 고도
        const pickedPosition = viewer.camera.pickEllipsoid(position, inflatedEllipsoid);
        
        if (Cesium.defined(pickedPosition)) {
          console.log('[pickEllipsoid @ Grid Altitude] Hit:', {
            x: pickedPosition.x.toFixed(2),
            y: pickedPosition.y.toFixed(2),
            z: pickedPosition.z.toFixed(2),
            altitude: altitude
          });
          return pickedPosition;
        }
        
        console.log('[pickGridPoint] No hit on inflated ellipsoid');
        return null;
      }

      function pickCellFromPosition(position) {
        if (!position) return null;
        const s2Point = cartesianToS2Point(position);
        const leafCellId = s2.cellid.fromPoint(s2Point);
        return s2.cellid.parent(leafCellId, state.level);
      }

      // 클릭 핸들러
      let debugClickMarker = null;
      let debugCellCenterMarker = null;
      
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement) => {
        const position = pickGridPoint(movement.position);
        if (!position) return;
        
        // [DEBUG] 클릭 위치에 빨간 마커 표시
        if (debugClickMarker) viewer.entities.remove(debugClickMarker);
        debugClickMarker = viewer.entities.add({
          position: position,
          point: {
            pixelSize: 15,
            color: Cesium.Color.RED,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2
          }
        });
        
        const cellAtStateLevel = pickCellFromPosition(position);
        if (!cellAtStateLevel) return;
        
        // [DEBUG] 선택된 셀의 중심에 초록 마커 표시
        const selectedCell = s2.Cell.fromCellID(cellAtStateLevel);
        const cellCenter = selectedCell.center();
        const altitude = getGridAltitude();
        
        // 헬퍼 함수 사용하여 S2 중심점을 Cesium Cartesian3로 변환
        const cellCenterCartesian = s2PointToCesium(cellCenter, altitude);
        
        if (debugCellCenterMarker) viewer.entities.remove(debugCellCenterMarker);
        debugCellCenterMarker = viewer.entities.add({
          position: cellCenterCartesian,
          point: {
            pixelSize: 15,
            color: Cesium.Color.LIME,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2
          }
        });
        
        console.log('[DEBUG] Click pos:', {
          x: position.x.toFixed(2),
          y: position.y.toFixed(2),
          z: position.z.toFixed(2)
        });
        console.log('[DEBUG] Cell center:', {
          x: cellCenterCartesian.x.toFixed(2),
          y: cellCenterCartesian.y.toFixed(2),
          z: cellCenterCartesian.z.toFixed(2)
        });

        // [수정] Drill-down 상태에서 현재 부모(SelectedCellId) 영역 밖을 클릭했는지 체크
        if (state.selectedCellId) {
          const parentLevel = state.level - 4;
          const clickedCellParent = s2.cellid.parent(cellAtStateLevel, parentLevel);

          if (clickedCellParent !== state.selectedCellId) {
            console.log("Clicked outside current drill-down context. Lateral Switch.");

            // Lateral Switch: 즉시 옆 셀의 같은 레벨로 이동
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
          console.log("Drilling Down...");
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
          console.log("Max level reached");
          // 마지막 레벨에서는 선택 표시만 남김
          state.focusedCellId = cellAtStateLevel;

          const cartographic = Cesium.Cartographic.fromCartesian(position, moonEllipsoid);
          const latDeg = Cesium.Math.toDegrees(cartographic.latitude);
          const lngDeg = Cesium.Math.toDegrees(cartographic.longitude);

          selectCell(cellAtStateLevel, latDeg, lngDeg);
        }

      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // 마우스 호버 핸들러
      let lastMousePosition = null;
      function checkHoverAt(endPosition) {
         if(!endPosition) { highlightHoveredCell(null); return; }
         const position = pickGridPoint(endPosition);
         if(!position) { highlightHoveredCell(null); return; }
         const cell = pickCellFromPosition(position);
         if(cell && cell !== state.focusedCellId) highlightHoveredCell(cell);
         else highlightHoveredCell(null);
      }

      handler.setInputAction((movement) => {
        lastMousePosition = Cesium.Cartesian2.clone(movement.endPosition);
        checkHoverAt(lastMousePosition);
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      // 카메라가 움직이거나 줌이 될 때도 호버 상태를 갱신
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
