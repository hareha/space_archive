// cesiumControlsTR.js — Terrain 모드 컨트롤 (점유모드3 전용)
// 점유모드1·2와 완전 독립. monkey-patch 없음.

export const CESIUM_CONTROLS_TR = `
      // ═══════════════════════════════════════════════════
      // Terrain Mode Controller (cesiumControlsTR.js)
      // 점유모드3 전용 — 독립 함수 정의, monkey-patch 없음
      // ═══════════════════════════════════════════════════

      // --- TR 전용 flashCell (독립 정의) ---
      function flashCellTR(cellId) {
          flashPrimitives.removeAll();
          var cell = s2.Cell.fromCellID(cellId);
          var cc = cell.center();
          var ccr = Math.sqrt(cc.x ** 2 + cc.y ** 2 + cc.z ** 2);
          var centerCart = Cesium.Cartesian3.fromRadians(
              Math.atan2(cc.y, cc.x), Math.asin(cc.z / ccr), TR_FIXED_HEIGHT, Cesium.Ellipsoid.MOON
          );
          var FLASH_INSET = 0.92;
          var insetPositions = [];
          for (var i = 0; i < 4; i++) {
              var v = cell.vertex(i);
              var r = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
              var vertCart = Cesium.Cartesian3.fromRadians(
                  Math.atan2(v.y, v.x), Math.asin(v.z / r), TR_FIXED_HEIGHT, Cesium.Ellipsoid.MOON
              );
              insetPositions.push(new Cesium.Cartesian3(
                  centerCart.x + (vertCart.x - centerCart.x) * FLASH_INSET,
                  centerCart.y + (vertCart.y - centerCart.y) * FLASH_INSET,
                  centerCart.z + (vertCart.z - centerCart.z) * FLASH_INSET
              ));
          }
          flashPrimitives.add(new Cesium.Primitive({
              geometryInstances: new Cesium.GeometryInstance({
                  geometry: new Cesium.PolygonGeometry({
                      polygonHierarchy: new Cesium.PolygonHierarchy(insetPositions),
                      ellipsoid: Cesium.Ellipsoid.MOON,
                      height: TR_FIXED_HEIGHT,
                  }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                      Cesium.Color.WHITE.withAlpha(0.5)
                  )}
              }),
              appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
              asynchronous: false
          }));
          setTimeout(function() { flashPrimitives.removeAll(); }, 600);
      }

      // --- TR 전용 flyToCell (고정높이 전용) ---
      function flyToCellTR(targetCellId, onComplete) {
          if (currentAnimFrame) { cancelAnimationFrame(currentAnimFrame); currentAnimFrame = null; }
          _isFlyingTo = true;
          var cell = s2.Cell.fromCellID(targetCellId);
          var center = cell.center();
          var r = Math.sqrt(center.x ** 2 + center.y ** 2 + center.z ** 2);
          var lon = Math.atan2(center.y, center.x), lat = Math.asin(center.z / r);
          var level = s2.cellid.level(targetCellId);

          var baseHeight;
          if (level <= 4) baseHeight = 250000;
          else if (level <= 8) baseHeight = 28000;
          else if (level <= 12) baseHeight = 11000;
          else if (level <= 14) baseHeight = 10400;
          else if (level <= 15) baseHeight = 10250;
          else baseHeight = 10150;

          var targetPosition = Cesium.Cartesian3.fromRadians(lon, lat, baseHeight, Cesium.Ellipsoid.MOON);
          var startPosition = Cesium.Cartesian3.clone(viewer.camera.position);
          var startHeading = viewer.camera.heading, startPitch = viewer.camera.pitch;
          var targetPitch = Cesium.Math.toRadians(-90);
          var duration = 1200;
          var startTime = null;

          function animFrame(time) {
              if (!startTime) startTime = time;
              var t = Math.min((time - startTime) / duration, 1);
              var ease = t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
              viewer.camera.position = Cesium.Cartesian3.lerp(startPosition, targetPosition, ease, new Cesium.Cartesian3());
              viewer.camera.setView({
                  orientation: {
                      heading: startHeading,
                      pitch: Cesium.Math.lerp(startPitch, targetPitch, ease),
                      roll: 0
                  }
              });
              if (t < 1) { currentAnimFrame = requestAnimationFrame(animFrame); }
              else {
                  currentAnimFrame = null;
                  _isFlyingTo = false;
                  if (typeof onComplete === 'function') onComplete();
              }
          }
          currentAnimFrame = requestAnimationFrame(animFrame);
      }

      // --- TR 전용 클릭 핸들러 ---
      var trClickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      trClickHandler.setInputAction(function(movement) {
          if (mainMode !== 'occupation3') return;

          var picked = viewer.scene.pick(movement.position);
          if (!Cesium.defined(picked) || !picked.id) return;
          var pickedCellId = picked.id;

          var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;

          if (currentLevel >= 12) {
              // 3단계: 다중선택
              var clickedL16 = pickedCellId;
              var parentAtSelectLvl = s2.cellid.parent(clickedL16, selectLevel);
              var selectedCells = (selectLevel === 16) ? [clickedL16] : getDescendantsTR(parentAtSelectLvl, 16);
              if (selectedCells.length === 0) return;

              var hasOccupied = selectedCells.some(function(cid) {
                  return occupiedTokens.indexOf(s2.cellid.toToken(cid)) !== -1;
              });
              if (hasOccupied) return;

              if (!window.multiSelectedL16) window.multiSelectedL16 = [];
              var groupTokens = selectedCells.map(function(c) { return s2.cellid.toToken(c); });
              var isAlreadySelected = groupTokens.every(function(t) {
                  return window.multiSelectedL16.indexOf(t) !== -1;
              });
              if (isAlreadySelected) {
                  groupTokens.forEach(function(t) {
                      var i = window.multiSelectedL16.indexOf(t);
                      if (i !== -1) window.multiSelectedL16.splice(i, 1);
                  });
              } else {
                  var newTotal = window.multiSelectedL16.length + groupTokens.length;
                  var balance = (typeof window.magBalance !== 'undefined') ? window.magBalance : 40;
                  if (newTotal > balance) {
                      sendToRN('MAG_EXCEEDED', { needed: newTotal, balance: balance });
                      return;
                  }
                  groupTokens.forEach(function(t) {
                      if (window.multiSelectedL16.indexOf(t) === -1) {
                          window.multiSelectedL16.push(t);
                      }
                  });
              }
              if (window.multiSelectedL16.length === 0) {
                  sendToRN('CELL_DESELECTED', {});
                  renderTerrain();
                  return;
              }
              var mFirstToken = window.multiSelectedL16[0];
              var mCenter = s2.Cell.fromCellID(clickedL16).center();
              var mR = Math.sqrt(mCenter.x**2+mCenter.y**2+mCenter.z**2);
              sendToRN('CELL_SELECTED', {
                  cellId: mFirstToken, token: mFirstToken,
                  lat: parseFloat((Math.asin(mCenter.z / mR) * 180 / Math.PI).toFixed(2)),
                  lng: parseFloat((Math.atan2(mCenter.y, mCenter.x) * 180 / Math.PI).toFixed(2)),
                  level: selectLevel, childLevel: 16,
                  cellCount: window.multiSelectedL16.length,
                  unit: window.multiSelectedL16.length + ' Block = ' + window.multiSelectedL16.length + ' Mag',
                  magCount: window.multiSelectedL16.length,
                  price: '\\\\\\\\$' + window.multiSelectedL16.length,
                  area: '~' + (0.8 * window.multiSelectedL16.length).toFixed(1) + ' km\\\\\\\\u00B2',
                  multiTokens: window.multiSelectedL16.slice(),
                  isMultiSelect: window.multiSelectedL16.length > 1
              });
              window.multiSelectedL16.forEach(function(tk) {
                  var cid2 = s2.cellid.fromToken(tk);
                  var positions = getTRCellPositions(cid2, TR_FIXED_HEIGHT + 1, 1);
                  trGridPrimitives.add(new Cesium.Primitive({
                      geometryInstances: new Cesium.GeometryInstance({
                          geometry: new Cesium.PolygonGeometry({
                              polygonHierarchy: new Cesium.PolygonHierarchy(positions),
                              ellipsoid: Cesium.Ellipsoid.MOON,
                              height: TR_FIXED_HEIGHT + 1,
                          }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                              new Cesium.Color(0.15, 0.45, 0.95, 0.45)
                          )}
                      }),
                      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                      asynchronous: true,
                  }));
              });
          } else {
              // 0~2단계: 드릴다운
              var cellId = pickedCellId;
              var lvl = s2.cellid.level(cellId);
              if (lvl <= 0) return;

              console.log('[TR] Drill down: level ' + currentLevel + ' → cell level ' + lvl);
              selectionStack.push(cellId);

              // 즉시 그리드 렌더 + 줌인
              renderTerrain();
              _lastCameraCenterToken = s2.cellid.toToken(cellId); // flyTo 후 중복 재렌더 방지
              flyToCellTR(cellId);
              flashCellTR(cellId);
          }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // --- ENTER_TR_MODE / EXIT_TR_MODE 메시지 핸들러 ---
      function handleTRMessage(event) {
          try {
              var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
              if (msg.type === 'ENTER_TR_MODE') {
                  console.log('[TR] ENTER_TR_MODE, tilesetReady:', window.tilesetReady);
                  // TR 전용 primitives만 클리어 (모드1·2 건드리지 않음)
                  trGridPrimitives.removeAll();

                  function doRenderWhenReady() {
                      if (!window.tilesetReady) {
                          console.log('[TR] Tileset not ready, waiting...');
                          setTimeout(doRenderWhenReady, 500);
                          return;
                      }
                      console.log('[TR] Tileset ready, rendering terrain grid');
                      renderTerrain();
                      // TR 모드 진입 시 카메라 줌인
                      setTimeout(function() {
                          var camCart = Cesium.Cartographic.fromCartesian(viewer.camera.position, Cesium.Ellipsoid.MOON);
                          if (camCart) {
                              viewer.camera.flyTo({
                                  destination: Cesium.Cartesian3.fromRadians(camCart.longitude, camCart.latitude, 4000000, Cesium.Ellipsoid.MOON),
                                  orientation: { heading: viewer.camera.heading, pitch: Cesium.Math.toRadians(-90), roll: 0 },
                                  duration: 1.0
                              });
                          }
                      }, 500);
                  }
                  doRenderWhenReady();
              }
              if (msg.type === 'EXIT_TR_MODE') {
                  console.log('[TR] EXIT_TR_MODE');
                  trGridPrimitives.removeAll();
                  trNeighborPrimitives.removeAll();
                  // 이벤트 리스너 정리
                  if (_trTileListener && window.moonTileset) {
                      try { window.moonTileset.allTilesLoaded.removeEventListener(_trTileListener); } catch(e) {}
                      _trTileListener = null;
                  }
              }
              if (msg.type === 'RECALC_TERRAIN') {
                  console.log('[TR] RECALC_TERRAIN — 지형 높이 재계산');
                  renderTerrain(true); // sync=true 즉시 렌더
              }
          } catch(e) {
              console.error('[TR] handleTRMessage error:', e);
          }
      }
      document.addEventListener('message', handleTRMessage);
      window.addEventListener('message', handleTRMessage);
`;
