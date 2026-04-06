// cesiumGridOccupation.js — 개척 모드 전용 동적 그리드
// 카메라 look-at 기반 실시간 9셀 그리드

export const CESIUM_GRID_OCCUPATION = `
      // ═══════════════════════════════════════════════════
      // Terrain Grid — 실시간 카메라 look-at 방식
      // ═══════════════════════════════════════════════════
      var TR_FIXED_HEIGHT = 0;
      var TR_TERRAIN_OFFSET = 0;
      var _lastKnownTerrainH = 0; // pickPosition 기반 글로벌 폴백 높이
      var trGridPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      var trNeighborPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection()); // 현재 활성 셀
      var trAccumulatedPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection()); // 비활성 누적
      var _lastCenterToken = null;



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
              // error silenced
              return null;
          }
      }

      // ═══ 카메라 look-at 셀의 공간적 인접 9셀 ═══
      // 2단계 상위로 올라가서 16개 후보 → 거리 정렬 → 9개
      function getCellNeighborsTR(centerCellId) {
          var level = s2.cellid.level(centerCellId);
          if (level <= 0) return [centerCellId];

          var result = [centerCellId];
          var seen = {};
          seen[s2.cellid.toToken(centerCellId)] = true;

          // S2 edgeNeighbors → 4방향 인접
          var edgeN = s2.cellid.edgeNeighbors(centerCellId);
          for (var e = 0; e < edgeN.length; e++) {
              var tk = s2.cellid.toToken(edgeN[e]);
              if (!seen[tk]) { seen[tk] = true; result.push(edgeN[e]); }
          }

          // edgeNeighbors의 edgeNeighbors → 대각선 인접
          for (var e = 0; e < edgeN.length; e++) {
              var diagN = s2.cellid.edgeNeighbors(edgeN[e]);
              for (var d = 0; d < diagN.length; d++) {
                  var dtk = s2.cellid.toToken(diagN[d]);
                  if (!seen[dtk]) { seen[dtk] = true; result.push(diagN[d]); }
              }
          }

          // 가장 가까운 9개만 (거리순 정렬)
          if (result.length > 9) {
              var cc = s2.Cell.fromCellID(centerCellId).center();
              result.sort(function(a, b) {
                  var ca = s2.Cell.fromCellID(a).center();
                  var cb = s2.Cell.fromCellID(b).center();
                  var da = (ca.x-cc.x)*(ca.x-cc.x)+(ca.y-cc.y)*(ca.y-cc.y)+(ca.z-cc.z)*(ca.z-cc.z);
                  var db = (cb.x-cc.x)*(cb.x-cc.x)+(cb.y-cc.y)*(cb.y-cc.y)+(cb.z-cc.z)*(cb.z-cc.z);
                  return da - db;
              });
              result = result.slice(0, 9);
          }

          return result;
      }

      // ═══ 뷰포트 컬링 + 달 뒷면 컬링 ═══
      function isCellVisibleTR(cellId, skipBackface) {
          try {
              var cell = s2.Cell.fromCellID(cellId);
              var c = cell.center();
              var r = Math.sqrt(c.x*c.x + c.y*c.y + c.z*c.z);
              var cellPos = Cesium.Cartesian3.fromRadians(
                  Math.atan2(c.y, c.x), Math.asin(c.z / r), _lastKnownTerrainH, Cesium.Ellipsoid.MOON
              );

              // 달 뒷면 컬링: 카메라→셀 벡터와 셀 표면법선(=셀 위치 자체)의 dot product
              if (!skipBackface) {
                  var camPos = viewer.camera.positionWC;
                  var toCell = new Cesium.Cartesian3(
                      cellPos.x - camPos.x, cellPos.y - camPos.y, cellPos.z - camPos.z
                  );
                  // 셀 법선 ≈ 셀 위치 (구체 표면의 법선)
                  var dot = toCell.x * cellPos.x + toCell.y * cellPos.y + toCell.z * cellPos.z;
                  if (dot > 0) return false; // 뒷면 → 보이지 않음
              }

              var wp = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, cellPos);
              if (!wp) return false;
              var w = viewer.scene.canvas.width, h = viewer.scene.canvas.height;
              var mx = w * 0.6, my = h * 0.6;
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


      // ═══════════════════════════════════════════════════
      // renderDynamicGrid — 고정높이 Primitive, 누적 방식
      // ═══════════════════════════════════════════════════
      var _activeToken = null;
      var _occupationLabels = null; // LabelCollection for occupation counts

      // occupiedTokens → 특정 레벨 부모별 점유 수 카운트
      function buildOccupationMap(displayLevel) {
          var map = {};
          for (var oi = 0; oi < occupiedTokens.length; oi++) {
              try {
                  var ocId = s2.cellid.fromToken(occupiedTokens[oi]);
                  var parentId = s2.cellid.parent(ocId, displayLevel);
                  var parentToken = s2.cellid.toToken(parentId);
                  map[parentToken] = (map[parentToken] || 0) + 1;
              } catch(e) {}
          }
          return map;
      }

      // ═══ 증분 렌더링용 셀 맵 ═══
      var _renderedCellMap = {}; // { token: { linePrim, polyPrim, labelCollection } }
      var _trHeightCache = {};  // { "lat,lon" → sampledHeight }

      // ═══ 동심원 거리 계산용 유틸 ═══
      function getS2CellCenter(cellId) {
          var cell = s2.Cell.fromCellID(cellId);
          var c = cell.center();
          var r = Math.sqrt(c.x*c.x + c.y*c.y + c.z*c.z);
          return { lon: Math.atan2(c.y, c.x), lat: Math.asin(c.z / r) };
      }
      function s2CellDistance(c1, c2) {
          var dl = c1.lon - c2.lon, da = c1.lat - c2.lat;
          return Math.sqrt(dl*dl + da*da);
      }

      // 꼭짓점 lat/lon → 캐시 키 (~1.7m 해상도)
      function _hKey(lat, lon) {
          return (lat * 100000 | 0) + ',' + (lon * 100000 | 0);
      }

      // 부모 셀 4꼭짓점 높이 샘플링 (캐시에 저장)
      var _activeAnimCol = null; // 현재 확산/축소 애니메이션의 PrimitiveCollection 추적

      // 여러 셀의 꼭짓점을 한 번의 hide/restore로 일괄 샘플링 (성능 최적화)
      function batchPreSampleHeights(cellIds) {
          // 1) 캐시에 없는 고유 꼭짓점 수집
          var toSample = []; // { lat, lon, key }
          var seen = {};
          for (var ci = 0; ci < cellIds.length; ci++) {
              var cell = s2.Cell.fromCellID(cellIds[ci]);
              for (var vi = 0; vi < 4; vi++) {
                  var v = cell.vertex(vi);
                  var r = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
                  var lat = Math.asin(v.z / r);
                  var lon = Math.atan2(v.y, v.x);
                  var key = _hKey(lat, lon);
                  if (!seen[key] && (_trHeightCache[key] === undefined || _trHeightCache[key] === null)) {
                      seen[key] = true;
                      toSample.push({ lat: lat, lon: lon, key: key });
                  }
              }
          }
          if (toSample.length === 0) return;

          // 2) 한 번만 hide
          var wasGridVisible = trGridPrimitives.show;
          var wasNeighborVisible = trNeighborPrimitives.show;
          var wasAccumVisible = trAccumulatedPrimitives.show;
          var wasFlashVisible = trFlashPrimitives.show;
          trGridPrimitives.show = false;
          trNeighborPrimitives.show = false;
          trAccumulatedPrimitives.show = false;
          trFlashPrimitives.show = false;
          var wasAnimColVisible = false;
          if (_activeAnimCol) { wasAnimColVisible = _activeAnimCol.show; _activeAnimCol.show = false; }
          var _hiddenPrims = [];
          var _rcKeys = Object.keys(_renderedCellMap);
          for (var ri = 0; ri < _rcKeys.length; ri++) {
              var re = _renderedCellMap[_rcKeys[ri]];
              if (re && re.polyPrim && re.polyPrim.show) { re.polyPrim.show = false; _hiddenPrims.push(re.polyPrim); }
              if (re && re.linePrim && re.linePrim.show) { re.linePrim.show = false; _hiddenPrims.push(re.linePrim); }
          }
          var _excludeList = [trGridPrimitives, trNeighborPrimitives, trAccumulatedPrimitives, trFlashPrimitives];
          if (_activeAnimCol) _excludeList.push(_activeAnimCol);
          for (var ei = 0; ei < _rcKeys.length; ei++) {
              var ee = _renderedCellMap[_rcKeys[ei]];
              if (ee && ee.polyPrim) _excludeList.push(ee.polyPrim);
              if (ee && ee.linePrim) _excludeList.push(ee.linePrim);
              if (ee && ee.labelCol) _excludeList.push(ee.labelCol);
          }

          // 3) 일괄 sampleHeight
          for (var si = 0; si < toSample.length; si++) {
              var s = toSample[si];
              try {
                  var cart = Cesium.Cartographic.fromRadians(s.lon, s.lat);
                  var h = viewer.scene.sampleHeight(cart, _excludeList);
                  if (h !== undefined && h !== null && !isNaN(h)) {
                      _trHeightCache[s.key] = h;
                  } else {
                      _trHeightCache[s.key] = null;
                  }
              } catch(e) {
                  _trHeightCache[s.key] = null;
              }
          }

          // 4) 한 번만 restore
          trGridPrimitives.show = wasGridVisible;
          trNeighborPrimitives.show = wasNeighborVisible;
          trAccumulatedPrimitives.show = wasAccumVisible;
          trFlashPrimitives.show = wasFlashVisible;
          if (_activeAnimCol) _activeAnimCol.show = wasAnimColVisible;
          for (var pi = 0; pi < _hiddenPrims.length; pi++) { _hiddenPrims[pi].show = true; }
      }

      function sampleCellVertices(cellId) {
          var MOON_R = Cesium.Ellipsoid.MOON.maximumRadius;
          var cell = s2.Cell.fromCellID(cellId);
          var verts = [];
          // fast-path: 4개 꼭지점 전부 캐시에 있으면 hide/restore 불필요
          var allCached = true;
          for (var cv = 0; cv < 4; cv++) {
              var cvt = cell.vertex(cv);
              var cvr = Math.sqrt(cvt.x*cvt.x + cvt.y*cvt.y + cvt.z*cvt.z);
              var ckey = _hKey(Math.asin(cvt.z / cvr), Math.atan2(cvt.y, cvt.x));
              if (_trHeightCache[ckey] === undefined || _trHeightCache[ckey] === null) { allCached = false; break; }
          }
          if (allCached) {
              for (var fv = 0; fv < 4; fv++) {
                  var fvt = cell.vertex(fv);
                  var fvr = Math.sqrt(fvt.x*fvt.x + fvt.y*fvt.y + fvt.z*fvt.z);
                  var flat = Math.asin(fvt.z / fvr);
                  var flon = Math.atan2(fvt.y, fvt.x);
                  var fkey = _hKey(flat, flon);
                  verts.push({ lat: flat, lon: flon, h: _trHeightCache[fkey] });
              }
              return verts;
          }
          // 모든 그리드 프리미티브를 숨겨서 sampleHeight가 지형만 히트하도록
          var wasGridVisible = trGridPrimitives.show;
          var wasNeighborVisible = trNeighborPrimitives.show;
          var wasAccumVisible = trAccumulatedPrimitives.show;
          var wasFlashVisible = trFlashPrimitives.show;
          trGridPrimitives.show = false;
          trNeighborPrimitives.show = false;
          trAccumulatedPrimitives.show = false;
          trFlashPrimitives.show = false;
          // 애니메이션 animCol도 숨기기
          var wasAnimColVisible = false;
          if (_activeAnimCol) { wasAnimColVisible = _activeAnimCol.show; _activeAnimCol.show = false; }
          // _renderedCellMap 내 기존 셀 폴리곤도 숨기기
          var _hiddenPrims = [];
          var _rcKeys = Object.keys(_renderedCellMap);
          for (var ri = 0; ri < _rcKeys.length; ri++) {
              var re = _renderedCellMap[_rcKeys[ri]];
              if (re && re.polyPrim && re.polyPrim.show) { re.polyPrim.show = false; _hiddenPrims.push(re.polyPrim); }
              if (re && re.linePrim && re.linePrim.show) { re.linePrim.show = false; _hiddenPrims.push(re.linePrim); }
          }

          // objectsToExclude도 함께 전달 (.show=false가 sampleHeight에서 안 먹는 경우 대비)
          var _excludeList = [trGridPrimitives, trNeighborPrimitives, trAccumulatedPrimitives, trFlashPrimitives];
          if (_activeAnimCol) _excludeList.push(_activeAnimCol);
          for (var ei = 0; ei < _rcKeys.length; ei++) {
              var ee = _renderedCellMap[_rcKeys[ei]];
              if (ee && ee.polyPrim) _excludeList.push(ee.polyPrim);
              if (ee && ee.linePrim) _excludeList.push(ee.linePrim);
              if (ee && ee.labelCol) _excludeList.push(ee.labelCol);
          }

          for (var vi = 0; vi < 4; vi++) {
              var v = cell.vertex(vi);
              var r = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
              var lat = Math.asin(v.z / r);
              var lon = Math.atan2(v.y, v.x);
              var key = _hKey(lat, lon);
              if (_trHeightCache[key] === undefined || _trHeightCache[key] === null) {
                  try {
                      var cart = Cesium.Cartographic.fromRadians(lon, lat);
                      var h = viewer.scene.sampleHeight(cart, _excludeList);
                      if (h !== undefined && h !== null && !isNaN(h)) {
                          _trHeightCache[key] = h;
                      } else {
                          _trHeightCache[key] = null;
                      }
                  } catch(e) {
                      _trHeightCache[key] = null;
                  }
              }
              var cachedH = _trHeightCache[key];
              verts.push({ lat: lat, lon: lon, h: cachedH });
          }
          // 가시성 복원
          trGridPrimitives.show = wasGridVisible;
          trNeighborPrimitives.show = wasNeighborVisible;
          trAccumulatedPrimitives.show = wasAccumVisible;
          trFlashPrimitives.show = wasFlashVisible;
          if (_activeAnimCol) _activeAnimCol.show = wasAnimColVisible;
          for (var pi = 0; pi < _hiddenPrims.length; pi++) { _hiddenPrims[pi].show = true; }
          // null인 꼭지점은 성공한 이웃 꼭지점 평균으로 근사
          var validSum = 0, validCount = 0;
          for (var si = 0; si < verts.length; si++) {
              if (verts[si].h !== null) { validSum += verts[si].h; validCount++; }
          }
          var avgH = validCount > 0 ? validSum / validCount : _lastKnownTerrainH;
          for (var si2 = 0; si2 < verts.length; si2++) {
              if (verts[si2].h === null) verts[si2].h = avgH;
          }
          return verts;
      }

      // ── 삼각형 barycentric 좌표 계산 ──
      function _bary(px, py, ax, ay, bx, by, cx, cy) {
          var v0x = bx - ax, v0y = by - ay;
          var v1x = cx - ax, v1y = cy - ay;
          var v2x = px - ax, v2y = py - ay;
          var d00 = v0x*v0x + v0y*v0y;
          var d01 = v0x*v1x + v0y*v1y;
          var d11 = v1x*v1x + v1y*v1y;
          var d20 = v2x*v0x + v2y*v0y;
          var d21 = v2x*v1x + v2y*v1y;
          var denom = d00*d11 - d01*d01;
          if (Math.abs(denom) < 1e-20) return null;
          var v = (d11*d20 - d01*d21) / denom;
          var w = (d00*d21 - d01*d20) / denom;
          var u = 1 - v - w;
          return [u, v, w];
      }

      // Linear 보간: 부모 4꼭짓점을 2삼각형으로 분할, 3D Cartesian 기반 barycentric (극지방 안전)
      function interpolateHeight(lat, lon, parentVerts) {
          var v0 = parentVerts[0], v1 = parentVerts[1], v2 = parentVerts[2], v3 = parentVerts[3];
          // lat/lon → 단위구 3D 좌표
          function toXYZ(la, lo) {
              var cl = Math.cos(la);
              return [cl * Math.cos(lo), cl * Math.sin(lo), Math.sin(la)];
          }
          var p  = toXYZ(lat, lon);
          var q0 = toXYZ(v0.lat, v0.lon);
          var q1 = toXYZ(v1.lat, v1.lon);
          var q2 = toXYZ(v2.lat, v2.lon);
          var q3 = toXYZ(v3.lat, v3.lon);
          // 4꼭짓점 xyz 범위 → spread 가장 작은 축 제거하여 2D 투영
          var xr = Math.max(q0[0],q1[0],q2[0],q3[0]) - Math.min(q0[0],q1[0],q2[0],q3[0]);
          var yr = Math.max(q0[1],q1[1],q2[1],q3[1]) - Math.min(q0[1],q1[1],q2[1],q3[1]);
          var zr = Math.max(q0[2],q1[2],q2[2],q3[2]) - Math.min(q0[2],q1[2],q2[2],q3[2]);
          var ai, bi; // 사용할 축 인덱스
          if (xr <= yr && xr <= zr) { ai = 1; bi = 2; }
          else if (yr <= xr && yr <= zr) { ai = 0; bi = 2; }
          else { ai = 0; bi = 1; }
          // 삼각형 1: v0-v1-v2
          var b = _bary(p[ai], p[bi], q0[ai], q0[bi], q1[ai], q1[bi], q2[ai], q2[bi]);
          if (b && b[0] >= -0.01 && b[1] >= -0.01 && b[2] >= -0.01) {
              return b[0]*v0.h + b[1]*v1.h + b[2]*v2.h;
          }
          // 삼각형 2: v0-v2-v3
          b = _bary(p[ai], p[bi], q0[ai], q0[bi], q2[ai], q2[bi], q3[ai], q3[bi]);
          if (b && b[0] >= -0.01 && b[1] >= -0.01 && b[2] >= -0.01) {
              return b[0]*v0.h + b[1]*v2.h + b[2]*v3.h;
          }
          // fallback: 3D 거리 최근접 꼭짓점
          var minD = Infinity, minH = 0;
          for (var i = 0; i < parentVerts.length; i++) {
              var qi = toXYZ(parentVerts[i].lat, parentVerts[i].lon);
              var dx = p[0]-qi[0], dy = p[1]-qi[1], dz = p[2]-qi[2];
              var d = dx*dx + dy*dy + dz*dz;
              if (d < minD) { minD = d; minH = parentVerts[i].h; }
          }
          return minH;
      }

      var TR_HEIGHT_OFFSET = 10; // 지형 위 오프셋 (z-fighting 방지)

      // Cartesian3을 lat/lon/height에서 생성 (지형 보간 사용)
      function terrainCartesian(lat, lon, parentVerts) {
          var h = interpolateHeight(lat, lon, parentVerts) + TR_HEIGHT_OFFSET;
          return Cesium.Cartesian3.fromRadians(lon, lat, h, Cesium.Ellipsoid.MOON);
      }

      // 개별 셀 1개의 하위 그리드를 렌더링하여 primitive 반환
      function renderOneCell(cellId, parentVerts) {
          var currentLevel = s2.cellid.level(cellId);
          var tgtLv = Math.min(currentLevel + 4, 16);
          var children = getDescendantsTR(cellId, tgtLv);
          var isLeafLevel = (tgtLv === 16);
          var lineInstances = [];
          var polyInstances = [];
          var labelCol = null;

          if (isLeafLevel) {
              // 내 점유: #2F57FD, 남 점유: #101010, 선택 가능: 기본 화이트
              var MY_OCC_COLOR = new Cesium.Color(0.184, 0.341, 0.992, 0.85);   // #2F57FD
              var OTHER_OCC_COLOR = new Cesium.Color(0.063, 0.063, 0.063, 0.75); // #101010
              var MY_FILL = new Cesium.Color(0.184, 0.341, 0.992, 0.45);         // #2F57FD fill
              var OTHER_FILL = new Cesium.Color(0.063, 0.063, 0.063, 0.45);      // #101010 fill
              var FREE_COLOR = Cesium.Color.WHITE.withAlpha(0.25);

              for (var i = 0; i < children.length; i++) {

                  var childToken = s2.cellid.toToken(children[i]);
                  var isMine = !!_myOccupiedSet[childToken];
                  var isOccupied = !isMine && !!_occupiedSet[childToken];

                  var cellColor, fillColor, lw;
                  if (isMine) { cellColor = MY_OCC_COLOR; fillColor = MY_FILL; lw = 0.8; }
                  else if (isOccupied) { cellColor = OTHER_OCC_COLOR; fillColor = OTHER_FILL; lw = 0.8; }
                  else { cellColor = FREE_COLOR; lw = 0.5; }

                  // 지형 보간 좌표
                  var hc = s2.Cell.fromCellID(children[i]);
                  var pp = [];
                  for (var j = 0; j < 4; j++) {
                      var v = hc.vertex(j);
                      var vr = Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z);
                      var vlat = Math.asin(v.z / vr);
                      var vlon = Math.atan2(v.y, v.x);
                      pp.push(terrainCartesian(vlat, vlon, parentVerts));
                  }
                  var pos = pp.slice();
                  pos.push(pos[0].clone());
                  lineInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolylineGeometry({ positions: pos, width: lw, arcType: Cesium.ArcType.NONE }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(cellColor) }
                  }));
                  // 모든 셀에 polygon fill (pick 감지에 id 필요)
                  var pFill = (isMine || isOccupied) ? fillColor : Cesium.Color.WHITE.withAlpha(0.01);
                  polyInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolygonGeometry({ polygonHierarchy: new Cesium.PolygonHierarchy(pp), ellipsoid: Cesium.Ellipsoid.MOON, perPositionHeight: true }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(pFill) },
                      id: children[i]
                  }));
              }
          } else {
              var greenColor = Cesium.Color.WHITE.withAlpha(0.2);
              var occupationMap = buildOccupationMap(tgtLv);
              var maxCount = 0;
              for (var ci = 0; ci < children.length; ci++) {
                  var cnt = occupationMap[s2.cellid.toToken(children[ci])] || 0;
                  if (cnt > maxCount) maxCount = cnt;
              }
              labelCol = viewer.scene.primitives.add(new Cesium.LabelCollection());

              for (var i = 0; i < children.length; i++) {

                  var childToken = s2.cellid.toToken(children[i]);
                  var occCount = occupationMap[childToken] || 0;
                  var ratio = maxCount > 0 ? occCount / maxCount : 0;

                  var cellColor;
                  if (occCount === 0) { cellColor = greenColor; }
                  else {
                      var alpha = 0.3 + ratio * 0.2;
                      cellColor = new Cesium.Color(0.95, 0.85 - ratio * 0.15, 0.8 - ratio * 0.2, alpha);
                  }

                  // 지형 보간 좌표
                  var hc = s2.Cell.fromCellID(children[i]);
                  var pp = [];
                  for (var j = 0; j < 4; j++) {
                      var v = hc.vertex(j);
                      var vr = Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z);
                      var vlat = Math.asin(v.z / vr);
                      var vlon = Math.atan2(v.y, v.x);
                      pp.push(terrainCartesian(vlat, vlon, parentVerts));
                  }
                  var pos = pp.slice();
                  pos.push(pos[0].clone());
                  lineInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolylineGeometry({ positions: pos, width: occCount > 0 ? 0.8 : 0.5, arcType: Cesium.ArcType.NONE }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(cellColor) }
                  }));
                  var fillAlpha = occCount > 0 ? Math.min(0.08+ratio*0.08, 0.16) : 0.01;
                  var fillColor = occCount > 0 ? new Cesium.Color(cellColor.red, cellColor.green, cellColor.blue, fillAlpha) : Cesium.Color.WHITE.withAlpha(0.01);
                  polyInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolygonGeometry({ polygonHierarchy: new Cesium.PolygonHierarchy(pp), ellipsoid: Cesium.Ellipsoid.MOON, perPositionHeight: true }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(fillColor) },
                      id: children[i]
                  }));
                  if (occCount > 0) {
                      var center = hc.center();
                      var cr = Math.sqrt(center.x*center.x+center.y*center.y+center.z*center.z);
                      var clat = Math.asin(center.z / cr);
                      var clon = Math.atan2(center.y, center.x);
                      var ch = interpolateHeight(clat, clon, parentVerts) + TR_HEIGHT_OFFSET + 200;
                      labelCol.add({
                          position: Cesium.Cartesian3.fromRadians(clon, clat, ch, Cesium.Ellipsoid.MOON),
                          text: occCount.toString(), font: '11px sans-serif',
                          fillColor: new Cesium.Color(1,1,1,0.9), outlineColor: new Cesium.Color(0,0,0,0.6), outlineWidth: 2,
                          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                          horizontalOrigin: Cesium.HorizontalOrigin.CENTER, verticalOrigin: Cesium.VerticalOrigin.CENTER,
                          scale: 1.0, disableDepthTestDistance: Number.POSITIVE_INFINITY
                      });
                  }
              }
          }

          // 부모 셀 경계선 (자식 wireframe과 같은 lineInstances에 통합)
          if (parentVerts) {
              var borderPositions = [];
              for (var bi = 0; bi < parentVerts.length; bi++) {
                  borderPositions.push(Cesium.Cartesian3.fromRadians(
                      parentVerts[bi].lon, parentVerts[bi].lat,
                      parentVerts[bi].h + TR_TERRAIN_OFFSET + 2,
                      Cesium.Ellipsoid.MOON
                  ));
              }
              borderPositions.push(borderPositions[0].clone());
              lineInstances.push(new Cesium.GeometryInstance({
                  geometry: new Cesium.PolylineGeometry({ positions: borderPositions, width: 2.0, arcType: Cesium.ArcType.NONE }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.5)) }
              }));
          }

          var linePrim = null, polyPrim = null;
          if (lineInstances.length > 0) {
              linePrim = trNeighborPrimitives.add(new Cesium.Primitive({
                  geometryInstances: lineInstances,
                  appearance: new Cesium.PolylineColorAppearance({
                      flat: true, translucent: true,
                      renderState: { depthTest: { enabled: false }, depthMask: false }
                  }),
                  asynchronous: false
              }));
          }
          if (polyInstances.length > 0) {
              polyPrim = trNeighborPrimitives.add(new Cesium.Primitive({
                  geometryInstances: polyInstances,
                  appearance: new Cesium.PerInstanceColorAppearance({
                      flat: true, translucent: true,
                      renderState: { depthTest: { enabled: false }, depthMask: false }
                  }),
                  asynchronous: false
              }));
          }

          return { linePrim: linePrim, polyPrim: polyPrim, labelCol: labelCol, verts: parentVerts };
      }

      // 맵에서 셀 1개 제거
      function removeRenderedCell(token) {
          var entry = _renderedCellMap[token];
          if (!entry) return;
          if (entry.linePrim) try { trNeighborPrimitives.remove(entry.linePrim); } catch(e) {}
          if (entry.polyPrim) try { trNeighborPrimitives.remove(entry.polyPrim); } catch(e) {}
          if (entry.labelCol) try { viewer.scene.primitives.remove(entry.labelCol); } catch(e) {}
          delete _renderedCellMap[token];
      }

      // 전체 맵 클리어
      function clearRenderedCellMap() {
          var keys = Object.keys(_renderedCellMap);
          for (var i = 0; i < keys.length; i++) removeRenderedCell(keys[i]);
          _renderedCellMap = {};
          _trHeightCache = {};
      }


      // 증분 렌더링: 카메라 중심 기준 9셀 diff
      // animMode: 'expand' = 중앙→바깥 확산, 없으면 즉시
      function renderDynamicGrid(cameraCenterCellId, animMode) {
          if (mainMode !== 'test2') return;
          if (_isFlyingTo) return;

          var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;
          if (currentLevel === 0) return;

          var centerCell = cameraCenterCellId || lastCellId;

          // expand 모드: 부모 셀 보관 + 부모 wireframe 좌표 사전 수집
          var oldEntries = null;
          var oldParentWireframe = null;
          var oldParentAlpha = 0.2; // 기본값
          if (animMode === 'expand') {
              oldEntries = {};
              oldParentWireframe = [];
              var oldTokens = Object.keys(_renderedCellMap);
              if (oldTokens.length > 0) {
                  // 1→2, 2→3 전환: 기존 neighbor 셀 wireframe 수집 (기존 캐시 활용 → 빠름)
                  for (var oi = 0; oi < oldTokens.length; oi++) {
                      oldEntries[oldTokens[oi]] = _renderedCellMap[oldTokens[oi]];
                      var oldCid = s2.cellid.fromToken(oldTokens[oi]);
                      var oldLvl = s2.cellid.level(oldCid);
                      var oldTgt = Math.min(oldLvl + 4, 16);
                      var oldKids = getDescendantsTR(oldCid, oldTgt);
                      var oldVerts = sampleCellVertices(oldCid);
                      for (var ok = 0; ok < oldKids.length; ok++) {
                          var ohc = s2.Cell.fromCellID(oldKids[ok]);
                          var opp = [];
                          for (var oj = 0; oj < 4; oj++) {
                              var ov = ohc.vertex(oj);
                              var ovr = Math.sqrt(ov.x*ov.x + ov.y*ov.y + ov.z*ov.z);
                              opp.push(terrainCartesian(Math.asin(ov.z/ovr), Math.atan2(ov.y, ov.x), oldVerts));
                          }
                          var opos = opp.slice(); opos.push(opos[0].clone());
                          oldParentWireframe.push(opos);
                      }
                  }
              } else {
                  // L0→L1 전환: L0 그리드(전체 L4 셀) wireframe 수집
                  oldParentAlpha = 0.35; // L0 그리드의 알파값
                  for (var f = 0; f < 6; f++) {
                      var faceCells = getDescendantsTR(s2.cellid.fromFace(f), 4);
                      for (var fc = 0; fc < faceCells.length; fc++) {
                          var l0pos = getTRCellPositions(faceCells[fc], L0_GRID_HEIGHT, 1);
                          l0pos.push(l0pos[0].clone());
                          oldParentWireframe.push(l0pos);
                      }
                  }
              }
              // wireframe 수집 완료 후 캐시 클리어 → 새 셀은 정확한 높이로 샘플링
              _trHeightCache = {};
              _renderedCellMap = {};
          }

          // 중앙 + 8이웃 = 9셀
          var nineCells = getCellNeighborsTR(centerCell);
          var newTokens = {};
          for (var i = 0; i < nineCells.length; i++) {
              var tk = s2.cellid.toToken(nineCells[i]);
              newTokens[tk] = nineCells[i];
          }

          // diff: 기존에 있는데 새 목록에 없으면 제거
          var oldKeys = Object.keys(_renderedCellMap);
          for (var oi2 = 0; oi2 < oldKeys.length; oi2++) {
              if (!newTokens[oldKeys[oi2]]) removeRenderedCell(oldKeys[oi2]);
          }

          // 새로 추가할 셀 목록
          var newKeys = Object.keys(newTokens);
          var pendingKeys = [];
          for (var ni = 0; ni < newKeys.length; ni++) {
              if (!_renderedCellMap[newKeys[ni]]) pendingKeys.push(newKeys[ni]);
          }

          _activeToken = s2.cellid.toToken(centerCell);

          if (animMode === 'expand' && pendingKeys.length > 0) {
              // 모든 셀의 꼭짓점 높이를 1회 hide/restore로 일괄 프리캐싱
              var preSampleIds = [];
              for (var ps = 0; ps < pendingKeys.length; ps++) {
                  preSampleIds.push(newTokens[pendingKeys[ps]]);
              }
              batchPreSampleHeights(preSampleIds);
              // 프레임 분산: 프레임당 2셀씩 renderOneCell → 완료 후 확산 애니메이션
              var batchIdx = 0;
              var BATCH_SIZE = 2;
              function processNextBatch() {
                  var end = Math.min(batchIdx + BATCH_SIZE, pendingKeys.length);
                  for (var bi = batchIdx; bi < end; bi++) {
                      var key = pendingKeys[bi];
                      if (!_renderedCellMap[key]) {
                          var verts = sampleCellVertices(newTokens[key]);
                          var entry = renderOneCell(newTokens[key], verts);
                          // expand: 프리미티브 즉시 숨기기 (animateGridExpand이 제어)
                          if (entry.linePrim) entry.linePrim.show = false;
                          if (entry.polyPrim) entry.polyPrim.show = false;
                          if (entry.labelCol) entry.labelCol.show = false;
                          _renderedCellMap[key] = entry;
                      }
                  }
                  batchIdx = end;
                  if (batchIdx < pendingKeys.length) {
                      requestAnimationFrame(processNextBatch);
                  } else {
                      animateGridExpand(centerCell, oldEntries, oldParentWireframe, oldParentAlpha);
                  }
              }
              processNextBatch();
          } else {
              // 즉시 렌더링 (카메라 이동 등 비-expand)
              for (var ni2 = 0; ni2 < pendingKeys.length; ni2++) {
                  var key2 = pendingKeys[ni2];
                  var verts2 = sampleCellVertices(newTokens[key2]);
                  var entry2 = renderOneCell(newTokens[key2], verts2);
                  _renderedCellMap[key2] = entry2;
              }
          }

      }

      // ═══ 자식 동심원 확산 + 부모 페이드아웃 ═══
      var _gridExpandFrame = null;
      function animateGridExpand(centerCellId, oldParentEntries, oldParentWireframe, oldParentAlpha) {
          if (_gridExpandFrame) { cancelAnimationFrame(_gridExpandFrame); _gridExpandFrame = null; }
          if (_gridShrinkFrame) { cancelAnimationFrame(_gridShrinkFrame); _gridShrinkFrame = null; }

          var centerCoord = getS2CellCenter(centerCellId);
          var tokens = Object.keys(_renderedCellMap);

           // 새 프리미티브 숨기기 (animCol에서 그림)
          for (var ti = 0; ti < tokens.length; ti++) {
              var ent = _renderedCellMap[tokens[ti]];
              if (ent.linePrim) ent.linePrim.show = false;
              if (ent.polyPrim) ent.polyPrim.show = false;
              if (ent.labelCol) ent.labelCol.show = false;
          }

          // 부모 원본은 아직 숨기지 않음 (drawExpandFrame 첫 호출에서 숨김 → 깜빡임 방지)

          // 새 자식셀 + 부모 경계선 수집
          var allChildren = [];
          var maxDist = 0;
          for (var ti2 = 0; ti2 < tokens.length; ti2++) {
              var cellId = s2.cellid.fromToken(tokens[ti2]);
              var currentLevel = s2.cellid.level(cellId);
              var tgtLv = Math.min(currentLevel + 4, 16);
              var children = getDescendantsTR(cellId, tgtLv);
              // 이미 renderDynamicGrid에서 계산된 verts 재사용 (중복 sampleHeight 제거)
              var cachedEntry = _renderedCellMap[tokens[ti2]];
              var parentVerts = (cachedEntry && cachedEntry.verts) ? cachedEntry.verts : sampleCellVertices(cellId);
              for (var ci = 0; ci < children.length; ci++) {
                  var ec = getS2CellCenter(children[ci]);
                  var d = s2CellDistance(centerCoord, ec);
                  if (d > maxDist) maxDist = d;
                  var hc = s2.Cell.fromCellID(children[ci]);
                  var pp = [];
                  for (var j = 0; j < 4; j++) {
                      var v = hc.vertex(j);
                      var vr = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
                      pp.push(terrainCartesian(Math.asin(v.z/vr), Math.atan2(v.y, v.x), parentVerts));
                  }
                  var pos = pp.slice(); pos.push(pos[0].clone());
                  allChildren.push({ pos: pos, distance: d, isBorder: false });
              }
              // 부모 셀 경계선 (distance: 0 → 가장 먼저 나타남)
              if (parentVerts) {
                  var bPos = [];
                  for (var bvi = 0; bvi < parentVerts.length; bvi++) {
                      bPos.push(Cesium.Cartesian3.fromRadians(
                          parentVerts[bvi].lon, parentVerts[bvi].lat,
                          parentVerts[bvi].h + TR_TERRAIN_OFFSET + 2,
                          Cesium.Ellipsoid.MOON
                      ));
                  }
                  bPos.push(bPos[0].clone());
                  allChildren.push({ pos: bPos, distance: 0, isBorder: true });
              }
          }

          var animCol = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
          _activeAnimCol = animCol;
          var duration = 600;
          var startTime = null;
          var parentCleaned = false;

          function drawExpandFrame(time) {
              if (!startTime) {
                  startTime = time;
                  // 첫 프레임: 부모/L0 원본 숨기기 (animCol 렌더와 동일 프레임 → 깜빡임 없음)
                  var hasOldParent = oldParentEntries && Object.keys(oldParentEntries).length > 0;
                  if (hasOldParent) {
                      var opk = Object.keys(oldParentEntries);
                      for (var pi = 0; pi < opk.length; pi++) {
                          var op = oldParentEntries[opk[pi]];
                          if (op.linePrim) op.linePrim.show = false;
                          if (op.polyPrim) op.polyPrim.show = false;
                          if (op.labelCol) op.labelCol.show = false;
                      }
                  }
                  trGridPrimitives.show = false; // L0/부모 모두 숨기기
              }
              var t = Math.min((time - startTime) / duration, 1);
              var ease = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
              var curMax = maxDist * ease * 1.05;

              // ── 80%: 부모 primitive 완전 제거 (메모리 해제) ──
              if (!parentCleaned && t >= 0.8) {
                  parentCleaned = true;
                  if (oldParentEntries) {
                      var opk2 = Object.keys(oldParentEntries);
                      for (var pi3 = 0; pi3 < opk2.length; pi3++) {
                          var op2 = oldParentEntries[opk2[pi3]];
                          if (op2.linePrim) { try { trNeighborPrimitives.remove(op2.linePrim); } catch(e) {} }
                          if (op2.polyPrim) { try { trNeighborPrimitives.remove(op2.polyPrim); } catch(e) {} }
                          if (op2.labelCol) { try { viewer.scene.primitives.remove(op2.labelCol); } catch(e) {} }
                      }
                      oldParentEntries = null; // 참조 해제
                  }
                  oldParentWireframe = null; // wireframe 좌표 참조 해제
                  trGridPrimitives.removeAll();
              }

              animCol.removeAll();
              var lineInstances = [];

              // ── 새 자식 확산 (중앙→바깥) ──
              for (var i = 0; i < allChildren.length; i++) {
                  if (allChildren[i].distance > curMax) continue;
                  var lw = allChildren[i].isBorder ? 2.0 : 0.5;
                  var la = allChildren[i].isBorder ? 0.5 : 0.2;
                  lineInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolylineGeometry({ positions: allChildren[i].pos, width: lw, arcType: Cesium.ArcType.NONE }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(la)) }
                  }));
              }

              // ── 부모 페이드아웃 (0%~80% 알파 감소, 별도 primitive) ──
              var parentLineInstances = [];
              if (oldParentWireframe && oldParentWireframe.length > 0 && t < 0.8) {
                  var parentAlpha = (oldParentAlpha || 0.2) * (1.0 - t / 0.8);
                  if (parentAlpha > 0.005) {
                      for (var pi2 = 0; pi2 < oldParentWireframe.length; pi2++) {
                          parentLineInstances.push(new Cesium.GeometryInstance({
                              geometry: new Cesium.PolylineGeometry({ positions: oldParentWireframe[pi2], width: 0.5, arcType: Cesium.ArcType.NONE }),
                              attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(parentAlpha)) }
                          }));
                      }
                  }
              }

              // 자식 확산 primitive (depthTest: false)
              if (lineInstances.length > 0) {
                  animCol.add(new Cesium.Primitive({
                      geometryInstances: lineInstances,
                      appearance: new Cesium.PolylineColorAppearance({ flat: true, translucent: true,
                          renderState: { depthTest: { enabled: false }, depthMask: false } }),
                      asynchronous: false
                  }));
              }
              // 부모 페이드아웃 primitive (L0: depthTest true, 그 외: false)
              if (parentLineInstances.length > 0) {
                  var parentDepthTest = (oldParentAlpha || 0.2) > 0.25; // L0=0.35 → true
                  animCol.add(new Cesium.Primitive({
                      geometryInstances: parentLineInstances,
                      appearance: new Cesium.PolylineColorAppearance({ flat: true, translucent: true,
                          renderState: { depthTest: { enabled: parentDepthTest }, depthMask: false } }),
                      asynchronous: false
                  }));
              }

              if (t < 1) {
                  _gridExpandFrame = requestAnimationFrame(drawExpandFrame);
              } else {
                  _gridExpandFrame = null;
                  try { viewer.scene.primitives.remove(animCol); } catch(e) {}
                  if (_activeAnimCol === animCol) _activeAnimCol = null;
                  // 새 원본 보이기
                  var tks = Object.keys(_renderedCellMap);
                  for (var fi = 0; fi < tks.length; fi++) {
                      var fe = _renderedCellMap[tks[fi]];
                      if (fe.linePrim) fe.linePrim.show = true;
                      if (fe.polyPrim) fe.polyPrim.show = true;
                      if (fe.labelCol) fe.labelCol.show = true;
                  }
                  trGridPrimitives.show = true;
              }
          }
          _gridExpandFrame = requestAnimationFrame(drawExpandFrame);
      }

      // ═══ GO_BACK 자식 축소 애니메이션: 밖→안으로 사라짐 ═══
      var _gridShrinkFrame = null;
      function animateGridShrink(centerCellId, childWireframe, childEntriesToRemove, callback) {
          if (_gridShrinkFrame) { cancelAnimationFrame(_gridShrinkFrame); _gridShrinkFrame = null; }
          if (_gridExpandFrame) { cancelAnimationFrame(_gridExpandFrame); _gridExpandFrame = null; }

          var centerCoord = getS2CellCenter(centerCellId);

          // 자식 wireframe에 거리 계산
          var allChildren = [];
          var maxDist = 0;
          for (var i = 0; i < childWireframe.length; i++) {
              var d = childWireframe[i].distance;
              if (d > maxDist) maxDist = d;
              allChildren.push(childWireframe[i]);
          }

          // 자식 원본 프리미티브는 첫 프레임에서 숨김 (animCol과 동일 프레임)
          var animCol = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
          _activeAnimCol = animCol;
          var duration = 300;
          var startTime = null;

          function drawShrinkFrame(time) {
              if (!startTime) {
                  startTime = time;
                  // 첫 프레임: 자식 원본 숨기기
                  if (childEntriesToRemove) {
                      var ckKeys = Object.keys(childEntriesToRemove);
                      for (var ci = 0; ci < ckKeys.length; ci++) {
                          var ce = childEntriesToRemove[ckKeys[ci]];
                          if (ce.linePrim) ce.linePrim.show = false;
                          if (ce.polyPrim) ce.polyPrim.show = false;
                          if (ce.labelCol) ce.labelCol.show = false;
                      }
                  }
              }
              var t = Math.min((time - startTime) / duration, 1);
              var ease = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
              // 밖→안: curMax가 maxDist→0으로 줄어듦
              var curMax = maxDist * (1 - ease);

              animCol.removeAll();
              var lineInstances = [];

              for (var i = 0; i < allChildren.length; i++) {
                  // distance < curMax 인 셀만 표시 (바깥셀부터 사라짐)
                  if (allChildren[i].distance > curMax) continue;
                  lineInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolylineGeometry({ positions: allChildren[i].pos, width: 0.5, arcType: Cesium.ArcType.NONE }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.2)) }
                  }));
              }

              if (lineInstances.length > 0) {
                  animCol.add(new Cesium.Primitive({
                      geometryInstances: lineInstances,
                      appearance: new Cesium.PolylineColorAppearance({
                          flat: true, translucent: true,
                          renderState: { depthTest: { enabled: false }, depthMask: false }
                      }),
                      asynchronous: false
                  }));
              }

              if (t < 1) {
                  _gridShrinkFrame = requestAnimationFrame(drawShrinkFrame);
              } else {
                  _gridShrinkFrame = null;
                  try { viewer.scene.primitives.remove(animCol); } catch(e) {}
                  if (_activeAnimCol === animCol) _activeAnimCol = null;
                  // 자식 primitive 완전 제거 (메모리)
                  if (childEntriesToRemove) {
                      var ckKeys2 = Object.keys(childEntriesToRemove);
                      for (var ci2 = 0; ci2 < ckKeys2.length; ci2++) {
                          var ce2 = childEntriesToRemove[ckKeys2[ci2]];
                          if (ce2.linePrim) { try { trNeighborPrimitives.remove(ce2.linePrim); } catch(e) {} }
                          if (ce2.polyPrim) { try { trNeighborPrimitives.remove(ce2.polyPrim); } catch(e) {} }
                          if (ce2.labelCol) { try { viewer.scene.primitives.remove(ce2.labelCol); } catch(e) {} }
                      }
                  }
                  if (callback) callback();
              }
          }
          _gridShrinkFrame = requestAnimationFrame(drawShrinkFrame);
      }
      var _spreadAnimFrame = null;

      // ═══════════════════════════════════════════════════
      // 카메라 중심 셀 실시간 추적 (preRender)
      // ═══════════════════════════════════════════════════
      var _lastCameraCenterToken = null;
      var _preRenderListener = null;
      var _isFlyingTo = false;

      function startCameraTracking() {
          if (_preRenderListener) return;
          _preRenderListener = viewer.scene.preRender.addEventListener(function() {
              if (mainMode !== 'test2') return;

              var MOON_R = Cesium.Ellipsoid.MOON.maximumRadius;
              var camDist = Cesium.Cartesian3.magnitude(viewer.camera.position);

              // pickPosition (bestPick 계산)
              var sw = viewer.scene.canvas.clientWidth;
              var sh2 = viewer.scene.canvas.clientHeight;
              var pickPts = [[sw*0.5,sh2*0.5],[sw*0.3,sh2*0.3],[sw*0.7,sh2*0.3],[sw*0.3,sh2*0.7],[sw*0.7,sh2*0.7]];
              var bestPick = null;
              for (var pi = 0; pi < pickPts.length; pi++) {
                  var pp = viewer.scene.pickPosition(new Cesium.Cartesian2(pickPts[pi][0], pickPts[pi][1]));
                  if (pp) { bestPick = pp; break; }
              }
              var surfDist = bestPick ? Cesium.Cartesian3.magnitude(bestPick) : MOON_R;
              if (bestPick) _lastKnownTerrainH = surfDist - MOON_R;

              var lastCellId0 = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
              var dbgLevel = lastCellId0 ? s2.cellid.level(lastCellId0) : 0;

              // ── 3단계(L12) 동적 카메라 높이 — 벡터 스케일링 ──
              if (!_isFlyingTo && dbgLevel === 12) {
                  if (bestPick) {
                      var surfaceDist = Cesium.Cartesian3.magnitude(bestPick);
                      var TARGET_ALT = 1000;
                      var desiredDist = surfaceDist + TARGET_ALT;
                      var diff = camDist - desiredDist;
                      if (Math.abs(diff) > 50) {
                          var newDist = camDist + (desiredDist - camDist) * 0.06;
                          var scale = newDist / camDist;
                          viewer.camera.position = Cesium.Cartesian3.multiplyByScalar(
                              viewer.camera.position, scale, new Cesium.Cartesian3()
                          );
                      }
                  }
              }

              if (_isFlyingTo) return;
              if (_spreadAnimFrame) return;
              if (_gridExpandFrame) return;
              if (_gridShrinkFrame) return;
              var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
              if (!lastCellId) return;
              var currentLevel = s2.cellid.level(lastCellId);
              if (currentLevel === 0) return;

              // 카메라 위치의 lat/lon으로 직접 셀 계산 (pickPosition/globe.pick 불안정 대체)
              var camPos = viewer.camera.position;
              var camCarto = Cesium.Cartographic.fromCartesian(camPos, Cesium.Ellipsoid.MOON);
              if (!camCarto) return;

              var lon = camCarto.longitude, lat = camCarto.latitude;
              var cosLat = Math.cos(lat);
              var pt = s2.Point.fromCoords(cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat));
              var cameraCellId = s2.cellid.parent(s2.cellid.fromPoint(pt), currentLevel);
              var cameraCellToken = s2.cellid.toToken(cameraCellId);

              if (cameraCellToken !== _lastCameraCenterToken) {
                  _lastCameraCenterToken = cameraCellToken;
                  renderDynamicGrid(cameraCellId);
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

      // ═══ 0단계 전용: 카메라 방향 실시간 그리드 ═══
      var _l0PreRender = null;

      var L0_GRID_HEIGHT = 8000; // 0단계 그리드 고정 높이

      // renderL0Animated — 개척모드 탭 초기 진입 시 L0 그리드 확산 애니메이션
      var _l0AnimFrame = null;
      function renderL0Animated() {
          if (_l0AnimFrame) { cancelAnimationFrame(_l0AnimFrame); _l0AnimFrame = null; }
          stopL0CameraTracking();
          trGridPrimitives.removeAll();

          // 전체 L4 셀 생성
          var allCells = [];
          for (var f = 0; f < 6; f++) allCells = allCells.concat(getDescendantsTR(s2.cellid.fromFace(f), 4));

          // 카메라 중심점 계산
          var camPos = viewer.camera.positionWC;
          var camCarto = Cesium.Cartographic.fromCartesian(camPos, Cesium.Ellipsoid.MOON);
          var camLon = camCarto ? camCarto.longitude : 0;
          var camLat = camCarto ? camCarto.latitude : 0;

          // 각 셀의 중심→카메라 각도 거리 계산
          var cellDistances = [];
          var maxDist = 0;
          for (var i = 0; i < allCells.length; i++) {
              var c = s2.Cell.fromCellID(allCells[i]);
              var v = c.center();
              var vr = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
              var lon = Math.atan2(v.y, v.x);
              var lat = Math.asin(v.z / vr);
              var dlon = lon - camLon;
              var dlat = lat - camLat;
              var dist = Math.sqrt(dlon*dlon + dlat*dlat);
              cellDistances.push(dist);
              if (dist > maxDist) maxDist = dist;
          }

          // 각 셀의 위치 미리 계산
          var cellPositions = [];
          var cellPolyPositions = [];
          for (var ci = 0; ci < allCells.length; ci++) {
              var pos = getTRCellPositions(allCells[ci], L0_GRID_HEIGHT, 1);
              pos.push(pos[0].clone());
              cellPositions.push(pos);
              // 히트테스트 폴리곤 좌표
              var hc = s2.Cell.fromCellID(allCells[ci]);
              var pp = [];
              for (var j = 0; j < 4; j++) {
                  var hv = hc.vertex(j);
                  var hr = Math.sqrt(hv.x**2+hv.y**2+hv.z**2);
                  pp.push(Cesium.Cartesian3.fromRadians(Math.atan2(hv.y,hv.x), Math.asin(hv.z/hr), L0_GRID_HEIGHT, Cesium.Ellipsoid.MOON));
              }
              cellPolyPositions.push(pp);
          }

          var lColor = Cesium.Color.WHITE;
          var duration = 1000;
          var startTime = null;

          function drawFrame(time) {
              if (!startTime) startTime = time;
              var t = Math.min((time - startTime) / duration, 1);
              var ease = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
              var currentMaxDist = maxDist * ease * 1.15;

              trGridPrimitives.removeAll();
              var lineInstances = [];
              var polyInstances = [];

              for (var i = 0; i < allCells.length; i++) {
                  if (cellDistances[i] > currentMaxDist) continue;
                  // 가장자리 페이드: 안쪽은 불투명, 바깥은 투명
                  var edgeFade = 1.0;
                  if (currentMaxDist > 0) {
                      var ratio = cellDistances[i] / currentMaxDist;
                      edgeFade = Math.max(0, 1.0 - ratio * 0.6);
                  }
                  var color = lColor.withAlpha(0.35 * edgeFade);
                  lineInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolylineGeometry({ positions: cellPositions[i], width: 0.5, arcType: Cesium.ArcType.NONE }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) }
                  }));
                  // 히트테스트 폴리곤도 함께 추가
                  polyInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolygonGeometry({
                          polygonHierarchy: new Cesium.PolygonHierarchy(cellPolyPositions[i]),
                          ellipsoid: Cesium.Ellipsoid.MOON, height: L0_GRID_HEIGHT,
                      }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.01)) },
                      id: allCells[i]
                  }));
              }

              if (lineInstances.length > 0) {
                  trGridPrimitives.add(new Cesium.Primitive({
                      geometryInstances: lineInstances,
                      appearance: new Cesium.PolylineColorAppearance({
                          flat: true, translucent: true,
                          renderState: { depthTest: { enabled: true }, depthMask: false }
                      }),
                      asynchronous: false
                  }));
              }
              if (polyInstances.length > 0) {
                  trGridPrimitives.add(new Cesium.Primitive({
                      geometryInstances: polyInstances,
                      appearance: new Cesium.PerInstanceColorAppearance({
                          flat: true, translucent: true,
                          renderState: { depthTest: { enabled: true }, depthMask: false }
                      }),
                      asynchronous: false
                  }));
              }

              if (t < 1) {
                  _l0AnimFrame = requestAnimationFrame(drawFrame);
              } else {
                  _l0AnimFrame = null;
                  // 애니메이션 완료 (L0는 전체 셀 고정, 트래킹 불필요)
              }
          }
          _l0AnimFrame = requestAnimationFrame(drawFrame);
      }

      function renderL0ForCamera() {
          trGridPrimitives.removeAll();

          // 전체 6면의 L4 셀 생성
          var allCells = [];
          for (var f = 0; f < 6; f++) allCells = allCells.concat(getDescendantsTR(s2.cellid.fromFace(f), 4));

          var lColor = Cesium.Color.WHITE.withAlpha(0.35);
          var lineInstances = [];
          var polyInstances = [];

          for (var i = 0; i < allCells.length; i++) {
              var pos = getTRCellPositions(allCells[i], L0_GRID_HEIGHT, 1);
              pos.push(pos[0].clone());
              lineInstances.push(new Cesium.GeometryInstance({
                  geometry: new Cesium.PolylineGeometry({ positions: pos, width: 0.5, arcType: Cesium.ArcType.NONE }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(lColor) }
              }));

              // 히트테스트 폴리곤
              var hc = s2.Cell.fromCellID(allCells[i]);
              var pp = [];
              for (var j = 0; j < 4; j++) {
                  var hv = hc.vertex(j);
                  var hr = Math.sqrt(hv.x**2+hv.y**2+hv.z**2);
                  pp.push(Cesium.Cartesian3.fromRadians(Math.atan2(hv.y,hv.x), Math.asin(hv.z/hr), L0_GRID_HEIGHT, Cesium.Ellipsoid.MOON));
              }
              polyInstances.push(new Cesium.GeometryInstance({
                  geometry: new Cesium.PolygonGeometry({
                      polygonHierarchy: new Cesium.PolygonHierarchy(pp),
                      ellipsoid: Cesium.Ellipsoid.MOON, height: L0_GRID_HEIGHT,
                  }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.01)) },
                  id: allCells[i]
              }));
          }

          if (lineInstances.length > 0) {
              trGridPrimitives.add(new Cesium.Primitive({
                  geometryInstances: lineInstances,
                  appearance: new Cesium.PolylineColorAppearance({
                      flat: true, translucent: true,
                      renderState: { depthTest: { enabled: true }, depthMask: false }
                  }),
                  asynchronous: false
              }));
          }
          if (polyInstances.length > 0) {
              trGridPrimitives.add(new Cesium.Primitive({
                  geometryInstances: polyInstances,
                  appearance: new Cesium.PerInstanceColorAppearance({
                      flat: true, translucent: true,
                      renderState: { depthTest: { enabled: true }, depthMask: false }
                  }),
                  asynchronous: false
              }));
          }
      }

      function startL0CameraTracking(skipInitialRender) {
          stopL0CameraTracking();
          if (!skipInitialRender) renderL0ForCamera(); // 초기 1회 그리기
          var _l0LastHeading = viewer.camera.heading;
          var _l0LastPitch = viewer.camera.pitch;
          var _l0LastPos = Cesium.Cartesian3.clone(viewer.camera.positionWC);
          var _l0Throttle = 0;

          _l0PreRender = viewer.scene.preRender.addEventListener(function() {
              if (mainMode !== 'test2') return;
              if (_isFlyingTo) return;
              var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
              var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;
              if (currentLevel !== 0) return;

              // 800ms throttle
              var now = Date.now();
              if (now - _l0Throttle < 800) return;

              // 카메라 이동/회전 감지
              var hDiff = Math.abs(viewer.camera.heading - _l0LastHeading);
              var pDiff = Math.abs(viewer.camera.pitch - _l0LastPitch);
              var posDiff = Cesium.Cartesian3.distance(viewer.camera.positionWC, _l0LastPos);
              if (hDiff < 0.03 && pDiff < 0.03 && posDiff < 500) return;

              _l0LastHeading = viewer.camera.heading;
              _l0LastPitch = viewer.camera.pitch;
              _l0LastPos = Cesium.Cartesian3.clone(viewer.camera.positionWC);
              _l0Throttle = now;
              renderL0ForCamera();
          });
      }

      function stopL0CameraTracking() {
          if (_l0PreRender) {
              _l0PreRender();
              _l0PreRender = null;
          }
      }


      function renderTerrain(keepNeighbors, keepL0Grid) {
          stopCameraTracking(); // 기존 preRender 리스너 해제 (race condition 방지)


          if (!keepL0Grid) trGridPrimitives.removeAll();
          if (!keepNeighbors) {
              trNeighborPrimitives.removeAll();
              clearRenderedCellMap();
          }
          trAccumulatedPrimitives.removeAll();
          _activeToken = null;
          _lastCameraCenterToken = null;
          stopL0CameraTracking();
          if (_spreadAnimFrame) { cancelAnimationFrame(_spreadAnimFrame); _spreadAnimFrame = null; }
          if (_l0AnimFrame) { cancelAnimationFrame(_l0AnimFrame); _l0AnimFrame = null; }
          // 점유 라벨 정리
          if (_occupationLabels) {
              viewer.scene.primitives.remove(_occupationLabels);
              _occupationLabels = null;
          }

          var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;

          if (currentLevel === 0) {
              // ══════ 0단계: 전체 L4 그리드 1회 렌더 (카메라 트래킹 불필요) ══════
              renderL0ForCamera();
          }


          updateUI();
      }
`;
