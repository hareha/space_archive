// cesiumControlsTest2.js — Terrain 모드 컨트롤 (테스트2모드 전용)
// 점유모드1·2와 완전 독립. monkey-patch 없음.

export const CESIUM_CONTROLS_TEST2 = `
      // ═══════════════════════════════════════════════════
      // Terrain Mode Controller (cesiumControlsTest2.js)
      // 테스트2모드 전용 — 독립 함수 정의, monkey-patch 없음
      // ═══════════════════════════════════════════════════

      // --- TR 전용 flash PrimitiveCollection (모드1 flashPrimitives와 완전 분리) ---
      var trFlashPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      var _flashTimer = null;
      function flashCellTR(cellId) {
          trFlashPrimitives.removeAll();
          if (_flashTimer) { clearTimeout(_flashTimer); _flashTimer = null; }
          var cell = s2.Cell.fromCellID(cellId);
          var cc = cell.center();
          var ccr = Math.sqrt(cc.x ** 2 + cc.y ** 2 + cc.z ** 2);

          var FLASH_INSET = 0.92;
          var insetPositions = [];
          var useTerrainHeight = (selectionStack.length > 0);

          if (useTerrainHeight) {
              // 1단계 이상: 지형 보간 기반
              var lastCellId = selectionStack[selectionStack.length - 1];
              var parentLevel = s2.cellid.level(lastCellId);
              var actualParent = s2.cellid.parent(cellId, parentLevel);
              var refVerts = sampleCellVertices(actualParent);
              var ccLat = Math.asin(cc.z / ccr);
              var ccLon = Math.atan2(cc.y, cc.x);
              var centerCart = terrainCartesian(ccLat, ccLon, refVerts);
              for (var i = 0; i < 4; i++) {
                  var v = cell.vertex(i);
                  var r = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                  var vertCart = terrainCartesian(Math.asin(v.z/r), Math.atan2(v.y,v.x), refVerts);
                  insetPositions.push(new Cesium.Cartesian3(
                      centerCart.x + (vertCart.x - centerCart.x) * FLASH_INSET,
                      centerCart.y + (vertCart.y - centerCart.y) * FLASH_INSET,
                      centerCart.z + (vertCart.z - centerCart.z) * FLASH_INSET
                  ));
              }
          } else {
              // 0단계: TR_FIXED_HEIGHT 기반 (지형보간 불필요)
              var centerCart = Cesium.Cartesian3.fromRadians(
                  Math.atan2(cc.y, cc.x), Math.asin(cc.z / ccr), TR_FIXED_HEIGHT, Cesium.Ellipsoid.MOON
              );
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
          }

          // 흡색 점멸 1회
          trFlashPrimitives.removeAll();
          trFlashPrimitives.add(new Cesium.Primitive({
              geometryInstances: new Cesium.GeometryInstance({
                  geometry: new Cesium.PolygonGeometry({
                      polygonHierarchy: new Cesium.PolygonHierarchy(insetPositions),
                      ellipsoid: Cesium.Ellipsoid.MOON,
                      perPositionHeight: useTerrainHeight ? true : undefined,
                      height: useTerrainHeight ? undefined : TR_FIXED_HEIGHT,
                  }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                      new Cesium.Color(1.0, 1.0, 1.0, 0.6)
                  )}
              }),
              appearance: new Cesium.PerInstanceColorAppearance({
                  flat: true, translucent: true,
                  renderState: { depthTest: { enabled: false }, depthMask: false }
              }),
              asynchronous: false
          }));
          _flashTimer = setTimeout(function() {
              trFlashPrimitives.removeAll();
              _flashTimer = null;
          }, 250);
      }

      // --- TR 전용 flyToCell (고정높이 전용) ---
      function flyToCellTR(targetCellId, onComplete, onMidFlight) {
          if (currentAnimFrame) { cancelAnimationFrame(currentAnimFrame); currentAnimFrame = null; }
          _isFlyingTo = true;
          var cell = s2.Cell.fromCellID(targetCellId);
          var center = cell.center();
          var r = Math.sqrt(center.x ** 2 + center.y ** 2 + center.z ** 2);
          var lon = Math.atan2(center.y, center.x), lat = Math.asin(center.z / r);
          var level = s2.cellid.level(targetCellId);

          var baseHeight;
          if (level <= 4) baseHeight = 250000;
          else if (level <= 8) baseHeight = 18000;
          else if (level <= 12) {
              // 3단계: 셀 중앙의 지형 높이 + 1200m
              var terrainH = viewer.scene.sampleHeight(new Cesium.Cartographic(lon, lat));
              if (terrainH !== undefined && terrainH !== null && !isNaN(terrainH)) {
                  baseHeight = terrainH + 1000;

              } else if (_lastKnownTerrainH !== 0) {
                  // sampleHeight 실패 → 글로벌 폴백 사용
                  baseHeight = _lastKnownTerrainH + 1000;

              } else {
                  baseHeight = 1500;

              }
          }
          else if (level <= 14) baseHeight = 800;
          else if (level <= 15) baseHeight = 400;
          else baseHeight = 200;

          var targetPosition = Cesium.Cartesian3.fromRadians(lon, lat, baseHeight, Cesium.Ellipsoid.MOON);
          var startPosition = Cesium.Cartesian3.clone(viewer.camera.position);
          var startHeading = viewer.camera.heading, startPitch = viewer.camera.pitch;
          var targetPitch = Cesium.Math.toRadians(-90);
          var duration = 1200;
          var startTime = null;
          var midFired = false;

          function animFrame(time) {
              if (!startTime) startTime = time;
              var t = Math.min((time - startTime) / duration, 1);
              var ease = t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
              // 70% 시점에서 중간 콜백 (fly 완료 ~360ms 전)
              if (!midFired && t >= 0.70 && typeof onMidFlight === 'function') {
                  midFired = true;
                  onMidFlight();
              }
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
          if (mainMode !== 'test2') return;
          if (_isFlyingTo || _gridExpandFrame || _gridShrinkFrame) return; // 애니메이션 중 입력 차단

          var picked = null;
          var drillResults = viewer.scene.drillPick(movement.position);
          for (var di = 0; di < drillResults.length; di++) {
              if (Cesium.defined(drillResults[di]) && drillResults[di].id && typeof drillResults[di].id !== 'string') {
                  picked = drillResults[di]; break;
              }
          }
          if (!picked || !picked.id) return;
          var pickedCellId = picked.id;

          var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;

          if (currentLevel >= 12) {
              // 3단계: 개별 L16 셀 토글 선택 (개척모드 동기화)
              var clickedL16 = pickedCellId;
              var pickedLevel = s2.cellid.level(clickedL16);
              var targetL16 = (pickedLevel === 16) ? clickedL16 : (pickedLevel < 16 ? getDescendantsTR(clickedL16, 16)[0] : s2.cellid.parent(clickedL16, 16));
              if (!targetL16) return;

              var targetToken = s2.cellid.toToken(targetL16);
              flashCellTR(targetL16);

              // 이미 점유된 셀 → 선택하지 않고 정보만 전송
              var isOccupied = occupiedTokens.indexOf(targetToken) !== -1;
              var isMyTerritory = (typeof myOccupiedTokens !== 'undefined') && myOccupiedTokens.indexOf(targetToken) !== -1;
              if (isOccupied) {
                  var occ2 = s2.Cell.fromCellID(targetL16).center();
                  var occr2 = Math.sqrt(occ2.x**2+occ2.y**2+occ2.z**2);
                  sendToRN('CELL_SELECTED', {
                      cellId: targetToken, token: targetToken,
                      lat: parseFloat((Math.asin(occ2.z / occr2) * 180 / Math.PI).toFixed(2)),
                      lng: parseFloat((Math.atan2(occ2.y, occ2.x) * 180 / Math.PI).toFixed(2)),
                      level: 16, childLevel: 16,
                      magCount: 1, area: '~0.8 km²',
                      isOccupied: true,
                      isMyTerritory: isMyTerritory
                  });
                  return;
              }

              if (!window.multiSelectedL16) window.multiSelectedL16 = [];

              var existingIdx = window.multiSelectedL16.indexOf(targetToken);
              if (existingIdx !== -1) {
                  // 이미 선택됨 → 토글 제거
                  window.multiSelectedL16.splice(existingIdx, 1);
              } else {
                  // mag 초과 체크
                  var newTotal = window.multiSelectedL16.length + 1;
                  var balance = (typeof window.magBalance !== 'undefined') ? window.magBalance : 40;
                  if (newTotal > balance) {
                      sendToRN('MAG_EXCEEDED', { needed: newTotal, balance: balance });
                      return;
                  }
                  window.multiSelectedL16.push(targetToken);
              }

              if (window.multiSelectedL16.length === 0) {
                  // 선택 해제 — 선택 하이라이트만 제거 (그리드 보존)
                  if (window.trSelectionPrimMap) {
                      var spKeys = Object.keys(window.trSelectionPrimMap);
                      for (var spi = 0; spi < spKeys.length; spi++) {
                          try { trGridPrimitives.remove(window.trSelectionPrimMap[spKeys[spi]]); } catch(e) {}
                      }
                      window.trSelectionPrimMap = {};
                  }
                  sendToRN('CELL_DESELECTED', {});
                  return;
              }

              // 선택 정보 전송
              var firstToken = window.multiSelectedL16[0];
              var cc2 = s2.Cell.fromCellID(targetL16).center();
              var ccr2 = Math.sqrt(cc2.x**2+cc2.y**2+cc2.z**2);
              var multiLats = [];
              var multiLngs = [];
              window.multiSelectedL16.forEach(function(tk) {
                  var tkCid = s2.cellid.fromToken(tk);
                  var tkCenter = s2.Cell.fromCellID(tkCid).center();
                  var tkR = Math.sqrt(tkCenter.x**2+tkCenter.y**2+tkCenter.z**2);
                  multiLats.push(parseFloat((Math.asin(tkCenter.z / tkR) * 180 / Math.PI).toFixed(3)));
                  multiLngs.push(parseFloat((Math.atan2(tkCenter.y, tkCenter.x) * 180 / Math.PI).toFixed(3)));
              });
              sendToRN('CELL_SELECTED', {
                  cellId: firstToken, token: firstToken,
                  lat: parseFloat((Math.asin(cc2.z / ccr2) * 180 / Math.PI).toFixed(2)),
                  lng: parseFloat((Math.atan2(cc2.y, cc2.x) * 180 / Math.PI).toFixed(2)),
                  level: 16, childLevel: 16,
                  cellCount: window.multiSelectedL16.length,
                  unit: window.multiSelectedL16.length + ' Block = ' + window.multiSelectedL16.length + ' Mag',
                  magCount: window.multiSelectedL16.length,
                  price: '$' + window.multiSelectedL16.length,
                  area: '~' + (0.8 * window.multiSelectedL16.length).toFixed(1) + ' km²',
                  multiTokens: window.multiSelectedL16.slice(),
                  multiLats: multiLats,
                  multiLngs: multiLngs,
                  isMultiSelect: window.multiSelectedL16.length > 1
              });

              // 선택 플래시 피드백
              flashCellTR(targetL16);

              // 선택 하이라이트 관리 (개별 primitive)
              if (!window.trSelectionPrimMap) window.trSelectionPrimMap = {};

              if (existingIdx !== -1) {
                  // 제거된 셀 primitive 삭제
                  if (window.trSelectionPrimMap[targetToken]) {
                      trGridPrimitives.remove(window.trSelectionPrimMap[targetToken]);
                      delete window.trSelectionPrimMap[targetToken];
                  }
              } else {
                  // 새 셀 primitive 추가 (파란색 — 선택)
                  if (!window.trSelectionPrimMap[targetToken]) {
                      var cid = s2.cellid.fromToken(targetToken);
                      var cell = s2.Cell.fromCellID(cid);
                      // 클릭 셀의 실제 부모 (같은 레벨) 기준으로 보간
                      var lastCid = selectionStack.length > 0 ? selectionStack[selectionStack.length - 1] : cid;
                      var pLvl = s2.cellid.level(lastCid);
                      var actualParent = s2.cellid.parent(cid, pLvl);
                      var refVerts = sampleCellVertices(actualParent);
                      var positions = [];
                      for (var vi = 0; vi < 4; vi++) {
                          var v = cell.vertex(vi);
                          var vr = Math.sqrt(v.x**2+v.y**2+v.z**2);
                          var vlat = Math.asin(v.z / vr);
                          var vlon = Math.atan2(v.y, v.x);
                          positions.push(terrainCartesian(vlat, vlon, refVerts));
                      }
                      var prim = trGridPrimitives.add(new Cesium.Primitive({
                          geometryInstances: new Cesium.GeometryInstance({
                              geometry: new Cesium.PolygonGeometry({
                                  polygonHierarchy: new Cesium.PolygonHierarchy(positions),
                                  ellipsoid: Cesium.Ellipsoid.MOON,
                                  perPositionHeight: true,
                              }),
                              attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                                  new Cesium.Color(0.15, 0.45, 0.95, 0.45)
                              )}
                          }),
                          appearance: new Cesium.PerInstanceColorAppearance({
                              flat: true, translucent: true,
                              renderState: { depthTest: { enabled: false }, depthMask: false }
                          }),
                          asynchronous: true,
                      }));
                      window.trSelectionPrimMap[targetToken] = prim;
                  }
              }
          } else {
              // 0~2단계: 드릴다운
              var cellId = pickedCellId;
              var lvl = s2.cellid.level(cellId);
              if (lvl <= 0) return;


              // push 전에 기존 카메라 추적 리스너 해제 (race condition 방지)
              stopCameraTracking();
              stopL0CameraTracking();
              _isFlyingTo = true; // 전환 완료까지 모든 renderDynamicGrid 차단
              // 먼저 플래시 (현재 그리드 위에서 보이게)
              flashCellTR(cellId);
              selectionStack.push(cellId);

              var isFromL0 = (currentLevel === 0);
              renderTerrain(true, isFromL0);
              _lastCameraCenterToken = s2.cellid.toToken(cellId);
              // 사전 캐싱: fly 시작 전에 높이 캐시 워밍
              var neighbors = getCellNeighborsTR(cellId);
              for (var ni = 0; ni < neighbors.length; ni++) sampleCellVertices(neighbors[ni]);
              flyToCellTR(cellId, function() {
                  startCameraTracking();
              }, function() {
                  // midFlight(70%): 줄인 완료 ~360ms 전에 그리드 렌더
                  _isFlyingTo = false;
                  renderDynamicGrid(null, 'expand');
                  _isFlyingTo = true;
              });
          }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // --- ENTER_TEST2_MODE / EXIT_TEST2_MODE 메시지 핸들러 ---
      function handleTRMessage(event) {
          try {
              var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
              if (msg.type === 'ENTER_TEST2_MODE') {

                  // TR 전용 primitives만 클리어 (모드1·2 건드리지 않음)
                  trGridPrimitives.removeAll();
                  window.multiSelectedL16 = [];
                  window.trSelectionPrimMap = {};
                  // 개척모드2에서만 카메라 틸트 해제
                  viewer.scene.screenSpaceCameraController.enableTilt = true;

                  function doRenderWhenReady() {
                      if (!window.tilesetReady) {

                          setTimeout(doRenderWhenReady, 500);
                          return;
                      }

                      renderTerrain(); // 초기 진입: 전체 초기화
                  }
                  doRenderWhenReady();
              }
              if (msg.type === 'EXIT_TEST2_MODE') {

                  trGridPrimitives.removeAll();
                  trNeighborPrimitives.removeAll();
                  trFlashPrimitives.removeAll();
                  window.multiSelectedL16 = [];
                  window.trSelectionPrimMap = {};
                  stopL0CameraTracking();
                  // 카메라 틸트 다시 잠그기
                  viewer.scene.screenSpaceCameraController.enableTilt = false;
                  // 이벤트 리스너 정리
                  if (_trTileListener && window.moonTileset) {
                      try { window.moonTileset.allTilesLoaded.removeEventListener(_trTileListener); } catch(e) {}
                      _trTileListener = null;
                  }
              }
              if (msg.type === 'SELECT_CENTER_CELL') {
                  if (_isFlyingTo || _gridExpandFrame || _gridShrinkFrame) return; // 애니메이션 중 입력 차단
                  // + 버튼: 화면 중앙 셀을 선택하여 드릴다운
                  var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
                  var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;
                  if (currentLevel >= 12) return; // 3단계 이상이면 무시

                  var canvas = viewer.scene.canvas;
                  var cx = Math.floor(canvas.clientWidth / 2);
                  var cy = Math.floor(canvas.clientHeight / 2);
                  var ray = viewer.camera.getPickRay(new Cesium.Cartesian2(cx, cy));
                  if (!ray) return;
                  var intersection = Cesium.IntersectionTests.rayEllipsoid(ray, Cesium.Ellipsoid.MOON);
                  if (!intersection) return;
                  var point = Cesium.Ray.getPoint(ray, intersection.start);
                  var carto = Cesium.Cartographic.fromCartesian(point, Cesium.Ellipsoid.MOON);
                  var cosLat = Math.cos(carto.latitude);
                  var s2Pt = s2.Point.fromCoords(cosLat * Math.cos(carto.longitude), cosLat * Math.sin(carto.longitude), Math.sin(carto.latitude));
                  var leafId = s2.cellid.fromPoint(s2Pt);

                  var depth = selectionStack.length;
                  var targetLevel = depth === 0 ? 4 : depth === 1 ? 8 : 12;
                  var cellId = s2.cellid.parent(leafId, targetLevel);

                  // push 전에 기존 카메라 추적 리스너 해제 (race condition 방지)
                  stopCameraTracking();
                  stopL0CameraTracking();
                  _isFlyingTo = true; // 전환 완료까지 모든 renderDynamicGrid 차단
                  flashCellTR(cellId);
                  selectionStack.push(cellId);
                  renderTerrain(true, true); // L0 그리드도 보존 (expand 애니메이션에서 페이드아웃)
                  _lastCameraCenterToken = s2.cellid.toToken(cellId);
                  // 사전 캐싱: fly 시작 전에 높이 캐시 워밍
                  var neighbors2 = getCellNeighborsTR(cellId);
                  for (var ni2 = 0; ni2 < neighbors2.length; ni2++) sampleCellVertices(neighbors2[ni2]);
                  flyToCellTR(cellId, function() {
                      startCameraTracking();
                  }, function() {
                      // midFlight(70%): 줄인 완료 ~360ms 전에 그리드 렌더
                      _isFlyingTo = false;
                      renderDynamicGrid(null, 'expand');
                      _isFlyingTo = true;
                  });
              }
              if (msg.type === 'GO_BACK') {
                  if (selectionStack.length === 0) return;
                  if (_isFlyingTo || _gridExpandFrame || _gridShrinkFrame) return; // 애니메이션 중 입력 차단
                  stopCameraTracking();
                  _isFlyingTo = true;

                  // 1) 현재 자식 그리드 참조 + wireframe 좌표 수집
                  var childEntries = {};
                  var childWireframe = [];
                  var childTokens = Object.keys(_renderedCellMap);
                  // 현재 중심 셀 기준으로 거리 계산
                  var goBackCenter = selectionStack[selectionStack.length - 1];
                  var goBackCenterCoord = getS2CellCenter(goBackCenter);

                  for (var ci = 0; ci < childTokens.length; ci++) {
                      childEntries[childTokens[ci]] = _renderedCellMap[childTokens[ci]];
                      // 자식 셀의 세부그리드 wireframe 수집
                      var cCid = s2.cellid.fromToken(childTokens[ci]);
                      var cLvl = s2.cellid.level(cCid);
                      var cTgt = Math.min(cLvl + 4, 16);
                      var cKids = getDescendantsTR(cCid, cTgt);
                      var cVerts = sampleCellVertices(cCid);
                      for (var ck = 0; ck < cKids.length; ck++) {
                          var chc = s2.Cell.fromCellID(cKids[ck]);
                          var cpp = [];
                          for (var cj = 0; cj < 4; cj++) {
                              var cv = chc.vertex(cj);
                              var cvr = Math.sqrt(cv.x*cv.x + cv.y*cv.y + cv.z*cv.z);
                              cpp.push(terrainCartesian(Math.asin(cv.z/cvr), Math.atan2(cv.y, cv.x), cVerts));
                          }
                          var cpos = cpp.slice(); cpos.push(cpos[0].clone());
                          var ec = getS2CellCenter(cKids[ck]);
                          var d = s2CellDistance(goBackCenterCoord, ec);
                          childWireframe.push({ pos: cpos, distance: d });
                      }
                  }
                  _renderedCellMap = {};

                  // 2) stack pop → 부모 레벨로
                  selectionStack.pop();
                  window.multiSelectedL16 = [];
                  // 선택 하이라이트 정리
                  if (window.trSelectionPrimMap) {
                      var spk = Object.keys(window.trSelectionPrimMap);
                      for (var spi2 = 0; spi2 < spk.length; spi2++) {
                          try { trGridPrimitives.remove(window.trSelectionPrimMap[spk[spi2]]); } catch(e) {}
                      }
                      window.trSelectionPrimMap = {};
                  }
                  sendToRN('CELL_DESELECTED', {});
                  renderTerrain(true); // keepNeighbors: 자식 primitive 보존

                  if (selectionStack.length > 0) {
                      var parentLevel = s2.cellid.level(selectionStack[selectionStack.length - 1]);
                      var goCarto = Cesium.Cartographic.fromCartesian(viewer.camera.position, Cesium.Ellipsoid.MOON);
                      if (goCarto) {
                          var goLon = goCarto.longitude, goLat = goCarto.latitude;
                          var goCosLat = Math.cos(goLat);
                          var goPt = s2.Point.fromCoords(goCosLat * Math.cos(goLon), goCosLat * Math.sin(goLon), Math.sin(goLat));
                          var currentParentCell = s2.cellid.parent(s2.cellid.fromPoint(goPt), parentLevel);
                          selectionStack[selectionStack.length - 1] = currentParentCell;
                      }
                      var targetCell = selectionStack[selectionStack.length - 1];

                      // 3) 부모 그리드 즉시 렌더 (보이는 상태)
                      _isFlyingTo = false;
                      renderDynamicGrid();

                      // 4) 자식 축소 애니메이션 + 카메라 flyout 동시 시작
                      animateGridShrink(goBackCenter, childWireframe, childEntries, function() {
                          // 축소 완료 (자식 primitive는 이미 제거됨)
                      });
                      _isFlyingTo = true;
                      flyToCellTR(targetCell, function() {
                          // fly 완료: 셀맵+높이캐시 클리어 → 정확한 높이로 강제 재렌더
                          clearRenderedCellMap();
                          renderDynamicGrid();
                          startCameraTracking();
                      });
                  } else {
                      // depth 0으로 복귀: 자식 축소 애니메이션
                      _isFlyingTo = false;
                      clearRenderedCellMap(); // 경계선 포함 전체 정리
                      animateGridShrink(goBackCenter, childWireframe, childEntries, function() {
                          // 축소 완료
                      });
                      try { viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); } catch(e) {}
                      viewer.camera.cancelFlight();
                      if (moonTileset) viewer.camera.flyToBoundingSphere(moonTileset.boundingSphere, { duration: 1.0 });
                  }
                  sendToRN('DEPTH_CHANGED', { depth: selectionStack.length });
              }
              if (msg.type === 'RECALC_TERRAIN') {

                  renderTerrain(true); // RECALC: 기존 세부그리드 유지
              }


          } catch(e) {
              console.error('[TR] handleTRMessage error:', e);
          }
      }
      document.addEventListener('message', handleTRMessage);
      window.addEventListener('message', handleTRMessage);
`;
