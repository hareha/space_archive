// cesiumGridTR.js — 점유모드3 전용 동적 그리드
// 카메라 look-at 기반 실시간 9셀 그리드

export const CESIUM_GRID_TR = `
      // ═══════════════════════════════════════════════════
      // Terrain Grid — 실시간 카메라 look-at 방식
      // ═══════════════════════════════════════════════════
      var TR_FIXED_HEIGHT = 10000;
      var TR_TERRAIN_OFFSET = 150;
      var trGridPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      var trNeighborPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection()); // 현재 활성 셀
      var trAccumulatedPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection()); // 비활성 누적
      var _lastCenterToken = null;

      // ═══ 디버그 ═══
      function updateTRDebug(info) {
          var el = document.getElementById('debugPanel');
          if (!el) return;
          el.style.display = 'block';
          el.innerHTML = info;
      }

      // ═══ 유틸 ═══
      function getDescendantsTR(cellId, targetLevel) {
          var results = [cellId];
          var cl = s2.cellid.level(cellId);
          while (cl < targetLevel) {
              var next = [];
              for (var i = 0; i < results.length; i++) {
                  var ch = s2.cellid.children(results[i]);
                  for (var j = 0; j < ch.length; j++) next.push(ch[j]);
              }
              results = next;
              cl++;
          }
          return results;
      }

      function getTRRenderConfig(level) {
          return { segments: level <= 4 ? 4 : (level <= 8 ? 2 : 1) };
      }

      // ═══ 카메라가 바라보는 달 표면 → S2 셀 ID ═══
      function getCameraLookAtCellId(level) {
          try {
              var center = new Cesium.Cartesian2(
                  viewer.scene.canvas.width / 2,
                  viewer.scene.canvas.height / 2
              );
              var hitPos = viewer.camera.pickEllipsoid(center, Cesium.Ellipsoid.MOON);
              if (!hitPos) {
                  // 폴백: 수동 ray-sphere intersection
                  var cp = viewer.camera.positionWC;
                  var cd = viewer.camera.directionWC;
                  var R = 1737400.0;
                  var a = cd.x*cd.x + cd.y*cd.y + cd.z*cd.z;
                  var b = 2*(cp.x*cd.x + cp.y*cd.y + cp.z*cd.z);
                  var c = cp.x*cp.x + cp.y*cp.y + cp.z*cp.z - R*R;
                  var disc = b*b - 4*a*c;
                  if (disc < 0) return null;
                  var t = (-b - Math.sqrt(disc)) / (2*a);
                  if (t < 0) return null;
                  hitPos = new Cesium.Cartesian3(cp.x+t*cd.x, cp.y+t*cd.y, cp.z+t*cd.z);
              }
              var carto = Cesium.Cartographic.fromCartesian(hitPos, Cesium.Ellipsoid.MOON);
              if (!carto) return null;
              var lat = carto.latitude, lng = carto.longitude;
              var point = new s2.Point(
                  Math.cos(lat) * Math.cos(lng),
                  Math.cos(lat) * Math.sin(lng),
                  Math.sin(lat)
              );
              var leafId = s2.cellid.fromPoint(point);
              return s2.cellid.parent(leafId, level);
          } catch(e) {
              console.log('[TR] getCameraLookAtCellId error:', e);
              return null;
          }
      }

      // ═══ 카메라 look-at 셀의 공간적 인접 9셀 ═══
      // 2단계 상위로 올라가서 16개 후보 → 거리 정렬 → 9개
      function getCellNeighborsTR(centerCellId) {
          var level = s2.cellid.level(centerCellId);
          if (level <= 0) return [centerCellId];

          // 2단계 상위 셀 (16개 후보)
          var gpLevel = Math.max(0, level - 2);
          var gp;
          if (gpLevel === 0) {
              gp = s2.cellid.fromFace(s2.cellid.face(centerCellId));
          } else {
              gp = s2.cellid.parent(centerCellId, gpLevel);
          }

          var candidates = getDescendantsTR(gp, level); // 4^2 = 16개

          // 중심 셀 기준 3D 거리 정렬
          var cc = s2.Cell.fromCellID(centerCellId).center();
          candidates.sort(function(a, b) {
              var ca = s2.Cell.fromCellID(a).center();
              var cb = s2.Cell.fromCellID(b).center();
              var distA = (ca.x-cc.x)*(ca.x-cc.x) + (ca.y-cc.y)*(ca.y-cc.y) + (ca.z-cc.z)*(ca.z-cc.z);
              var distB = (cb.x-cc.x)*(cb.x-cc.x) + (cb.y-cc.y)*(cb.y-cc.y) + (cb.z-cc.z)*(cb.z-cc.z);
              return distA - distB;
          });

          return candidates.slice(0, 9); // 중심(자기 자신) + 인접 8개
      }

      // ═══ 뷰포트 컬링 ═══
      function isCellVisibleTR(cellId) {
          try {
              var cell = s2.Cell.fromCellID(cellId);
              var c = cell.center();
              var r = Math.sqrt(c.x*c.x + c.y*c.y + c.z*c.z);
              var pos = Cesium.Cartesian3.fromRadians(
                  Math.atan2(c.y, c.x), Math.asin(c.z / r), 0, Cesium.Ellipsoid.MOON
              );
              var wp = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, pos);
              if (!wp) return false;
              var w = viewer.scene.canvas.width, h = viewer.scene.canvas.height;
              var mx = w * 0.3, my = h * 0.3;
              return wp.x >= -mx && wp.x <= w+mx && wp.y >= -my && wp.y <= h+my;
          } catch(e) { return true; }
      }

      // ═══ 셀 위치 ═══
      function getTRCellPositions(cellId, height, segments) {
          var cell = s2.Cell.fromCellID(cellId);
          var pos = [];
          for (var i = 0; i < 4; i++) {
              var p1 = cell.vertex(i), p2 = cell.vertex((i + 1) % 4);
              for (var j = 0; j < segments; j++) {
                  var t = j / segments;
                  var dx = p1.x*(1-t)+p2.x*t, dy = p1.y*(1-t)+p2.y*t, dz = p1.z*(1-t)+p2.z*t;
                  var mag = Math.sqrt(dx*dx+dy*dy+dz*dz);
                  pos.push(Cesium.Cartesian3.fromRadians(
                      Math.atan2(dy/mag, dx/mag), Math.asin(dz/mag),
                      height, Cesium.Ellipsoid.MOON
                  ));
              }
          }
          return pos;
      }

      // ═══ Terrain 꼭짓점 높이 ═══
      function computeTerrainVertexMap(candidates) {
          var map = {};
          for (var ci = 0; ci < candidates.length; ci++) {
              var cell = s2.Cell.fromCellID(candidates[ci]);
              for (var vi = 0; vi < 4; vi++) {
                  var v = cell.vertex(vi);
                  var r = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
                  var lon = Math.atan2(v.y, v.x);
                  var lat = Math.asin(v.z / r);
                  var key = lon.toFixed(8) + '_' + lat.toFixed(8);
                  if (!map[key]) map[key] = { lon: lon, lat: lat, height: TR_TERRAIN_OFFSET };
              }
          }
          var keys = Object.keys(map);
          for (var ki = 0; ki < keys.length; ki++) {
              var entry = map[keys[ki]];
              try {
                  var carto = new Cesium.Cartographic(entry.lon, entry.lat);
                  var h = viewer.scene.sampleHeight(carto);
                  entry.height = (h !== undefined && h !== null && !isNaN(h)) ? (h + TR_TERRAIN_OFFSET) : TR_TERRAIN_OFFSET;
              } catch(e) { entry.height = TR_TERRAIN_OFFSET; }
          }
          return map;
      }

      // 정밀 terrain 위치 (exact vertex match)
      function getCellTerrainPositions(cellId, vertexMap) {
          var cell = s2.Cell.fromCellID(cellId);
          var pos = [];
          for (var i = 0; i < 4; i++) {
              var v = cell.vertex(i);
              var r = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
              var lon = Math.atan2(v.y, v.x);
              var lat = Math.asin(v.z / r);
              var key = lon.toFixed(8) + '_' + lat.toFixed(8);
              var entry = vertexMap[key];
              var h = entry ? entry.height : TR_TERRAIN_OFFSET;
              pos.push(Cesium.Cartesian3.fromRadians(lon, lat, h, Cesium.Ellipsoid.MOON));
          }
          pos.push(pos[0].clone());
          return pos;
      }

      // ★ 대략 terrain 위치 (coarse vertex map에서 IDW 보간)
      // 모든 coarse 꼭짓점의 높이를 1/d² 가중치로 혼합 → 직선에 가까운 높이 전이
      function getCellTerrainPositionsCoarse(cellId, coarseVMap, coarseKeys) {
          var cell = s2.Cell.fromCellID(cellId);
          var pos = [];
          for (var i = 0; i < 4; i++) {
              var v = cell.vertex(i);
              var r = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
              var lon = Math.atan2(v.y, v.x);
              var lat = Math.asin(v.z / r);
              var key = lon.toFixed(8) + '_' + lat.toFixed(8);

              var h;
              // 1. exact match (coarse 꼭짓점과 동일한 위치)
              if (coarseVMap[key]) {
                  h = coarseVMap[key].height;
              } else {
                  // 2. IDW 역거리 가중 보간
                  var sumW = 0, sumWH = 0;
                  for (var k = 0; k < coarseKeys.length; k++) {
                      var e = coarseVMap[coarseKeys[k]];
                      var dlat = e.lat - lat, dlon = e.lon - lon;
                      var d2 = dlat*dlat + dlon*dlon;
                      if (d2 < 1e-14) { sumW = 1; sumWH = e.height; break; }
                      var w = 1.0 / d2; // 1/d² → 가까울수록 강한 가중치
                      sumW += w;
                      sumWH += w * e.height;
                  }
                  h = sumW > 0 ? sumWH / sumW : TR_TERRAIN_OFFSET;
              }
              pos.push(Cesium.Cartesian3.fromRadians(lon, lat, h, Cesium.Ellipsoid.MOON));
          }
          pos.push(pos[0].clone());
          return pos;
      }

      // ═══════════════════════════════════════════════════
      // renderDynamicGrid — 고정높이 Primitive, 누적 방식
      // ═══════════════════════════════════════════════════
      var _activeToken = null;

      function renderDynamicGrid() {
          if (mainMode !== 'occupation3') return;

          var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;
          if (currentLevel === 0) return;

          var newToken = s2.cellid.toToken(lastCellId);
          if (newToken === _activeToken) return;

          // ① 이전 활성 셀 → dim으로 누적 (고정높이, 즉시)
          if (_activeToken && trNeighborPrimitives.length > 0) {
              var prevCellId = s2.cellid.fromToken(_activeToken);
              var prevLevel = s2.cellid.level(prevCellId);
              var prevTgtLv = Math.min(prevLevel + 4, 16);
              var prevChildren = getDescendantsTR(prevCellId, prevTgtLv);
              var dimColor = new Cesium.Color(0.3, 0.85, 0.5, 0.15);
              var dimLines = [];
              for (var d = 0; d < prevChildren.length; d++) {
                  var dp = getTRCellPositions(prevChildren[d], TR_FIXED_HEIGHT, 1);
                  dp.push(dp[0].clone());
                  dimLines.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolylineGeometry({ positions: dp, width: 1.0, arcType: Cesium.ArcType.NONE }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(dimColor) }
                  }));
              }
              if (dimLines.length > 0) {
                  trAccumulatedPrimitives.add(new Cesium.Primitive({
                      geometryInstances: dimLines,
                      appearance: new Cesium.PolylineColorAppearance({ flat: true, translucent: true }),
                      asynchronous: false
                  }));
              }
          }

          // ② 새 활성 셀 (고정높이)
          var tgtLv = Math.min(currentLevel + 4, 16);
          var children = getDescendantsTR(lastCellId, tgtLv);
          var greenColor = new Cesium.Color(0.3, 0.85, 0.5, 0.7);
          var lineInstances = [];
          var polyInstances = [];

          for (var i = 0; i < children.length; i++) {
              var pos = getTRCellPositions(children[i], TR_FIXED_HEIGHT, 1);
              pos.push(pos[0].clone());
              lineInstances.push(new Cesium.GeometryInstance({
                  geometry: new Cesium.PolylineGeometry({ positions: pos, width: 1.5, arcType: Cesium.ArcType.NONE }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(greenColor) }
              }));
              var hc = s2.Cell.fromCellID(children[i]);
              var pp = [];
              for (var j = 0; j < 4; j++) {
                  var v = hc.vertex(j);
                  var r = Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z);
                  pp.push(Cesium.Cartesian3.fromRadians(Math.atan2(v.y,v.x), Math.asin(v.z/r), TR_FIXED_HEIGHT, Cesium.Ellipsoid.MOON));
              }
              polyInstances.push(new Cesium.GeometryInstance({
                  geometry: new Cesium.PolygonGeometry({ polygonHierarchy: new Cesium.PolygonHierarchy(pp), ellipsoid: Cesium.Ellipsoid.MOON, height: TR_FIXED_HEIGHT }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.01)) },
                  id: children[i]
              }));
          }

          // 셀 경계
          var bPos = getTRCellPositions(lastCellId, TR_FIXED_HEIGHT, 1);
          bPos.push(bPos[0].clone());
          lineInstances.push(new Cesium.GeometryInstance({
              geometry: new Cesium.PolylineGeometry({ positions: bPos, width: 2.5, arcType: Cesium.ArcType.NONE }),
              attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(greenColor.withAlpha(0.6)) }
          }));

          trNeighborPrimitives.removeAll();
          if (lineInstances.length > 0) {
              trNeighborPrimitives.add(new Cesium.Primitive({
                  geometryInstances: lineInstances,
                  appearance: new Cesium.PolylineColorAppearance({ flat: true, translucent: true }),
                  asynchronous: false
              }));
          }
          if (polyInstances.length > 0) {
              trNeighborPrimitives.add(new Cesium.Primitive({
                  geometryInstances: polyInstances,
                  appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                  asynchronous: false
              }));
          }

          _activeToken = newToken;
      }




      // ═══════════════════════════════════════════════════
      // renderTerrainSpread — 2단계 진입 시 지형 그리드 확산 애니메이션
      // 중앙에서 바깥으로 퍼져나가는 와이어프레임
      // ═══════════════════════════════════════════════════
      var _spreadAnimFrame = null;
      function renderTerrainSpread(cellId) {
          if (_spreadAnimFrame) { cancelAnimationFrame(_spreadAnimFrame); _spreadAnimFrame = null; }
          trNeighborPrimitives.removeAll();

           var currentLevel = s2.cellid.level(cellId);
          var tgtLv = Math.min(currentLevel + 4, 16);
          var children = getDescendantsTR(cellId, tgtLv);

          // 셀 중심 좌표 (거리 비교용)
          var centerCell = s2.Cell.fromCellID(cellId);
          var cc = centerCell.center();
          var ccr = Math.sqrt(cc.x*cc.x + cc.y*cc.y + cc.z*cc.z);
          var centerLon = Math.atan2(cc.y, cc.x);
          var centerLat = Math.asin(cc.z / ccr);

          // 각 자식셀의 중심→셀중심 각도거리 계산
          var cellDistances = [];
          var maxDist = 0;
          for (var i = 0; i < children.length; i++) {
              var c = s2.Cell.fromCellID(children[i]);
              var v = c.center();
              var vr = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
              var lon = Math.atan2(v.y, v.x);
              var lat = Math.asin(v.z / vr);
              var dlon = lon - centerLon;
              var dlat = lat - centerLat;
              var dist = Math.sqrt(dlon*dlon + dlat*dlat);
              cellDistances.push(dist);
              if (dist > maxDist) maxDist = dist;
          }

          // 각 자식셀의 고정높이 위치
          var cellPositions = [];
          for (var ci = 0; ci < children.length; ci++) {
              var cpArr = getTRCellPositions(children[ci], TR_FIXED_HEIGHT, 1);
              cpArr.push(cpArr[0].clone());
              cellPositions.push(cpArr);
          }

          var greenColor = new Cesium.Color(0.3, 0.85, 0.5, 0.7);
          var duration = 800;
          var startTime = null;

          function drawFrame(time) {
              if (!startTime) startTime = time;
              var t = Math.min((time - startTime) / duration, 1);
              var ease = t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; // ease-in-out quad
              var currentMaxDist = maxDist * ease * 1.1; // 약간 여유

              trNeighborPrimitives.removeAll();
              var lineInstances = [];

              for (var i = 0; i < children.length; i++) {
                  if (cellDistances[i] > currentMaxDist) continue;
                  var edgeFade = 1.0;
                  if (currentMaxDist > 0) {
                      var ratio = cellDistances[i] / currentMaxDist;
                      edgeFade = Math.max(0, 1.0 - ratio * 0.5);
                  }
                  var color = greenColor.withAlpha(0.7 * edgeFade);
                  lineInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolylineGeometry({ positions: cellPositions[i], width: 1.5, arcType: Cesium.ArcType.NONE }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) }
                  }));
              }

              // 셀 경계
              var bndPos = getTRCellPositions(cellId, TR_FIXED_HEIGHT, 1);
              bndPos.push(bndPos[0].clone());
              lineInstances.push(new Cesium.GeometryInstance({
                  geometry: new Cesium.PolylineGeometry({ positions: bndPos, width: 2.5, arcType: Cesium.ArcType.NONE }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(greenColor.withAlpha(0.6 * ease)) }
              }));

              if (lineInstances.length > 0) {
                  trNeighborPrimitives.add(new Cesium.Primitive({
                      geometryInstances: lineInstances,
                      appearance: new Cesium.PolylineColorAppearance({
                          flat: true, translucent: true,
                          renderState: { depthTest: { enabled: false }, depthMask: false }
                      }),
                      asynchronous: false
                  }));
              }

              if (t < 1) {
                  _spreadAnimFrame = requestAnimationFrame(drawFrame);
              } else {
                  _spreadAnimFrame = null;
                  // 애니메이션 완료 → 히트테스트 폴리곤 추가
                  var polyInstances = [];
                  for (var pi = 0; pi < children.length; pi++) {
                      var hc = s2.Cell.fromCellID(children[pi]);
                      var pp = [];
                      for (var j = 0; j < 4; j++) {
                          var hv = hc.vertex(j);
                          var hr = Math.sqrt(hv.x*hv.x+hv.y*hv.y+hv.z*hv.z);
                          pp.push(Cesium.Cartesian3.fromRadians(Math.atan2(hv.y,hv.x), Math.asin(hv.z/hr), TR_FIXED_HEIGHT, Cesium.Ellipsoid.MOON));
                      }
                      polyInstances.push(new Cesium.GeometryInstance({
                          geometry: new Cesium.PolygonGeometry({ polygonHierarchy: new Cesium.PolygonHierarchy(pp), ellipsoid: Cesium.Ellipsoid.MOON, height: TR_FIXED_HEIGHT }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.01)) },
                          id: children[pi]
                      }));
                  }
                  if (polyInstances.length > 0) {
                      trNeighborPrimitives.add(new Cesium.Primitive({
                          geometryInstances: polyInstances,
                          appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                          asynchronous: true
                      }));
                  }
              }
          }
          _spreadAnimFrame = requestAnimationFrame(drawFrame);
      }

      // ═══════════════════════════════════════════════════
      // 카메라 중심 셀 실시간 추적 (preRender)
      // ═══════════════════════════════════════════════════
      var _lastCameraCenterToken = null;
      var _preRenderListener = null;
      var _isFlyingTo = false;

      function startCameraTracking() {
          if (_preRenderListener) return;
          _preRenderListener = viewer.scene.preRender.addEventListener(function() {
              if (mainMode !== 'occupation3') return;
              if (_isFlyingTo) return;
              if (_spreadAnimFrame) return; // 확산 애니메이션 중에는 건너뛰기
              var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
              if (!lastCellId) return;
              var currentLevel = s2.cellid.level(lastCellId);
              if (currentLevel === 0) return;

              // 화면 중앙 → Ellipsoid 교차점
              var centerX = viewer.scene.canvas.clientWidth / 2;
              var centerY = viewer.scene.canvas.clientHeight / 2;
              var ray = viewer.camera.getPickRay(new Cesium.Cartesian2(centerX, centerY));
              if (!ray) return;
              var hit = viewer.scene.globe.pick(ray, viewer.scene);
              if (!hit) {
                  hit = viewer.camera.pickEllipsoid(new Cesium.Cartesian2(centerX, centerY), Cesium.Ellipsoid.MOON);
              }
              if (!hit) return;

              var cart = Cesium.Cartographic.fromCartesian(hit, Cesium.Ellipsoid.MOON);
              var lon = cart.longitude, lat = cart.latitude;
              var cosLat = Math.cos(lat);
              var pt = s2.Point.fromCoords(cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat));
              var cameraCellId = s2.cellid.parent(s2.cellid.fromPoint(pt), currentLevel);
              var cameraCellToken = s2.cellid.toToken(cameraCellId);

              if (cameraCellToken !== _lastCameraCenterToken) {
                  _lastCameraCenterToken = cameraCellToken;
                  selectionStack[selectionStack.length - 1] = cameraCellId;
                  renderDynamicGrid();
              }
          });
      }

      function stopCameraTracking() {
          if (_preRenderListener) {
              _preRenderListener();
              _preRenderListener = null;
          }
          _lastCameraCenterToken = null;
      }

      // ═══════════════════════════════════════════════════
      // renderTerrain — 레벨 전환 시 호출
      // ═══════════════════════════════════════════════════
      function renderTerrain() {
          trGridPrimitives.removeAll();
          trNeighborPrimitives.removeAll();
          trAccumulatedPrimitives.removeAll();
          _activeToken = null;
          _lastCameraCenterToken = null;

          var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;

          var lineInstances = [];
          var polyInstances = [];

          if (currentLevel === 0) {
              // ══════ 0단계: 전체 6면 그리드 (확산 + 고정높이) ══════
              var drawLv = 4;
              var cands = [];
              for (var f = 0; f < 6; f++) cands = cands.concat(getDescendantsTR(s2.cellid.fromFace(f), drawLv));

              // 카메라 중심 기준 거리 계산
              var camCart = Cesium.Cartographic.fromCartesian(viewer.camera.position, Cesium.Ellipsoid.MOON);
              var camLon = camCart ? camCart.longitude : 0;
              var camLat = camCart ? camCart.latitude : 0;
              var cellDists = [];
              var maxCellDist = 0;
              for (var di = 0; di < cands.length; di++) {
                  var dc = s2.Cell.fromCellID(cands[di]).center();
                  var dr = Math.sqrt(dc.x*dc.x+dc.y*dc.y+dc.z*dc.z);
                  var dlon = Math.atan2(dc.y, dc.x) - camLon;
                  var dlat = Math.asin(dc.z / dr) - camLat;
                  var dd = Math.sqrt(dlon*dlon + dlat*dlat);
                  cellDists.push(dd);
                  if (dd > maxCellDist) maxCellDist = dd;
              }

              // 각 셀의 고정높이 위치
              var cellLinePositions = [];
              for (var cli = 0; cli < cands.length; cli++) {
                  var cPos = getTRCellPositions(cands[cli], TR_FIXED_HEIGHT, 1);
                  cPos.push(cPos[0].clone());
                  cellLinePositions.push(cPos);
              }

              var spreadDuration = 1000;
              var spreadStart = null;
              var lColor = Cesium.Color.WHITE.withAlpha(0.35);

              if (_spreadAnimFrame) { cancelAnimationFrame(_spreadAnimFrame); _spreadAnimFrame = null; }

              function spreadFrame(time) {
                  if (!spreadStart) spreadStart = time;
                  var t = Math.min((time - spreadStart) / spreadDuration, 1);
                  var ease = t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
                  var curMax = (maxCellDist + 0.5) * ease;

                  trGridPrimitives.removeAll();
                  var sLines = [];
                  for (var si = 0; si < cands.length; si++) {
                      if (cellDists[si] > curMax) continue;
                      var fade = 1.0;
                      if (curMax > 0) { fade = Math.max(0.1, 1.0 - (cellDists[si] / curMax) * 0.7); }
                      sLines.push(new Cesium.GeometryInstance({
                          geometry: new Cesium.PolylineGeometry({ positions: cellLinePositions[si], width: 1.5, arcType: Cesium.ArcType.NONE }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(lColor.withAlpha(0.35 * fade)) }
                      }));
                  }
                  if (sLines.length > 0) {
                      trGridPrimitives.add(new Cesium.Primitive({
                          geometryInstances: sLines,
                          appearance: new Cesium.PolylineColorAppearance({ flat: true }),
                          asynchronous: false
                      }));
                  }
                  if (t < 1) {
                      _spreadAnimFrame = requestAnimationFrame(spreadFrame);
                  } else {
                      _spreadAnimFrame = null;
                      // 완료: 히트테스트 폴리곤 추가
                      var sPolys = [];
                      for (var hi = 0; hi < cands.length; hi++) {
                          var hCell = s2.Cell.fromCellID(cands[hi]);
                          var hPos = [];
                          for (var hpi = 0; hpi < 4; hpi++) {
                              var hv = hCell.vertex(hpi);
                              var hr = Math.sqrt(hv.x**2+hv.y**2+hv.z**2);
                              hPos.push(Cesium.Cartesian3.fromRadians(Math.atan2(hv.y,hv.x), Math.asin(hv.z/hr), TR_FIXED_HEIGHT, Cesium.Ellipsoid.MOON));
                          }
                          sPolys.push(new Cesium.GeometryInstance({
                              geometry: new Cesium.PolygonGeometry({
                                  polygonHierarchy: new Cesium.PolygonHierarchy(hPos),
                                  ellipsoid: Cesium.Ellipsoid.MOON, height: TR_FIXED_HEIGHT,
                              }),
                              attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.01)) },
                              id: cands[hi]
                          }));
                      }
                      if (sPolys.length > 0) {
                          trGridPrimitives.add(new Cesium.Primitive({
                              geometryInstances: sPolys,
                              appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                              asynchronous: false
                          }));
                      }
                  }
              }
              _spreadAnimFrame = requestAnimationFrame(spreadFrame);

              updateTRDebug('TR L0 terrain | cells: ' + cands.length + ', coarse: ' + coarseLv0Cells.length);
              stopCameraTracking();
          }

          // ── 부모 레이어 (모든 레벨) ──
          if (currentLevel > 0) {
              for (var si = selectionStack.length-1; si >= 0; si--) {
                  var aId = selectionStack[si];
                  var aLv = s2.cellid.level(aId);
                  var aTk = s2.cellid.toToken(aId);
                  var pId = (si > 0) ? selectionStack[si-1] : null;
                  var sibs = [];
                  if (pId) {
                      sibs = getDescendantsTR(pId, aLv);
                  } else {
                      // 전체 6면에서 해당 레벨 형제 셀 모두 그리기
                      for (var ff = 0; ff < 6; ff++) {
                          sibs = sibs.concat(getDescendantsTR(s2.cellid.fromFace(ff), aLv));
                      }
                  }
                  var pAlpha = 0.12 - (selectionStack.length-1-si) * 0.03;
                  if (pAlpha < 0.03) pAlpha = 0.03;
                  var pColor = Cesium.Color.WHITE.withAlpha(pAlpha);

                  for (var sbi = 0; sbi < sibs.length; sbi++) {
                      if (s2.cellid.toToken(sibs[sbi]) === aTk) continue;
                      if (!isCellVisibleTR(sibs[sbi])) continue;
                      var sPos = getTRCellPositions(sibs[sbi], TR_FIXED_HEIGHT, 1);
                      sPos.push(sPos[0].clone());
                      lineInstances.push(new Cesium.GeometryInstance({
                          geometry: new Cesium.PolylineGeometry({ positions: sPos, width: 1.0, arcType: Cesium.ArcType.NONE }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(pColor) }
                      }));
                  }
              }
          }

          if (lineInstances.length > 0) {
              trGridPrimitives.add(new Cesium.Primitive({
                  geometryInstances: lineInstances,
                  appearance: new Cesium.PolylineColorAppearance({ flat: true }),
                  asynchronous: false
              }));
          }
          if (polyInstances.length > 0) {
              trGridPrimitives.add(new Cesium.Primitive({
                  geometryInstances: polyInstances,
                  appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                  asynchronous: false
              }));
          }

          updateUI();

          if (currentLevel > 0) {
              renderDynamicGrid();
              startCameraTracking();
          }
      }
`;
