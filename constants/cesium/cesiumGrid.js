// cesiumGrid.js — S2 그리드 렌더링 + 네비게이션 모듈
// 면(fill) / 선(line) 모드 완전 독립 분리
// getRenderConfig, getExactCellPositions, flashCell, getDescendants, render, flyToCell

export const CESIUM_GRID = `
      // --- 프로토타입 기반 그리드 렌더링 함수들 ---

      const getRenderConfig = (level) => ({
          segments: level <= 4 ? 8 : (level <= 8 ? 4 : 1)
      });

      function getExactCellPositions(cellId, height, segments) {
          const cell = s2.Cell.fromCellID(cellId);
          const positions = [];
          for (let i = 0; i < 4; i++) {
              const p1 = cell.vertex(i); const p2 = cell.vertex((i + 1) % 4);
              for (let j = 0; j < segments; j++) {
                  const t = j / segments;
                  const dx = p1.x * (1 - t) + p2.x * t, dy = p1.y * (1 - t) + p2.y * t, dz = p1.z * (1 - t) + p2.z * t;
                  const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  positions.push(Cesium.Cartesian3.fromRadians(Math.atan2(dy / mag, dx / mag), Math.asin(dz / mag), height, Cesium.Ellipsoid.MOON));
              }
          }
          return positions;
      }

      function flashCell(cellId) {
          flashPrimitives.removeAll();
          const cell = s2.Cell.fromCellID(cellId);
          const cc = cell.center();
          const ccr = Math.sqrt(cc.x ** 2 + cc.y ** 2 + cc.z ** 2);
          const centerCart = Cesium.Cartesian3.fromRadians(
              Math.atan2(cc.y, cc.x), Math.asin(cc.z / ccr), 0, Cesium.Ellipsoid.MOON
          );
          const FLASH_INSET = 0.92;
          const insetPositions = [];
          for (let i = 0; i < 4; i++) {
              const v = cell.vertex(i); const r = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
              const vertCart = Cesium.Cartesian3.fromRadians(Math.atan2(v.y, v.x), Math.asin(v.z / r), 0, Cesium.Ellipsoid.MOON);
              insetPositions.push(new Cesium.Cartesian3(
                  centerCart.x + (vertCart.x - centerCart.x) * FLASH_INSET,
                  centerCart.y + (vertCart.y - centerCart.y) * FLASH_INSET,
                  centerCart.z + (vertCart.z - centerCart.z) * FLASH_INSET
              ));
          }
          flashPrimitives.add(new Cesium.ClassificationPrimitive({
              geometryInstances: new Cesium.GeometryInstance({
                  geometry: new Cesium.PolygonGeometry({
                      polygonHierarchy: new Cesium.PolygonHierarchy(insetPositions),
                      ellipsoid: Cesium.Ellipsoid.MOON,
                      height: -15000, extrudedHeight: 15000,
                  }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.5)) }
              }),
              appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
              classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
              asynchronous: false
          }));
          setTimeout(() => { flashPrimitives.removeAll(); }, 600);
      }

      function getDescendants(cellId, targetLevel) {
          let results = [cellId];
          let currentLevel = s2.cellid.level(cellId);
          while (currentLevel < targetLevel) {
              let nextResults = [];
              for (let id of results) { nextResults.push(...s2.cellid.children(id)); }
              results = nextResults;
              currentLevel++;
          }
          return results;
      }

      // ═══════════════════════════════════════════════════
      // 면 / 선 모드 토글
      // ═══════════════════════════════════════════════════
      let gridRenderMode = 'fill'; // 'fill' | 'line'

      const gridModeBtn = document.createElement('button');
      gridModeBtn.id = 'gridModeToggle';
      gridModeBtn.textContent = '▦ 면';
      gridModeBtn.style.cssText = 'position:absolute;top:16px;left:16px;z-index:1000;' +
          'padding:8px 16px;border:1px solid rgba(0,255,0,0.5);border-radius:20px;' +
          'background:rgba(0,0,0,0.7);color:#0f0;font-family:Roboto,sans-serif;font-size:13px;' +
          'cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
          'transition:all 0.2s ease;letter-spacing:1px;';
      gridModeBtn.addEventListener('mouseenter', function() {
          this.style.background = 'rgba(0,255,0,0.15)';
          this.style.borderColor = 'rgba(0,255,0,0.8)';
      });
      gridModeBtn.addEventListener('mouseleave', function() {
          this.style.background = 'rgba(0,0,0,0.7)';
          this.style.borderColor = 'rgba(0,255,0,0.5)';
      });
      gridModeBtn.addEventListener('click', function() {
          gridRenderMode = gridRenderMode === 'fill' ? 'line' : 'fill';
          this.textContent = gridRenderMode === 'fill' ? '▦ 면' : '╬ 선';
          lastRenderedDepth = 0;
          parentPrimitives.removeAll();
          render();
      });
      document.body.appendChild(gridModeBtn);
      // 기본이 탐사모드이면 숨김
      if (mainMode !== 'occupation') gridModeBtn.style.display = 'none';

      // ═══ 카메라 리스너 제거됨 (고정 INSET 사용) ═══

      // ═══════════════════════════════════════════════════
      // render() — 모드에 따라 독립 경로 호출
      // ═══════════════════════════════════════════════════
      function render() {
          if (typeof gridPrimitives !== 'undefined') gridPrimitives.removeAll();
          if (typeof pillarPrimitives !== 'undefined') pillarPrimitives.removeAll();
          
          // 탐사 모드에서는 그리드 강제 렌더링 방지
          if (typeof mainMode !== 'undefined' && mainMode === 'exploration') {
              return;
          }

          if (gridRenderMode === 'fill') {
              renderFill();
          } else {
              renderLine();
          }
      }

      // ═══════════════════════════════════════════════════
      // 면 모드 (FILL) — 완전 독립
      // ═══════════════════════════════════════════════════
      function renderFill() {
          const lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          const currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;
          var displayedCellCount = 0;
          var gridTargetLevel = currentLevel;

          const CELL_INSET = 0.97;
          const parentColors = [
              Cesium.Color.LAWNGREEN.withAlpha(0.25),
              Cesium.Color.LAWNGREEN.withAlpha(0.08),
              Cesium.Color.CYAN.withAlpha(0.10),
              Cesium.Color.DODGERBLUE.withAlpha(0.12),
          ];

          function drawCells(cellIds, color, collection, async) {
              cellIds.forEach(id => {
                  const cell = s2.Cell.fromCellID(id);
                  const cc = cell.center();
                  const ccr = Math.sqrt(cc.x ** 2 + cc.y ** 2 + cc.z ** 2);
                  const centerCart = Cesium.Cartesian3.fromRadians(
                      Math.atan2(cc.y, cc.x), Math.asin(cc.z / ccr), 0, Cesium.Ellipsoid.MOON
                  );
                  const positions = [];
                  for (let vi = 0; vi < 4; vi++) {
                      const v = cell.vertex(vi);
                      const vr = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                      const vertCart = Cesium.Cartesian3.fromRadians(
                          Math.atan2(v.y, v.x), Math.asin(v.z / vr), 0, Cesium.Ellipsoid.MOON
                      );
                      positions.push(new Cesium.Cartesian3(
                          centerCart.x + (vertCart.x - centerCart.x) * CELL_INSET,
                          centerCart.y + (vertCart.y - centerCart.y) * CELL_INSET,
                          centerCart.z + (vertCart.z - centerCart.z) * CELL_INSET
                      ));
                  }
                  collection.add(new Cesium.ClassificationPrimitive({
                      geometryInstances: new Cesium.GeometryInstance({
                          geometry: new Cesium.PolygonGeometry({
                              polygonHierarchy: new Cesium.PolygonHierarchy(positions),
                              ellipsoid: Cesium.Ellipsoid.MOON,
                              height: -15000, extrudedHeight: 15000,
                          }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) }
                      }),
                      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                      classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
                      asynchronous: !!async
                  }));
              });
          }

          // ─── 부모 레이어 ───
          if (lastRenderedDepth === 0) {
              let lv4Cells = [];
              for (let f = 0; f < 6; f++) lv4Cells.push(...getDescendants(s2.cellid.fromFace(f), 4));
              drawCells(lv4Cells, parentColors[0], parentPrimitives, false);
              lastRenderedDepth = 1;
          }
          for (let si = lastRenderedDepth - 1; si < selectionStack.length; si++) {
              if (si < 1) continue;
              if (si >= parentColors.length) break;
              const siblings = getDescendants(selectionStack[si - 1], s2.cellid.level(selectionStack[si]));
              drawCells(siblings, parentColors[si], parentPrimitives, false);
          }
          lastRenderedDepth = selectionStack.length + 1;

          // ─── 활성 레벨 ───
          if (currentLevel >= 16) {
              drawCells([lastCellId], Cesium.Color.YELLOW.withAlpha(0.6), pillarPrimitives, true);
              displayedCellCount = 1;
              gridTargetLevel = 16;
              sendBlockData(lastCellId);
          } else if (currentLevel > 0) {
              var targetLevel = currentLevel + 4;
              gridTargetLevel = targetLevel;
              let candidates = getDescendants(lastCellId, targetLevel);
              displayedCellCount = candidates.length;
              drawCells(candidates, Cesium.Color.LAWNGREEN.withAlpha(0.25), pillarPrimitives, true);
          }

          updateDebugPanel(currentLevel, gridTargetLevel, displayedCellCount);
          updateUI();
      }

      // 0단계 Polyline + 하부 ClassificationPrimitive 하이브리드
      // ═══════════════════════════════════════════════════
      function renderLine() {
          parentPrimitives.removeAll();

          const lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          const currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;
          var displayedCellCount = 0;
          var gridTargetLevel = currentLevel;

          // ═══ 0단계: Polyline으로 lv4 그리드 ═══
          if (currentLevel === 0) {
              let lv4Cells = [];
              for (let f = 0; f < 6; f++) lv4Cells.push(...getDescendants(s2.cellid.fromFace(f), 4));

              const ALT = 10000;
              const instances = [];
              lv4Cells.forEach(id => {
                  const cell = s2.Cell.fromCellID(id);
                  const positions = [];
                  for (let vi = 0; vi < 4; vi++) {
                      const v = cell.vertex(vi);
                      const vr = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                      positions.push(Cesium.Cartesian3.fromRadians(
                          Math.atan2(v.y, v.x), Math.asin(v.z / vr), ALT, Cesium.Ellipsoid.MOON
                      ));
                  }
                  positions.push(positions[0]);

                  instances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolylineGeometry({
                          positions: positions,
                          width: 0.3,
                      }),
                      attributes: {
                          color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                              Cesium.Color.LAWNGREEN.withAlpha(0.5)
                          )
                      }
                  }));
              });

              parentPrimitives.add(new Cesium.Primitive({
                  geometryInstances: instances,
                  appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
                  asynchronous: false
              }));

              displayedCellCount = lv4Cells.length;
              gridTargetLevel = 4;
              updateDebugPanel(currentLevel, gridTargetLevel, displayedCellCount);
              updateUI();
              return;
          }

          // ═══ 1단계 이상: ClassificationPrimitive ═══
          const BASE_INSET = 0.78;
          const MOON_R = 1737400;
          let activeLevel = 4;
          if (currentLevel === 4) activeLevel = 8;
          else if (currentLevel === 8) activeLevel = 12;
          else if (currentLevel >= 12) activeLevel = 16;
          const refEdge = MOON_R * Math.sqrt(Math.PI / (6 * Math.pow(4, activeLevel)));
          const lineWidth = (1 - BASE_INSET) * refEdge;

          const parentColors = [
              Cesium.Color.LAWNGREEN.withAlpha(0.35),
              Cesium.Color.CYAN.withAlpha(0.35),
              Cesium.Color.DODGERBLUE.withAlpha(0.35),
              Cesium.Color.MEDIUMPURPLE.withAlpha(0.35),
          ];

          function drawCells(cellIds, color, collection, async, excludeId) {
              cellIds.forEach(id => {
                  if (excludeId && s2.cellid.toToken(id) === s2.cellid.toToken(excludeId)) return;

                  const cell = s2.Cell.fromCellID(id);
                  const cc = cell.center();
                  const ccr = Math.sqrt(cc.x ** 2 + cc.y ** 2 + cc.z ** 2);
                  const centerCart = Cesium.Cartesian3.fromRadians(
                      Math.atan2(cc.y, cc.x), Math.asin(cc.z / ccr), 0, Cesium.Ellipsoid.MOON
                  );

                  const outerPositions = [];
                  for (let vi = 0; vi < 4; vi++) {
                      const v = cell.vertex(vi);
                      const vr = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                      outerPositions.push(Cesium.Cartesian3.fromRadians(
                          Math.atan2(v.y, v.x), Math.asin(v.z / vr), 0, Cesium.Ellipsoid.MOON
                      ));
                  }

                  const edgeLen = Cesium.Cartesian3.distance(outerPositions[0], outerPositions[1]);
                  let inset = 1 - lineWidth / edgeLen;
                  inset = Math.max(0.5, Math.min(inset, 0.998));

                  const innerPositions = outerPositions.map(vertCart =>
                      new Cesium.Cartesian3(
                          centerCart.x + (vertCart.x - centerCart.x) * inset,
                          centerCart.y + (vertCart.y - centerCart.y) * inset,
                          centerCart.z + (vertCart.z - centerCart.z) * inset
                      )
                  );

                  collection.add(new Cesium.ClassificationPrimitive({
                      geometryInstances: new Cesium.GeometryInstance({
                          geometry: new Cesium.PolygonGeometry({
                              polygonHierarchy: new Cesium.PolygonHierarchy(outerPositions, [
                                  new Cesium.PolygonHierarchy(innerPositions)
                              ]),
                              ellipsoid: Cesium.Ellipsoid.MOON,
                              height: -15000, extrudedHeight: 15000,
                          }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) }
                      }),
                      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                      classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
                      asynchronous: !!async
                  }));
              });
          }

          // ─── 부모 레이어 (선택 셀 제외, 통일 두께) ───
          let lv4Cells = [];
          for (let f = 0; f < 6; f++) lv4Cells.push(...getDescendants(s2.cellid.fromFace(f), 4));
          drawCells(lv4Cells, parentColors[0], parentPrimitives, false,
              selectionStack.length > 0 ? selectionStack[0] : null);

          for (let si = 0; si < selectionStack.length; si++) {
              if (si < 1) continue;
              if (si >= parentColors.length) break;
              const siblings = getDescendants(selectionStack[si - 1], s2.cellid.level(selectionStack[si]));
              drawCells(siblings, parentColors[si], parentPrimitives, false,
                  si < selectionStack.length ? selectionStack[si] : null);
          }

          // ─── 활성 레벨 (뎁스 색상 통일) ───
          const activeColorIdx = Math.min(selectionStack.length, parentColors.length - 1);
          const activeColor = parentColors[activeColorIdx].withAlpha(0.5);
          if (currentLevel >= 16) {
              drawCells([lastCellId], activeColor, pillarPrimitives, true);
              displayedCellCount = 1;
              gridTargetLevel = 16;
              sendBlockData(lastCellId);
          } else if (currentLevel > 0) {
              var targetLevel = currentLevel + 4;
              gridTargetLevel = targetLevel;
              let candidates = getDescendants(lastCellId, targetLevel);
              displayedCellCount = candidates.length;
              drawCells(candidates, activeColor, pillarPrimitives, true);
          }

          updateDebugPanel(currentLevel, gridTargetLevel, displayedCellCount);
          updateUI();
      }

      // ═══════════════════════════════════════════════════
      // 공통 헬퍼
      // ═══════════════════════════════════════════════════
      function sendBlockData(lastCellId) {
          var blockCell = s2.Cell.fromCellID(lastCellId);
          var center16 = blockCell.center();
          var cr = Math.sqrt(center16.x ** 2 + center16.y ** 2 + center16.z ** 2);
          var cLon = Math.atan2(center16.y, center16.x);
          var cLat = Math.asin(center16.z / cr);
          var cLonDeg = Cesium.Math.toDegrees(cLon).toFixed(4);
          var cLatDeg = Cesium.Math.toDegrees(cLat).toFixed(4);
          var token = s2.cellid.toToken(lastCellId);
          var seed = parseInt(token.substring(0, 6), 16) || 0;
          var feo = (((seed * 7 + 13) % 100) / 10).toFixed(1);
          var tio2 = (((seed * 3 + 7) % 50) / 10).toFixed(1);
          var waterIce = (((seed * 11 + 3) % 30) / 10).toFixed(1);
          var tempK = 40 + ((seed * 17) % 260);
          var price = (0.5 + ((seed * 13) % 100) / 20).toFixed(2);
          sendToRN('CELL_SELECTED', {
              cellId: token, token: token,
              lat: parseFloat(cLatDeg), lng: parseFloat(cLonDeg),
              level: 16, childLevel: 16,
              unit: '1 Block = 1 Mag', magCount: 1, magTokens: [token],
              minerals: { feo: feo + '%', tio2: tio2 + '%', waterIce: waterIce + '%', surfaceTemp: tempK + 'K' },
              price: '$' + price, area: '~0.8 km²'
          });
      }

      function updateDebugPanel(currentLevel, gridTargetLevel, displayedCellCount) {
          var debugEl = document.getElementById('debugPanel');
          if (debugEl) {
              var pathStr = '0';
              for (var pi = 0; pi < selectionStack.length && pi < 5; pi++) {
                  pathStr += ' → ' + s2.cellid.level(selectionStack[pi]);
              }
              var modeLabel = gridRenderMode === 'fill' ? 'FILL' : 'LINE';
              var _camCarto = Cesium.Cartographic.fromCartesian(viewer.camera.position, Cesium.Ellipsoid.MOON);
              var camHeight = _camCarto ? _camCarto.height : 0;
              var heightStr = camHeight > 1000000 ? (camHeight / 1000000).toFixed(2) + ' Mm' : camHeight > 1000 ? (camHeight / 1000).toFixed(1) + ' km' : camHeight.toFixed(0) + ' m';
              debugEl.innerHTML =
                  '<b>Grid Debug [' + modeLabel + ']</b><br>' +
                  'Cam Height: <b style="color:#0f0" id="camHeightLive">' + heightStr + ' (' + Math.round(camHeight) + ' m)</b><br>' +
                  'Selection Level: ' + currentLevel + '<br>' +
                  'Showing Level: ' + gridTargetLevel + ' cells<br>' +
                  'Cell Count: ' + displayedCellCount + '<br>' +
                  'Stack Depth: ' + selectionStack.length + '<br>' +
                  'Path: ' + pathStr + '<br>' +
                  'Hierarchy: 0→4→8→12→16(Block)';
          }
      }

      function flyToCell(targetCellId, onMidFlight) {
          if (currentAnimFrame) { cancelAnimationFrame(currentAnimFrame); currentAnimFrame = null; }
          const cell = s2.Cell.fromCellID(targetCellId);
          const center = cell.center();
          const r = Math.sqrt(center.x ** 2 + center.y ** 2 + center.z ** 2);
          const lon = Math.atan2(center.y, center.x), lat = Math.asin(center.z / r);
          const level = s2.cellid.level(targetCellId);

          // 지표면 높이 측정 후 여유 고도 추가
          var cartographic = new Cesium.Cartographic(lon, lat);
          var surfaceHeight = viewer.scene.sampleHeight(cartographic);
          if (surfaceHeight === undefined || surfaceHeight === null) surfaceHeight = 0;

          let baseHeight;
          if (level === 0) baseHeight = 3500000;
          else if (level <= 4) baseHeight = 200000;
          else if (level <= 8) baseHeight = 12000;
          else if (level <= 12) baseHeight = 1500;
          else if (level >= 16) baseHeight = 2400;
          else baseHeight = 1500;

          const targetHeight = Math.max(baseHeight, surfaceHeight + baseHeight);

          const targetPosition = Cesium.Cartesian3.fromRadians(lon, lat, targetHeight, Cesium.Ellipsoid.MOON);
          const startPosition = Cesium.Cartesian3.clone(viewer.camera.position);
          const startHeading = viewer.camera.heading, startPitch = viewer.camera.pitch;
          const targetPitch = Cesium.Math.toRadians(-90);
          const duration = 1200;
          let startTime = null;
          let midFired = false;

          function animate(timestamp) {
              if (!startTime) startTime = timestamp;
              const progress = (timestamp - startTime) / duration;
              // 30% 시점에 콜백 실행 (그리드 재렌더)
              if (!midFired && progress >= 0.3 && onMidFlight) {
                  midFired = true;
                  onMidFlight();
              }
              if (progress >= 1.0) {
                  viewer.camera.setView({ destination: targetPosition, orientation: { heading: startHeading, pitch: targetPitch, roll: 0 } });
                  currentAnimFrame = null;
                  if (!midFired && onMidFlight) onMidFlight(); // 안전장치
                  return;
              }
              const t = 1 - Math.pow(1 - progress, 3);
              const currentPos = new Cesium.Cartesian3();
              Cesium.Cartesian3.lerp(startPosition, targetPosition, t, currentPos);
              const currentPitch = Cesium.Math.lerp(startPitch, targetPitch, t);
              viewer.camera.setView({ destination: currentPos, orientation: { heading: startHeading, pitch: currentPitch, roll: 0 } });
              currentAnimFrame = requestAnimationFrame(animate);
          }
          currentAnimFrame = requestAnimationFrame(animate);
      }

      // 카메라 줌 시 실시간 고도 업데이트
      viewer.camera.changed.addEventListener(function() {
          if (mainMode !== 'occupation') return;
          var debugEl = document.getElementById('debugPanel');
          if (!debugEl) return;
          var hEl = debugEl.querySelector('#camHeightLive');
          var _cc = Cesium.Cartographic.fromCartesian(viewer.camera.position, Cesium.Ellipsoid.MOON);
          var camH = _cc ? _cc.height : 0;
          var hStr = camH > 1000000 ? (camH / 1000000).toFixed(2) + ' Mm' : camH > 1000 ? (camH / 1000).toFixed(1) + ' km' : camH.toFixed(0) + ' m';
          if (hEl) { hEl.innerHTML = hStr + ' (' + Math.round(camH) + ' m)'; }
      });
      viewer.camera.percentageChanged = 0.01;
`;
