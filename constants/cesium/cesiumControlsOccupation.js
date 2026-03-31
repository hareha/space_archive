// cesiumControlsOccupation.js — 개척 모드 컨트롤
// 점유모드1·2와 완전 독립. monkey-patch 없음.

export const CESIUM_CONTROLS_OCCUPATION = `
      // ═══════════════════════════════════════════════════
      // Occupation Mode Controller (cesiumControlsOccupation.js)
      // 개척모드 전용 — 독립 함수 정의, monkey-patch 없음
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

      // --- 점유 셀 정보 팝업 (HTML 오버레이) ---
      var _occPopupEl = document.getElementById('occInfoPopup');
      var _occPreRenderHandler = null;

      function _showOccPopup(cartesian3Pos, token, lat, lng, isMine) {
          // 기존 팝업 닫기
          _hideOccPopup();
          window._occInfoToken = token;
          window._occInfoPos = cartesian3Pos;

          // 팝업 내용 설정
          var statusEl = document.getElementById('occStatusText');
          statusEl.textContent = isMine ? 'MY TERRITORY' : 'OCCUPIED';
          statusEl.className = 'occ-status ' + (isMine ? 'mine' : 'other');
          document.getElementById('occTokenText').textContent = token;
          document.getElementById('occCoordText').textContent = lat.toFixed(4) + ', ' + lng.toFixed(4);
          // 소유자 정보는 RN 응답 후 표시
          document.getElementById('occOwnerRow').style.display = 'none';

          // preRender에서 매 프레임 2D 위치 갱신
          _occPreRenderHandler = viewer.scene.preRender.addEventListener(function() {
              if (!window._occInfoPos || !_occPopupEl) return;
              var screenPos = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, window._occInfoPos);
              if (screenPos) {
                  _occPopupEl.style.left = screenPos.x + 'px';
                  _occPopupEl.style.top = (screenPos.y - 18) + 'px';
                  _occPopupEl.style.display = 'block';
              } else {
                  _occPopupEl.style.display = 'none';
              }
          });
      }

      function _hideOccPopup() {
          if (_occPopupEl) _occPopupEl.style.display = 'none';
          if (_occPreRenderHandler) { _occPreRenderHandler(); _occPreRenderHandler = null; }
          // 점유 셀 하이라이트 제거
          if (window._occHighlightPrim) {
              try { trGridPrimitives.remove(window._occHighlightPrim); } catch(e) {}
              window._occHighlightPrim = null;
          }
          window._occInfoToken = null;
          window._occInfoPos = null;
      }
      // 하위 호환
      function _removeOccInfoLabel() { _hideOccPopup(); }

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

              // 이미 점유된 셀 → 선택 집계 영향 없이 팝업 표시
              var isOccupied = occupiedTokens.indexOf(targetToken) !== -1;
              var isMyTerritory = (typeof myOccupiedTokens !== 'undefined') && myOccupiedTokens.indexOf(targetToken) !== -1;
              if (isOccupied) {
                  // 같은 셀 재클릭 → 팝업 닫기
                  if (window._occInfoToken === targetToken) {
                      _hideOccPopup();
                      return;
                  }
                  // 셀 중심 좌표 계산
                  var occ2 = s2.Cell.fromCellID(targetL16).center();
                  var occr2 = Math.sqrt(occ2.x**2+occ2.y**2+occ2.z**2);
                  var occLat = parseFloat((Math.asin(occ2.z / occr2) * 180 / Math.PI).toFixed(4));
                  var occLng = parseFloat((Math.atan2(occ2.y, occ2.x) * 180 / Math.PI).toFixed(4));

                  // 팝업 위치: 셀 중심 지형 높이
                  var lastCid = selectionStack.length > 0 ? selectionStack[selectionStack.length - 1] : targetL16;
                  var pLvl = s2.cellid.level(lastCid);
                  var actualParent = s2.cellid.parent(targetL16, pLvl);
                  var refVerts = sampleCellVertices(actualParent);
                  var occLatRad = Math.asin(occ2.z / occr2);
                  var occLngRad = Math.atan2(occ2.y, occ2.x);
                  var labelH = interpolateHeight(occLatRad, occLngRad, refVerts) + TR_HEIGHT_OFFSET;
                  var labelPos = Cesium.Cartesian3.fromRadians(occLngRad, occLatRad, labelH, Cesium.Ellipsoid.MOON);

                  _showOccPopup(labelPos, targetToken, occLat, occLng, isMyTerritory);

                  // 점유 셀 하이라이트 (흰색 반투명)
                  var occCell = s2.Cell.fromCellID(targetL16);
                  var occPositions = [];
                  for (var ovi = 0; ovi < 4; ovi++) {
                      var ov = occCell.vertex(ovi);
                      var ovr = Math.sqrt(ov.x**2+ov.y**2+ov.z**2);
                      occPositions.push(terrainCartesian(Math.asin(ov.z/ovr), Math.atan2(ov.y, ov.x), refVerts));
                  }
                  window._occHighlightPrim = trGridPrimitives.add(new Cesium.Primitive({
                      geometryInstances: new Cesium.GeometryInstance({
                          geometry: new Cesium.PolygonGeometry({
                              polygonHierarchy: new Cesium.PolygonHierarchy(occPositions),
                              ellipsoid: Cesium.Ellipsoid.MOON,
                              perPositionHeight: true,
                          }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                              new Cesium.Color(1.0, 1.0, 1.0, 0.25)
                          )}
                      }),
                      appearance: new Cesium.PerInstanceColorAppearance({
                          flat: true, translucent: true,
                          renderState: { depthTest: { enabled: false }, depthMask: false }
                      }),
                      asynchronous: true,
                  }));

                  // RN에 소유자 정보 쿼리
                  sendToRN('QUERY_CELL_OWNER', { token: targetToken, lat: occLat, lng: occLng, isMyTerritory: isMyTerritory });
                  return;
              }

              // 빈 셀 선택 → 점유 셀 정보 라벨 제거
              _removeOccInfoLabel();

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
                  area: (1740 * window.multiSelectedL16.length).toLocaleString() + ' m²',
                  multiTokens: window.multiSelectedL16.slice(),
                  multiLats: multiLats,
                  multiLngs: multiLngs,
                  isMultiSelect: window.multiSelectedL16.length > 1
              });

              // 선택 하이라이트 관리 (개별 primitive) — 점멸 없이 즉시 적용
              if (!window.trSelectionPrimMap) window.trSelectionPrimMap = {};

              if (existingIdx !== -1) {
                  // 제거된 셀 primitive 삭제
                  if (window.trSelectionPrimMap[targetToken]) {
                      trGridPrimitives.remove(window.trSelectionPrimMap[targetToken]);
                      delete window.trSelectionPrimMap[targetToken];
                  }
              } else {
                  // 새 셀 primitive 추가 (투명 흰색 — 선택)
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
                                  new Cesium.Color(0.95, 0.95, 1.0, 0.3)
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
                  // onComplete: 줌인 완료 후 그리드 렌더
                  _isFlyingTo = false;
                  renderDynamicGrid(null, 'expand');
                  startCameraTracking();
              });
          }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // --- ENTER_TEST2_MODE / EXIT_TEST2_MODE 메시지 핸들러 ---
      function handleTRMessage(event) {
          try {
              var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
              if (msg.type === 'ENTER_TEST2_MODE') {

                  // ═══ 개척모드 진입 시 모든 3D 모델(착륙선/위성) 제거 ═══
                  var modelFlags = ['_isApolloModel', '_isDanuriModel', '_isChandrayaanModel', '_isCapstoneModel', '_isLroModel'];
                  var entsToRemove = [];
                  viewer.entities.values.forEach(function(entity) {
                      for (var fi = 0; fi < modelFlags.length; fi++) {
                          if (entity[modelFlags[fi]]) {
                              entsToRemove.push(entity);
                              break;
                          }
                      }
                  });
                  for (var ri = 0; ri < entsToRemove.length; ri++) {
                      viewer.entities.remove(entsToRemove[ri]);
                  }
                  console.log('[TR] Removed ' + entsToRemove.length + ' 3D model entities on ENTER_TEST2_MODE');

                  // TR 전용 primitives만 클리어 (모드1·2 건드리지 않음)
                  trGridPrimitives.removeAll();
                  window.multiSelectedL16 = [];
                  window.trSelectionPrimMap = {};
                  // 개척모드2에서만 카메라 틸트 해제
                  viewer.scene.screenSpaceCameraController.enableTilt = true;

                  function doRenderWhenReady() {
                      if (!window.tilesetReady) {
                          sendToRN('TILESET_LOADING', { status: 'waiting' });
                          setTimeout(doRenderWhenReady, 500);
                          return;
                      }
                      sendToRN('TILESET_READY', {});
                      renderL0Animated(); // 초기 진입: 확산 애니메이션
                  }
                  doRenderWhenReady();

                  // 더미 구매 셀 토큰 계산 (위도 30°N, 경도 15°E → S2 L16)
                  try {
                      var demoLat = Cesium.Math.toRadians(30.0);
                      var demoLon = Cesium.Math.toRadians(15.0);
                      var demoPt = {
                          x: Math.cos(demoLat) * Math.cos(demoLon),
                          y: Math.cos(demoLat) * Math.sin(demoLon),
                          z: Math.sin(demoLat)
                      };
                      var demoLeaf = s2.cellid.fromPoint(demoPt);
                      var demoL16 = s2.cellid.parent(demoLeaf, 16);
                      var demoToken = s2.cellid.toToken(demoL16);
                      var demoLatDeg = 30.0;
                      var demoLngDeg = 15.0;
                      // 정확한 셀 중심 좌표로 교정
                      var demoCell = s2.Cell.fromCellID(demoL16);
                      var dc = demoCell.center();
                      var dcr = Math.sqrt(dc.x*dc.x + dc.y*dc.y + dc.z*dc.z);
                      demoLatDeg = Cesium.Math.toDegrees(Math.asin(dc.z / dcr));
                      demoLngDeg = Cesium.Math.toDegrees(Math.atan2(dc.y, dc.x));
                      sendToRN('DEMO_TOKEN', { token: demoToken, lat: demoLatDeg, lng: demoLngDeg });
                  } catch(e) { console.warn('[TR] demo token calc failed:', e); }
              }
              if (msg.type === 'EXIT_TEST2_MODE') {
                  // ═══ 개척모드 완전 초기화 ═══
                  // Primitive 정리
                  trGridPrimitives.removeAll();
                  trNeighborPrimitives.removeAll();
                  trFlashPrimitives.removeAll();
                  trAccumulatedPrimitives.removeAll();

                  // 선택 상태 초기화
                  window.multiSelectedL16 = [];
                  window.trSelectionPrimMap = {};
                  selectionStack = [];

                  // 카메라 트래킹/애니메이션 정리
                  stopL0CameraTracking();
                  stopCameraTracking();
                  if (_spreadAnimFrame) { cancelAnimationFrame(_spreadAnimFrame); _spreadAnimFrame = null; }
                  if (_parentFadeFrame) { cancelAnimationFrame(_parentFadeFrame); _parentFadeFrame = null; }
                  if (_l0AnimFrame) { cancelAnimationFrame(_l0AnimFrame); _l0AnimFrame = null; }
                  _isFlyingTo = false;
                  _activeToken = null;
                  _lastCameraCenterToken = null;
                  _l0LastToken = null;

                  // 점유 팝업/하이라이트 정리
                  var popupEl = document.getElementById('occInfoPopup');
                  if (popupEl) popupEl.style.display = 'none';
                  window._occInfoPos = null;
                  if (window._occHighlightPrim) {
                      try { trGridPrimitives.remove(window._occHighlightPrim); } catch(e) {}
                      window._occHighlightPrim = null;
                  }

                  // 점유 라벨 정리 (_renderedCellMap의 labelCol → viewer.scene.primitives에 직접 추가됨)
                  for (var rk in _renderedCellMap) {
                      var entry = _renderedCellMap[rk];
                      if (entry && entry.labelCol) {
                          try { viewer.scene.primitives.remove(entry.labelCol); } catch(e) {}
                      }
                  }
                  _renderedCellMap = {};
                  if (typeof _occupationLabels !== 'undefined' && _occupationLabels) {
                      viewer.scene.primitives.remove(_occupationLabels);
                      _occupationLabels = null;
                  }

                  // 카메라 틸트 잠금
                  viewer.scene.screenSpaceCameraController.enableTilt = false;

                  // 이벤트 리스너 정리
                  if (_trTileListener && window.moonTileset) {
                      try { window.moonTileset.allTilesLoaded.removeEventListener(_trTileListener); } catch(e) {}
                      _trTileListener = null;
                  }

                  // UI 리셋
                  updateUI();
                  sendToRN('CELL_DESELECTED', {});
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
                      // onComplete: 줌인 완료 후 그리드 렌더
                      _isFlyingTo = false;
                      renderDynamicGrid(null, 'expand');
                      startCameraTracking();
                  });
              }
              if (msg.type === 'GO_BACK') {
                  if (selectionStack.length === 0) return;
                  if (_isFlyingTo || _gridExpandFrame || _gridShrinkFrame) return; // 애니메이션 중 입력 차단
                  stopCameraTracking();
                  _removeOccInfoLabel(); // 점유 셀 정보 라벨 제거
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
              if (msg.type === 'CELL_OWNER_INFO') {
                  var ownerPayload = msg.payload || {};
                  if (window._occInfoToken === ownerPayload.token) {
                      var ownerRow = document.getElementById('occOwnerRow');
                      var avatarEl = document.getElementById('occAvatar');
                      var nicknameEl = document.getElementById('occNickname');
                      if (ownerRow && ownerPayload.nickname) {
                          ownerRow.style.display = 'flex';
                          avatarEl.style.background = ownerPayload.avatarColor || '#555';
                          avatarEl.textContent = (ownerPayload.nickname || '?').charAt(0).toUpperCase();
                          nicknameEl.textContent = ownerPayload.nickname;
                      }
                  }
              }
              // ═══ JUMP_TO_CELL: S2 토큰으로 즉시 점프 (드릴다운 없이 바로 그리드 렌더) ═══
              if (msg.type === 'JUMP_TO_CELL') {
                  var jumpToken = msg.token;
                  if (!jumpToken) return;
                  var jumpCellId = s2.cellid.fromToken(jumpToken);
                  var jumpLevel = s2.cellid.level(jumpCellId);

                  // 기존 상태 완전 초기화
                  stopCameraTracking();
                  stopL0CameraTracking();
                  if (_spreadAnimFrame) { cancelAnimationFrame(_spreadAnimFrame); _spreadAnimFrame = null; }
                  if (_parentFadeFrame) { cancelAnimationFrame(_parentFadeFrame); _parentFadeFrame = null; }
                  if (_l0AnimFrame) { cancelAnimationFrame(_l0AnimFrame); _l0AnimFrame = null; }
                  trGridPrimitives.removeAll();
                  trNeighborPrimitives.removeAll();
                  trFlashPrimitives.removeAll();
                  trAccumulatedPrimitives.removeAll();
                  window.multiSelectedL16 = [];
                  window.trSelectionPrimMap = {};
                  _isFlyingTo = false;
                  _activeToken = null;
                  _lastCameraCenterToken = null;
                  _l0LastToken = null;
                  for (var rk in _renderedCellMap) {
                      var entry = _renderedCellMap[rk];
                      if (entry && entry.labelCol) {
                          try { viewer.scene.primitives.remove(entry.labelCol); } catch(e) {}
                      }
                  }
                  _renderedCellMap = {};

                  // selectionStack을 한번에 [L4, L8, L12]로 세팅
                  selectionStack = [];
                  var jumpDrillLevels = [4, 8, 12];
                  for (var jl = 0; jl < jumpDrillLevels.length; jl++) {
                      if (jumpDrillLevels[jl] <= jumpLevel) {
                          selectionStack.push(s2.cellid.parent(jumpCellId, jumpDrillLevels[jl]));
                      }
                  }

                  // L16 타겟 셀 중심 좌표 (이 셀이 화면 중앙에 오도록)
                  var targetCell = s2.Cell.fromCellID(jumpCellId);
                  var tc0 = targetCell.center();
                  var tcr0 = Math.sqrt(tc0.x*tc0.x + tc0.y*tc0.y + tc0.z*tc0.z);
                  var lcLon = Math.atan2(tc0.y, tc0.x);
                  var lcLat = Math.asin(tc0.z / tcr0);
                  _lastCameraCenterToken = s2.cellid.toToken(selectionStack[selectionStack.length - 1]);

                  // ═══ 카메라: camera.flyTo 한번. maximumHeight로 관통 방지 ═══
                  var jumpTargetH = 1500; // L12 적정 높이 (타원체 위 1.5km)
                  viewer.camera.flyTo({
                      destination: Cesium.Cartesian3.fromRadians(lcLon, lcLat, jumpTargetH, Cesium.Ellipsoid.MOON),
                      orientation: {
                          heading: 0,
                          pitch: Cesium.Math.toRadians(-90),
                          roll: 0
                      },
                      duration: 2.0,
                      maximumHeight: 200000, // 200km 아치 → 달 위로 넘어감
                      complete: function() {
                          // flyTo arc 이후 정확한 위치/방향 강제 보정
                          viewer.camera.setView({
                              destination: Cesium.Cartesian3.fromRadians(lcLon, lcLat, jumpTargetH, Cesium.Ellipsoid.MOON),
                              orientation: {
                                  heading: 0,
                                  pitch: Cesium.Math.toRadians(-90),
                                  roll: 0
                              }
                          });
                          // 도착 → L16 그리드 렌더
                          renderDynamicGrid(null, 'expand');
                          startCameraTracking();
                          // L16 타겟 셀 선택 + 하이라이트 + 팝업
                          setTimeout(function() {
                              var tc = s2.Cell.fromCellID(jumpCellId);
                              var tcC = tc.center();
                              var tcR = Math.sqrt(tcC.x*tcC.x + tcC.y*tcC.y + tcC.z*tcC.z);
                              var tcLon = Math.atan2(tcC.y, tcC.x);
                              var tcLat = Math.asin(tcC.z / tcR);
                              var latD = Cesium.Math.toDegrees(tcLat);
                              var lngD = Cesium.Math.toDegrees(tcLon);

                              // 점유 여부 확인
                              var jIsOccupied = occupiedTokens.indexOf(jumpToken) !== -1;
                              var jIsMine = (typeof myOccupiedTokens !== 'undefined') && myOccupiedTokens.indexOf(jumpToken) !== -1;

                              if (jIsOccupied) {
                                  // ── 이미 점유된 셀: 클릭 핸들러와 동일한 점유 라벨 표시 ──
                                  var lastCid = selectionStack.length > 0 ? selectionStack[selectionStack.length - 1] : jumpCellId;
                                  var pLvl = s2.cellid.level(lastCid);
                                  var actualParent = s2.cellid.parent(jumpCellId, pLvl);
                                  var refVerts = sampleCellVertices(actualParent);
                                  var labelH = interpolateHeight(tcLat, tcLon, refVerts) + TR_HEIGHT_OFFSET;
                                  var labelPos = Cesium.Cartesian3.fromRadians(tcLon, tcLat, labelH, Cesium.Ellipsoid.MOON);
                                  _showOccPopup(labelPos, jumpToken, latD, lngD, jIsMine);

                                  // 점유 셀 하이라이트
                                  var occCell = s2.Cell.fromCellID(jumpCellId);
                                  var occPositions = [];
                                  for (var ovi = 0; ovi < 4; ovi++) {
                                      var ov = occCell.vertex(ovi);
                                      var ovr = Math.sqrt(ov.x*ov.x + ov.y*ov.y + ov.z*ov.z);
                                      occPositions.push(terrainCartesian(Math.asin(ov.z/ovr), Math.atan2(ov.y, ov.x), refVerts));
                                  }
                                  window._occHighlightPrim = trGridPrimitives.add(new Cesium.Primitive({
                                      geometryInstances: new Cesium.GeometryInstance({
                                          geometry: new Cesium.PolygonGeometry({
                                              polygonHierarchy: new Cesium.PolygonHierarchy(occPositions),
                                              ellipsoid: Cesium.Ellipsoid.MOON,
                                              perPositionHeight: true,
                                          }),
                                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                                              new Cesium.Color(1.0, 1.0, 1.0, 0.25)
                                          )}
                                      }),
                                      appearance: new Cesium.PerInstanceColorAppearance({
                                          flat: true, translucent: true,
                                          renderState: { depthTest: { enabled: false }, depthMask: false }
                                      }),
                                      asynchronous: true,
                                  }));

                                  // RN에 소유자 정보 쿼리 (점유된 셀이므로 구매 UI가 아닌 소유자 정보 표시)
                                  sendToRN('QUERY_CELL_OWNER', { token: jumpToken, lat: latD, lng: lngD, isMyTerritory: jIsMine });
                              } else {
                                  // ── 미점유 셀: 기존 로직 (선택 + 구매 UI) ──
                                  var cCart = Cesium.Cartesian3.fromRadians(tcLon, tcLat, 0, Cesium.Ellipsoid.MOON);
                                  _showOccPopup(cCart, jumpToken, latD, lngD, true);

                                  if (!window.multiSelectedL16) window.multiSelectedL16 = [];
                                  if (window.multiSelectedL16.indexOf(jumpToken) === -1) {
                                      window.multiSelectedL16.push(jumpToken);
                                  }
                                  if (!window.trSelectionPrimMap) window.trSelectionPrimMap = {};
                                  if (!window.trSelectionPrimMap[jumpToken]) {
                                      var selPositions = [];
                                      for (var si = 0; si < 4; si++) {
                                          var sv = tc.vertex(si);
                                          var svr = Math.sqrt(sv.x*sv.x + sv.y*sv.y + sv.z*sv.z);
                                          var svlat = Math.asin(sv.z / svr);
                                          var svlon = Math.atan2(sv.y, sv.x);
                                          var lastCid = selectionStack.length > 0 ? selectionStack[selectionStack.length - 1] : jumpCellId;
                                          var pLvl = s2.cellid.level(lastCid);
                                          var actualParent = s2.cellid.parent(jumpCellId, pLvl);
                                          var refV = sampleCellVertices(actualParent);
                                          selPositions.push(terrainCartesian(svlat, svlon, refV));
                                      }
                                      var selPrim = trGridPrimitives.add(new Cesium.Primitive({
                                          geometryInstances: new Cesium.GeometryInstance({
                                              geometry: new Cesium.PolygonGeometry({
                                                  polygonHierarchy: new Cesium.PolygonHierarchy(selPositions),
                                                  ellipsoid: Cesium.Ellipsoid.MOON,
                                                  perPositionHeight: true,
                                              }),
                                              attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                                                  new Cesium.Color(0.95, 0.95, 1.0, 0.3)
                                              )}
                                          }),
                                          appearance: new Cesium.PerInstanceColorAppearance({
                                              flat: true, translucent: true,
                                              renderState: { depthTest: { enabled: false }, depthMask: false }
                                          }),
                                          asynchronous: true,
                                      }));
                                      window.trSelectionPrimMap[jumpToken] = selPrim;
                                  }
                                  sendToRN('CELL_SELECTED', {
                                      cellId: jumpToken, token: jumpToken,
                                      lat: latD, lng: lngD, level: 16, childLevel: 16,
                                      cellCount: 1, unit: '1 Block = 1 Mag', magCount: 1,
                                      price: '$1', area: '1,740 m²',
                                      multiTokens: [jumpToken],
                                      multiLats: [latD], multiLngs: [lngD],
                                      isMultiSelect: false
                                  });
                              }

                              sendToRN('JUMP_COMPLETE', { token: jumpToken });
                              sendToRN('DEPTH_CHANGED', { depth: selectionStack.length, canGoBack: true });
                          }, 300);
                      }
                  });
              }
          } catch(e) {
              console.error('[TR] handleTRMessage error:', e);
          }
      }
      document.addEventListener('message', handleTRMessage);
      window.addEventListener('message', handleTRMessage);
`;
