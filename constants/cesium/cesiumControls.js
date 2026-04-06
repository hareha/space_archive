// cesiumControls.js — 클릭 핸들러 + 줌 + RN 메시지 라우팅 모듈
// handleRNMessage, 클릭 핸들러, changeZoomLevel

export const CESIUM_CONTROLS = `
var selectLevel = 16; // 14, 15, 16 중 선택 레벨
var occupiedTokens = []; // 점유된 셀 토큰 목록 (DB에서 로드)
var myOccupiedTokens = []; // 내가 점유한 셀 토큰 (구매 확정한 것)
var _occupiedSet = {};    // O(1) 룩업용 해시셋
var _myOccupiedSet = {};  // O(1) 룩업용 해시셋
var _featureHighlightPrimitive = null; // 지형 하이라이트 Primitive
var _adImageryLayer = null; // 광고 이미지 레이어

// 지형 하이라이트 오버레이 관리
function clearFeatureHighlight() {
    try {
        if (_featureHighlightPrimitive) {
            viewer.scene.primitives.remove(_featureHighlightPrimitive);
        }
    } catch(e) { console.log('[Controls] clearFeatureHighlight remove error:', e); }
    _featureHighlightPrimitive = null;
    // 탐사모드의 지형 면적 색칠(ClassificationPrimitive)도 제거
    if (typeof hideFeatureArea === 'function') {
        hideFeatureArea();
    }
    console.log('[Controls] Feature highlight cleared');
}

function handleRNMessage(data) {
    try {
        let message = data;
        if (typeof data === 'string') {
            try {
                message = JSON.parse(data);
            } catch(e) {
                console.error("Failed to parse RN message:", data);
                return;
            }
        }
        if (!message || !message.type) return;

        if (message.type === 'GO_BACK') {
            if (mainMode === 'test2' || mainMode === 'test3') return; // 각 모드 전용 컨트롤러에서 처리
            goBack();
        }
        if (message.type === 'RESET') resetExplorer();
        if (message.type === 'RESET_GRID_ONLY') {
            // 그리드만 0레벨로 리셋 (카메라 이동 없음)
            console.log('[Controls] RESET_GRID_ONLY received');
            if (currentAnimFrame) { cancelAnimationFrame(currentAnimFrame); currentAnimFrame = null; }
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
            if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.removeAll();
            if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.removeAll();
            if (typeof trNeighborPrimitives !== 'undefined' && trNeighborPrimitives) trNeighborPrimitives.removeAll();
            if (typeof trFlashPrimitives !== 'undefined' && trFlashPrimitives) trFlashPrimitives.removeAll();
            if (typeof trAccumulatedPrimitives !== 'undefined' && trAccumulatedPrimitives) trAccumulatedPrimitives.removeAll();
            window.trSelectionPrimMap = {};
            if (typeof _renderedCellMap !== 'undefined') {
                for (var rk in _renderedCellMap) {
                    if (_renderedCellMap[rk] && _renderedCellMap[rk].labelCol) {
                        try { viewer.scene.primitives.remove(_renderedCellMap[rk].labelCol); } catch(e) {}
                    }
                }
                _renderedCellMap = {};
            }
            if (typeof _removeOccInfoLabel === 'function') _removeOccInfoLabel();
            var _popupEl2 = document.getElementById('occInfoPopup');
            if (_popupEl2) _popupEl2.style.display = 'none';
            window._occInfoPos = null;
            if (window._occHighlightPrim) {
                try { if (typeof trGridPrimitives !== 'undefined') trGridPrimitives.remove(window._occHighlightPrim); } catch(e) {}
                window._occHighlightPrim = null;
            }
            if (mainMode === 'test2') { renderTerrain(); }
            else if (mainMode === 'test1') { renderPolyline(); }
            else { render(); }
            updateUI();
            sendToRN('CELL_DESELECTED', {});
            try { viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); } catch(e) {}
        }
        if (message.type === 'RESET_AND_FLY') {
            var _rfPayload = message.payload;
            console.log('[Controls] RESET_AND_FLY received:', _rfPayload.lat, _rfPayload.lng);
            try {
                resetAndFlyTo(_rfPayload.lat, _rfPayload.lng);
            } catch(rfErr) {
                console.error('[Controls] RESET_AND_FLY error:', rfErr);
                // 폴백: 리셋만이라도 실행
                resetExplorer();
            }
        }
        if (message.type === 'TOGGLE_GRID') {
            showGrid = message.payload;
            if (gridPrimitives) gridPrimitives.show = showGrid;
        }
        if (message.type === 'UPDATE_GRID_VISIBILITY') {
            updateGridVisibility(message.visible);
        }
        if (message.type === 'FIRST_PERSON_MOVE') {
            const { direction, isPressed } = message.payload;
            firstPersonData[direction] = isPressed;
        }
        if (message.type === 'LOAD_SATELLITE_DATA') {
            drawSatelliteData(message.data);
        }
        if (message.type === 'TOGGLE_AD') {
            var adPayload = message.payload;
            if (adPayload.show && adPayload.imageBase64) {
                if (_adImageryLayer) {
                    viewer.scene.primitives.remove(_adImageryLayer);
                    _adImageryLayer = null;
                }
                try {
                    var adImg = new Image();
                    adImg.onload = function() {
                        // 달 표면에 밀착하는 광고 오버레이 (원본 891x165 비율 유지)
                        var adHalfW = 4; // 경도 ±4도 (총 8도)
                        var adHalfH = 4; // 원본 비율 1:1 → ±4도
                        var adCenterLat = 0; // 적도
                        var adRect = Cesium.Rectangle.fromDegrees(-adHalfW, adCenterLat - adHalfH, adHalfW, adCenterLat + adHalfH);
                        // 메인 이미지 (지형에 가깝게 배치)
                        var adGeometry = new Cesium.RectangleGeometry({
                            rectangle: adRect,
                            ellipsoid: Cesium.Ellipsoid.MOON,
                            height: 4500
                        });
                        _adImageryLayer = new Cesium.Primitive({
                            geometryInstances: new Cesium.GeometryInstance({ geometry: adGeometry }),
                            appearance: new Cesium.MaterialAppearance({
                                material: new Cesium.Material({
                                    fabric: {
                                        type: 'Image',
                                        uniforms: { image: adImg, color: new Cesium.Color(1, 1, 1, 0.85) }
                                    }
                                }),
                                renderState: {
                                    depthTest: { enabled: true },
                                    blending: Cesium.BlendingState.ALPHA_BLEND
                                }
                            }),
                            show: true
                        });
                        viewer.scene.primitives.add(_adImageryLayer);
                        console.log('[AD] Surface-hugging ad overlay on moon');
                    };
                    adImg.src = 'data:image/png;base64,' + adPayload.imageBase64;
                } catch(adErr) {
                    console.error('[AD] Error:', adErr);
                }
            } else {
                if (_adImageryLayer) {
                    viewer.scene.primitives.remove(_adImageryLayer);
                    _adImageryLayer = null;
                }
            }
        }
        if (message.type === 'UPDATE_MODE') {
            updateAppMode(message.payload);
        }
        if (message.type === 'CHANGE_GRID_COLOR') {
            if (mainMode !== 'test1' && mainMode !== 'test2' && mainMode !== 'test3') render();
        }
        if (message.type === 'ZOOM_IN') {
            // 점유모드 전용: 레벨 기반 단계 줌
            changeZoomLevel(1);
        }
        if (message.type === 'ZOOM_OUT') {
            // 점유모드 전용: 레벨 기반 단계 줌
            changeZoomLevel(-1);
        }
        if (message.type === 'EXPLORE_ZOOM_IN') {
            exploreZoom(1);
        }
        if (message.type === 'EXPLORE_ZOOM_OUT') {
            exploreZoom(-1);
        }
        if (message.type === 'SELECT_CENTER_CELL') {
            // 개척모드2/3은 각자의 컨트롤러가 처리
            if (mainMode === 'test2' || mainMode === 'test3') return;
            // 점유모드 전용: 화면 중앙의 셀을 선택하여 뎁스를 깊이 들어감
            var canvas = viewer.scene.canvas;
            var centerX = Math.floor(canvas.clientWidth / 2);
            var centerY = Math.floor(canvas.clientHeight / 2);
            var ray = viewer.camera.getPickRay(new Cesium.Cartesian2(centerX, centerY));
            if (!ray) return;
            var intersection = Cesium.IntersectionTests.rayEllipsoid(ray, Cesium.Ellipsoid.MOON);
            if (!intersection) return;
            var point = Cesium.Ray.getPoint(ray, intersection.start);
            var carto = Cesium.Cartographic.fromCartesian(point, Cesium.Ellipsoid.MOON);
            var latRad = carto.latitude;
            var lngRad = carto.longitude;

            // S2 포인트 계산
            var s2Pt = new s2.Point(
                Math.cos(latRad) * Math.cos(lngRad),
                Math.cos(latRad) * Math.sin(lngRad),
                Math.sin(latRad)
            );
            var leafId = s2.cellid.fromPoint(s2Pt);

            // 현재 스택 뎁스에 따라 다음 레벨 결정
            var depth = selectionStack.length;
            var targetLevel;
            if (depth === 0) targetLevel = 4;
            else if (depth === 1) targetLevel = 8;
            else if (depth === 2) targetLevel = 12;
            else return; // 이미 3단계 이상이면 무시

            var cellId = s2.cellid.parent(leafId, targetLevel);

            flashCell(cellId);
            selectionStack.push(cellId);
            if (mainMode === 'test2') {
                renderTerrain();
            } else if (mainMode === 'test1') {
                renderPolyline();
            } else {
                render();
            }
            if (mainMode === 'test2') {
                flyToCellTR(cellId, targetLevel >= 8);
            } else if (mainMode === 'test1') {
                flyToCellPL(cellId);
            } else {
                flyToCell(cellId);
            }
        }
        if (message.type === 'SET_SELECT_LEVEL') {
            selectLevel = message.payload.level || 16;
            // 이미 3단계(16레벨 표시)면 re-render
            var _lastId = selectionStack.length > 0 ? selectionStack[selectionStack.length - 1] : null;
            if (_lastId && s2.cellid.level(_lastId) >= 12) {
                if (mainMode === 'test2') {
                    renderTerrain();
                } else if (mainMode === 'test1') {
                    renderPolyline();
                } else {
                    render(false, true);
                }
            }
        }
        if (message.type === 'DESELECT_CELL') {
            // 셀 선택만 해제, selectionStack 유지 → 격자 재렌더 + 카메라 복귀
            if (mainMode === 'test2') {
                renderTerrain();
                if (selectionStack.length > 0) {
                    flyToCellTR(selectionStack[selectionStack.length - 1]);
                }
            } else if (mainMode === 'test1') {
                renderPolyline();
                if (selectionStack.length > 0) {
                    flyToCellPL(selectionStack[selectionStack.length - 1]);
                }
            } else {
                render();
                if (selectionStack.length > 0) {
                    flyToCell(selectionStack[selectionStack.length - 1]);
                }
            }
        }
        if (message.type === 'OCCUPY_CELLS') {
            // 점유 확정: 토큰을 L16으로 전개하여 저장
            var tokens = message.payload.tokens || [];
            var lvl = message.payload.level || 16;
            tokens.forEach(function(t) {
                var cid = s2.cellid.fromToken(t);
                if (lvl < 16) {
                    var desc;
                    if (mainMode === 'test2') desc = getDescendantsTR(cid, 16);
                    else if (mainMode === 'test1') desc = getDescendantsPL(cid, 16);
                    else desc = getDescendants(cid, 16);
                    desc.forEach(function(d) {
                        var dt = s2.cellid.toToken(d);
                        if (!_occupiedSet[dt]) { occupiedTokens.push(dt); _occupiedSet[dt] = 1; }
                        if (!_myOccupiedSet[dt]) { myOccupiedTokens.push(dt); _myOccupiedSet[dt] = 1; }
                    });
                } else {
                    if (!_occupiedSet[t]) { occupiedTokens.push(t); _occupiedSet[t] = 1; }
                    if (!_myOccupiedSet[t]) { myOccupiedTokens.push(t); _myOccupiedSet[t] = 1; }
                }
            });
            window.multiSelectedL16 = [];
            // 선택 하이라이트 정리 (모드1용)
            if (typeof selectionPrimitives !== 'undefined') selectionPrimitives.removeAll();
            window.selectionPrimMap = {};
            // 개척모드(test2) 선택 하이라이트 정리
            if (window.trSelectionPrimMap) {
                var spk = Object.keys(window.trSelectionPrimMap);
                for (var si = 0; si < spk.length; si++) {
                    try { trGridPrimitives.remove(window.trSelectionPrimMap[spk[si]]); } catch(e) {}
                }
                window.trSelectionPrimMap = {};
            }
            if (mainMode === 'test2') {
                // 점유 색상 즉시 반영
                _isFlyingTo = false;
                trNeighborPrimitives.removeAll();
                clearRenderedCellMap();
                _activeToken = null;
                renderDynamicGrid();
                startCameraTracking();
                viewer.scene.requestRender();
                // 비동기 안전장치: 500ms 후 한번 더 갱신 (DB 저장 후 SET_OCCUPIED_TOKENS 대비)
                setTimeout(function() {
                    trNeighborPrimitives.removeAll();
                    clearRenderedCellMap();
                    _activeToken = null;
                    renderDynamicGrid();
                    viewer.scene.requestRender();
                }, 500);
            } else if (mainMode === 'test1') {
                renderPolyline();
            } else {
                render(false, true);
            }
        }
        if (message.type === 'SET_OCCUPIED_TOKENS') {
            // DB에서 로드한 점유 토큰 일괄 설정
            occupiedTokens = message.payload.tokens || [];
            // 해시셋 빌드 (O(1) 룩업)
            _occupiedSet = {};
            for (var _si = 0; _si < occupiedTokens.length; _si++) _occupiedSet[occupiedTokens[_si]] = 1;
            // 내 셀 목록 설정
            if (message.payload.myTokens) {
                myOccupiedTokens = message.payload.myTokens;
            }
            _myOccupiedSet = {};
            for (var _mi = 0; _mi < myOccupiedTokens.length; _mi++) _myOccupiedSet[myOccupiedTokens[_mi]] = 1;
            // 탐사모드의 지형 면적 색칠 제거 (점유모드 진입 시)
            if (typeof hideFeatureArea === 'function') hideFeatureArea();
            console.log('[Controls] SET_OCCUPIED_TOKENS:', occupiedTokens.length, 'tokens,', myOccupiedTokens.length, 'mine');
            // 현재 모드에 맞게 재렌더
            if (mainMode === 'test2') {
                // fly 중이면 무시 (fly 완료 콜백에서 갱신됨)
                if (typeof _isFlyingTo !== 'undefined' && _isFlyingTo) return;
                trNeighborPrimitives.removeAll();
                clearRenderedCellMap();
                _activeToken = null;
                renderDynamicGrid();
                viewer.scene.requestRender();
            } else if (mainMode === 'test1') {
                if (typeof renderPolyline === 'function') renderPolyline();
            } else if (mainMode === 'occupation') {
                if (typeof clearAllOccRendered === 'function') clearAllOccRendered();
                if (typeof render === 'function') render();
            }
        }
        if (message.type === 'SET_FEATURE_HIGHLIGHT') {
            // 지형 하이라이트: 탐사모드와 동일한 ClassificationPrimitive (지형 따라감)
            var hlPayload = message.payload;
            clearFeatureHighlight();
            if (hlPayload && hlPayload.lat !== undefined) {
                var hlRadiusKm = hlPayload.radiusKm || 5;
                var hlColor = Cesium.Color.fromCssColorString('#3B82F6');
                // 탐사모드의 generateAreaPositions 사용 (원형)
                var positions = generateAreaPositions(hlPayload.lat, hlPayload.lng, hlRadiusKm * 2, hlRadiusKm * 2, 0, 64);
                _featureHighlightPrimitive = viewer.scene.primitives.add(new Cesium.ClassificationPrimitive({
                    geometryInstances: new Cesium.GeometryInstance({
                        geometry: new Cesium.PolygonGeometry({
                            polygonHierarchy: new Cesium.PolygonHierarchy(positions),
                            ellipsoid: Cesium.Ellipsoid.MOON,
                            height: -20000,
                            extrudedHeight: 20000,
                        }),
                        attributes: {
                            color: Cesium.ColorGeometryInstanceAttribute.fromColor(hlColor.withAlpha(0.2))
                        }
                    }),
                    appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                    classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
                    asynchronous: false,
                }));
                console.log('[Controls] Feature highlight set:', hlPayload.name, hlRadiusKm + 'km');
            }
        }
        if (message.type === 'CLEAR_FEATURE_HIGHLIGHT') {
            clearFeatureHighlight();
        }
        if (message.type === 'UPDATE_MAG_BALANCE') {
            window.magBalance = message.payload.balance || 0;
        }
        if (message.type === 'RESET_VIEW') {
            // 자동 회전 정리
            if (window._autoOrbitRemove) {
                window._autoOrbitRemove();
                window._autoOrbitRemove = null;
            }
            // 위성/착륙지 포커스 해제
            viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
            if (_focusSatPos) {
                _focusSatPos = null;
                _focusSatLookTarget = null;
                _focusSatName = null;
            }
            // 위성 하이라이트만 해제 (drawSatelliteData 재호출 X — 토글 꺼진 상태면 위성 안 보여야 함)
            highlightedSatelliteName = null;
            _focusSatName = null;
            // pitch clamp 리스너 해제
            if (window._fpPitchClamp) { window._fpPitchClamp(); window._fpPitchClamp = null; }
            if (window._orbitPitchClamp) { window._orbitPitchClamp(); window._orbitPitchClamp = null; }
            window._orbitState = null;
            window._fpAboveAlt = null;
            // 3D 깃발 제거
            if (window._fpFlagEntities) {
                window._fpFlagEntities.forEach(function(e) { viewer.entities.remove(e); });
                window._fpFlagEntities = null;
            }
            // 탐사모드로 복귀: 빌트인 컨트롤러 기본값 복원
            viewer.scene.screenSpaceCameraController.enableRotate = true;
            viewer.scene.screenSpaceCameraController.enableTranslate = false;
            viewer.scene.screenSpaceCameraController.enableZoom = true;
            viewer.scene.screenSpaceCameraController.enableTilt = false;
            viewer.scene.screenSpaceCameraController.enableLook = false;
            viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1000;
            viewer.scene.screenSpaceCameraController.maximumZoomDistance = 10000000;

            // 점유 하이라이트 정리 (DB 점유 토큰은 유지)
            clearFeatureHighlight();

            resetExplorer();
        }
        if (message.type === 'ROTATE_TO_LOCATION') {
            // 현재 위치 → 목적지를 직선 lerp로 이동 (flyToCell 방식)
            var rlPayload = message.payload;
            var rlLatRad = Cesium.Math.toRadians(rlPayload.lat);
            var rlLngRad = Cesium.Math.toRadians(rlPayload.lng);
            // 현재 카메라 고도 (불안정 시 fallback)
            var camCarto = viewer.camera.positionCartographic;
            var currentHeight = camCarto ? camCarto.height : 500000;
            if (currentHeight < 10000 || currentHeight > 5000000) currentHeight = 500000;
            var targetPos = Cesium.Cartesian3.fromRadians(rlLngRad, rlLatRad, currentHeight, Cesium.Ellipsoid.MOON);
            var startPos = Cesium.Cartesian3.clone(viewer.camera.position);
            var startHeading = viewer.camera.heading;
            var startPitch = viewer.camera.pitch;
            var targetPitch = Cesium.Math.toRadians(-90);
            var lerpDuration = 1500;
            var lerpStart = null;
            viewer.camera.cancelFlight();
            function lerpAnimate(ts) {
                if (!lerpStart) lerpStart = ts;
                var progress = (ts - lerpStart) / lerpDuration;
                if (progress >= 1.0) {
                    viewer.camera.setView({ destination: targetPos, orientation: { heading: startHeading, pitch: targetPitch, roll: 0 } });
                    return;
                }
                var t = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                var curPos = new Cesium.Cartesian3();
                Cesium.Cartesian3.lerp(startPos, targetPos, t, curPos);
                var curPitch = Cesium.Math.lerp(startPitch, targetPitch, t);
                viewer.camera.setView({ destination: curPos, orientation: { heading: startHeading, pitch: curPitch, roll: 0 } });
                requestAnimationFrame(lerpAnimate);
            }
            requestAnimationFrame(lerpAnimate);
            console.log('[Controls] ROTATE_TO_LOCATION (lerp):', rlPayload.lat, rlPayload.lng, 'height:', currentHeight);
        }
        if (message.type === 'GO_TO_LOCATION') {
            // 1인칭 모드 중이면 무시 (GO_TO_LOCATION이 1인칭 flyTo를 취소하지 않도록)
            if (window._firstPersonMode) {
                console.log('[Controls] GO_TO_LOCATION ignored — first person mode active');
                return;
            }
            const { lat, lng, orbit } = message.payload;
            // 선택 마커 하이라이트
            if (window.highlightLandmark) {
                window.highlightLandmark(lat, lng);
            }
            const latRad = Cesium.Math.toRadians(lat);
            const lngRad = Cesium.Math.toRadians(lng);

            const altitude = 150000;

            // 기존 자동 회전 정리
            if (window._autoOrbitRemove) {
                window._autoOrbitRemove();
                window._autoOrbitRemove = null;
            }
            window._orbitState = null;
            if (window._goToTickListener) {
                viewer.clock.onTick.removeEventListener(window._goToTickListener);
                window._goToTickListener = null;
            }
            viewer.camera.cancelFlight();
            viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

            function _ease(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }
            function _lerpA(a,b,t) { var d=b-a; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; return a+d*t; }

            // 이동 시작 전 즉시 높이 계산 (타일 로드되어 있으면 즉시 배치)
            if (window.resolveAllLandingHeights) window.resolveAllLandingHeights();

            if (orbit) {
                var orbitAlt = 20000;
                // 지형 높이 측정하여 orbit 중심점 설정
                var terrainH = 0;
                var targetCarto = Cesium.Cartographic.fromRadians(lngRad, latRad);
                var sh = viewer.scene.sampleHeight(targetCarto);
                if (sh !== undefined && sh !== null && !isNaN(sh)) terrainH = sh;
                var center = Cesium.Cartesian3.fromRadians(lngRad, latRad, terrainH, Cesium.Ellipsoid.MOON);
                var transform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
                var tPitch = Cesium.Math.toRadians(-45), tRange = orbitAlt;

                // 이미 orbit 중이면 이전 range/pitch 유지
                if (window._orbitState) {
                    tRange = window._orbitState.range || orbitAlt;
                    tPitch = window._orbitState.pitch || Cesium.Math.toRadians(-45);
                }

                // 기존 orbit 정리
                if (window._autoOrbitRemove) { window._autoOrbitRemove(); window._autoOrbitRemove = null; }
                if (window._orbitPitchClamp) { window._orbitPitchClamp(); window._orbitPitchClamp = null; }
                if (window._orbitState) {
                    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
                    window._orbitState = null;
                }

                // flyTo 목적지: 타겟 남쪽 오프셋 위치 (lookAt heading=0 기준)
                var hDist = tRange * Math.cos(Math.abs(tPitch));
                var vDist = tRange * Math.sin(Math.abs(tPitch));
                // ENU 프레임에서 남쪽 오프셋 → 위경도로 변환 (약산)
                var moonR = Cesium.Ellipsoid.MOON.maximumRadius;
                var latOffset = hDist / moonR;
                var flyLat = latRad - latOffset;
                var flyDest = Cesium.Cartesian3.fromRadians(lngRad, flyLat, vDist, Cesium.Ellipsoid.MOON);

                // 현재 높이와 타겟 높이 중 큰 값으로 maxHeight 설정 (하늘 치솟기 방지)
                var curAlt = viewer.camera.positionCartographic ? viewer.camera.positionCartographic.height : orbitAlt;
                var maxH = Math.max(curAlt, vDist) * 1.05;

                var flyDuration = window._orbitState === null && curAlt > 100000 ? 3.0 : 2.5;

                viewer.camera.flyTo({
                    destination: flyDest,
                    orientation: { heading: 0, pitch: tPitch, roll: 0 },
                    duration: flyDuration,
                    maximumHeight: maxH,
                    easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
                    complete: function() {
                        // lookAtTransform 진입
                        viewer.camera.lookAtTransform(transform, new Cesium.HeadingPitchRange(0, tPitch, tRange));
                        window._orbitState = { transform: transform, heading: 0, pitch: tPitch, range: tRange };

                        // 높이 재계산 (lookAtTransform 후 moveEnd 발생 안 하므로 직접 호출)
                        if (window.resolveAllLandingHeights) window.resolveAllLandingHeights();

                        // 자동 회전
                        var oh = 0, stopped = false;
                        var orbitTick = function() {
                            if (stopped) return;
                            oh += 0.05 / 60;
                            var curR = window._orbitState ? window._orbitState.range : tRange;
                            viewer.camera.lookAtTransform(transform, new Cesium.HeadingPitchRange(oh, tPitch, curR));
                            if (window._orbitState) { window._orbitState.heading = oh; window._orbitState.range = curR; }
                        };
                        viewer.clock.onTick.addEventListener(orbitTick);
                        var stopOrbit = function() {
                            if (stopped) return; stopped = true;
                            viewer.clock.onTick.removeEventListener(orbitTick);
                        };
                        var cvs = viewer.canvas;
                        ['pointerdown','wheel'].forEach(function(ev) { cvs.addEventListener(ev, stopOrbit, {once:true}); });
                        viewer.scene.screenSpaceCameraController.enableTilt = true;
                        if (window._orbitPitchClamp) { window._orbitPitchClamp(); window._orbitPitchClamp = null; }
                        var _orbitClampListener = viewer.scene.preUpdate.addEventListener(function() {
                            if (!window._orbitState) return;
                            var minPitch = Cesium.Math.toRadians(-70);
                            var maxPitch = Cesium.Math.toRadians(-15);
                            if (viewer.camera.pitch < minPitch) {
                                viewer.camera.lookAtTransform(window._orbitState.transform, new Cesium.HeadingPitchRange(viewer.camera.heading, minPitch, window._orbitState.range));
                            } else if (viewer.camera.pitch > maxPitch) {
                                viewer.camera.lookAtTransform(window._orbitState.transform, new Cesium.HeadingPitchRange(viewer.camera.heading, maxPitch, window._orbitState.range));
                            }
                        });
                        window._orbitPitchClamp = function() { _orbitClampListener(); };
                        window._autoOrbitRemove = function() {
                            stopOrbit();
                            ['pointerdown','wheel'].forEach(function(ev) { cvs.removeEventListener(ev, stopOrbit); });
                        };
                    }
                });
            } else {
                // 일반: setView lerp
                var startCarto = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC, Cesium.Ellipsoid.MOON);
                if (!startCarto) startCarto = new Cesium.Cartographic(lngRad, latRad, altitude);
                var sLon = startCarto.longitude, sLat = startCarto.latitude, sAlt = startCarto.height;
                var sH = viewer.camera.heading, sP = viewer.camera.pitch;
                var dur2 = 1500, st2 = Date.now();
                var tk2 = function() {
                    var t = Math.min((Date.now()-st2)/dur2, 1.0), e = _ease(t);
                    viewer.camera.setView({
                        destination: Cesium.Cartesian3.fromRadians(sLon+(lngRad-sLon)*e, sLat+(latRad-sLat)*e, sAlt+(altitude-sAlt)*e, Cesium.Ellipsoid.MOON),
                        orientation: { heading: _lerpA(sH,0,e), pitch: sP+(Cesium.Math.toRadians(-90)-sP)*e, roll: 0 }
                    });
                    if (t >= 1.0) {
                        viewer.clock.onTick.removeEventListener(tk2);
                        window._goToTickListener = null;
                        if (window.resolveAllLandingHeights) window.resolveAllLandingHeights();
                    }
                };
                window._goToTickListener = tk2;
                viewer.clock.onTick.addEventListener(tk2);
            }
        }
        // 특정 좌표에서 공중뷰 (lerp 기반 매끄러운 전환, 바운스 없음)
        if (message.type === 'FIRST_PERSON_AT') {
            const { lat, lng } = message.payload;
            const latRad = Cesium.Math.toRadians(lat);
            const lngRad = Cesium.Math.toRadians(lng);

            const aboveAlt = 20000;

            var terrainProvider = viewer.terrainProvider;
            var carto = new Cesium.Cartographic(lngRad, latRad, 0);

            function doFlyToSurface(terrainHeight) {
                var safeHeight = (terrainHeight && !isNaN(terrainHeight)) ? Math.max(0, terrainHeight) : 0;
                var lookTarget = Cesium.Cartesian3.fromRadians(lngRad, latRad, safeHeight, Cesium.Ellipsoid.MOON);
                var viewPitch = -60;
                var viewPitchRad = Cesium.Math.toRadians(viewPitch);

                // 기존 깃발 제거
                if (window._fpFlagEntities) {
                    window._fpFlagEntities.forEach(function(e) { viewer.entities.remove(e); });
                }
                window._fpFlagEntities = [];

                // lookAt이 카메라를 배치할 위치 계산
                var horizDist = aboveAlt * Math.cos(Math.abs(viewPitchRad));
                var vertDist = aboveAlt * Math.sin(Math.abs(viewPitchRad));
                var latOffsetRad = horizDist / 1737400;
                var camLat = latRad - latOffsetRad;
                var camAlt = safeHeight + vertDist;

                // 카메라 현재 위치를 달 타원체 기준 Cartographic으로 변환
                // (positionCartographic는 scene 기본 타원체(WGS84)를 쓸 수 있어 오류 발생)
                var startCarto = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC, Cesium.Ellipsoid.MOON);
                if (!startCarto) {
                    // fallback
                    startCarto = new Cesium.Cartographic(lngRad, latRad, 150000);
                }
                var targetLon = lngRad;
                var targetLat = camLat;
                var targetAlt = camAlt;
                var startHeading = viewer.camera.heading;
                var startPitch = viewer.camera.pitch;
                var targetPitchVal = viewPitchRad;
                var duration = 1500;
                var startTime = null;

                if (window._fpAnimFrame) { cancelAnimationFrame(window._fpAnimFrame); window._fpAnimFrame = null; }

                function onArrival() {
                    viewer.camera.lookAt(
                        lookTarget,
                        new Cesium.HeadingPitchRange(0, viewPitchRad, aboveAlt)
                    );

                    // ── 위치 마커 생성 ──
                    var pinCanvas = document.createElement('canvas');
                    pinCanvas.width = 48;
                    pinCanvas.height = 120;
                    var ctx = pinCanvas.getContext('2d');
                    var cx = 24;

                    ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(cx, 30);
                    ctx.lineTo(cx, 110);
                    ctx.stroke();

                    var glow = ctx.createRadialGradient(cx, 112, 0, cx, 112, 8);
                    glow.addColorStop(0, 'rgba(96, 165, 250, 0.8)');
                    glow.addColorStop(1, 'rgba(96, 165, 250, 0)');
                    ctx.fillStyle = glow;
                    ctx.beginPath();
                    ctx.arc(cx, 112, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#60A5FA';
                    ctx.beginPath();
                    ctx.arc(cx, 112, 3, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.save();
                    ctx.translate(cx, 16);
                    ctx.rotate(Math.PI / 4);
                    ctx.shadowColor = '#60A5FA';
                    ctx.shadowBlur = 8;
                    ctx.fillStyle = '#1E3A5F';
                    ctx.fillRect(-9, -9, 18, 18);
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = '#60A5FA';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(-9, -9, 18, 18);
                    ctx.fillStyle = '#60A5FA';
                    ctx.fillRect(-4, -4, 8, 8);
                    ctx.restore();

                    var pinImg = pinCanvas.toDataURL();
                    var pinBillboard = viewer.entities.add({
                        position: Cesium.Cartesian3.fromRadians(lngRad, latRad, 0, Cesium.Ellipsoid.MOON),
                        billboard: {
                            image: pinImg,
                            scale: 0.7,
                            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                            disableDepthTestDistance: Number.POSITIVE_INFINITY,
                            scaleByDistance: new Cesium.NearFarScalar(1000, 1.2, 30000, 0.6),
                        },
                        show: true,
                    });
                    window._fpFlagEntities.push(pinBillboard);

                    viewer.scene.screenSpaceCameraController.enableRotate = true;
                    viewer.scene.screenSpaceCameraController.enableTranslate = false;
                    viewer.scene.screenSpaceCameraController.enableZoom = true;
                    viewer.scene.screenSpaceCameraController.enableTilt = true;
                    viewer.scene.screenSpaceCameraController.enableLook = false;
                    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 500;
                    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 100000;

                    if (window._fpPitchClamp) { window._fpPitchClamp(); window._fpPitchClamp = null; }
                    window._fpLookTarget = lookTarget;
                    window._fpAboveAlt = aboveAlt;
                    window._fpPitchClamp = viewer.scene.preUpdate.addEventListener(function() {
                        var targetPos = window._fpLookTarget;
                        if (!targetPos) return;
                        var targetCarto = Cesium.Cartographic.fromCartesian(targetPos, Cesium.Ellipsoid.MOON);
                        var camCarto = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC, Cesium.Ellipsoid.MOON);
                        if (camCarto && targetCarto && camCarto.height < targetCarto.height + 200) {
                            viewer.camera.lookAt(
                                targetPos,
                                new Cesium.HeadingPitchRange(
                                    viewer.camera.heading,
                                    Cesium.Math.toRadians(-5),
                                    window._fpAboveAlt
                                )
                            );
                        }
                    });

                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FIRST_PERSON_READY' }));
                }

                // Cartographic 보간 (달 표면을 따라 이동)
                var dLon = targetLon - startCarto.longitude;
                if (dLon > Math.PI) dLon -= 2 * Math.PI;
                if (dLon < -Math.PI) dLon += 2 * Math.PI;
                var dLat = targetLat - startCarto.latitude;
                var dAlt = targetAlt - startCarto.height;
                var minAlt = safeHeight + 500; // 지형 위 최소 500m (관통 방지)

                // heading 최단 경로 보정 (2π 전체 회전 방지)
                var dHeading = 0 - startHeading; // target heading = 0
                if (dHeading > Math.PI) dHeading -= 2 * Math.PI;
                if (dHeading < -Math.PI) dHeading += 2 * Math.PI;

                function animate(timestamp) {
                    if (!startTime) startTime = timestamp;
                    var progress = (timestamp - startTime) / duration;
                    if (progress >= 1.0) {
                        var finalPos = Cesium.Cartesian3.fromRadians(targetLon, targetLat, targetAlt, Cesium.Ellipsoid.MOON);
                        viewer.camera.setView({
                            destination: finalPos,
                            orientation: { heading: 0, pitch: targetPitchVal, roll: 0 }
                        });
                        window._fpAnimFrame = null;
                        onArrival();
                        return;
                    }
                    // easeOutCubic
                    var t = 1 - Math.pow(1 - progress, 3);
                    var curLon = startCarto.longitude + dLon * t;
                    var curLat = startCarto.latitude + dLat * t;
                    var curAlt = Math.max(minAlt, startCarto.height + dAlt * t);
                    var currentPos = Cesium.Cartesian3.fromRadians(curLon, curLat, curAlt, Cesium.Ellipsoid.MOON);
                    var currentPitch = startPitch + (targetPitchVal - startPitch) * t;
                    var currentHeading = startHeading + dHeading * t;
                    viewer.camera.setView({
                        destination: currentPos,
                        orientation: { heading: currentHeading, pitch: currentPitch, roll: 0 }
                    });
                    window._fpAnimFrame = requestAnimationFrame(animate);
                }
                window._fpAnimFrame = requestAnimationFrame(animate);
            }

            // 지형 높이 측정 시도
            if (terrainProvider && typeof Cesium.sampleTerrainMostDetailed === 'function') {
                Cesium.sampleTerrainMostDetailed(terrainProvider, [carto]).then(function(updatedPositions) {
                    doFlyToSurface(updatedPositions[0].height);
                }).catch(function() {
                    var h = viewer.scene.globe.getHeight(carto);
                    doFlyToSurface(h);
                });
            } else {
                var h = viewer.scene.globe.getHeight(carto);
                doFlyToSurface(h);
            }
        }
        if (message.type === 'FOCUS_SATELLITE') {
            // 위성 전체뷰: 달 전체가 보이는 약간 줌된 뷰 (lookAt 안함)
            var satName = message.payload.name;
            highlightSatellite(satName);

            // 기존 lookAt 잠금 해제
            if (_focusSatPos) {
                viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
            }

            // 기존 trackedEntity 정리
            if (viewer.trackedEntity) {
                var wasTemp = viewer.trackedEntity._isTempTrack;
                var tempEnt = viewer.trackedEntity;
                viewer.trackedEntity = undefined;
                if (wasTemp) viewer.entities.remove(tempEnt);
            }

            _focusSatPos = null;
            _focusSatName = satName;

            // lookAt 모드인 경우 (뷰 전환 버튼에서 상세보기 요청)
            if (message.payload.lookAt) {
                var satPos2 = null;
                if (window._satCurrentPositions && window._satCurrentPositions[satName]) {
                    satPos2 = window._satCurrentPositions[satName];
                } else if (lastSatellitesData) {
                    for (var fi2 = 0; fi2 < lastSatellitesData.length; fi2++) {
                        if (lastSatellitesData[fi2].name === satName && lastSatellitesData[fi2].position) {
                            var sp2 = lastSatellitesData[fi2].position;
                            satPos2 = new Cesium.Cartesian3(sp2.x * 1000, sp2.y * 1000, sp2.z * 1000);
                            break;
                        }
                    }
                }
                if (satPos2) {
                    _focusSatPos = satPos2;
                    _focusSatRange = 1200;
                    _focusSatLookTarget = Cesium.Cartesian3.clone(satPos2);
                    var hpr = new Cesium.HeadingPitchRange(0, 0, _focusSatRange);
                    viewer.camera.flyToBoundingSphere(
                        new Cesium.BoundingSphere(_focusSatLookTarget, 0),
                        {
                            offset: hpr,
                            duration: 3.0,
                            complete: function() {
                                viewer.camera.lookAt(_focusSatLookTarget, hpr);
                            }
                        }
                    );
                }
                return;
            }

            // 기본 전체뷰: 달 전체 + 위성 궤도가 보이는 뷰
            var moonCenter = new Cesium.Cartesian3(0, 0, 0);
            if (window._moonTilesetCenter) {
                moonCenter = window._moonTilesetCenter;
            }
            var moonRadius = 1737400; // 미터

            // 위성 현재 위치 찾기
            var satPos = null;
            if (window._satCurrentPositions && window._satCurrentPositions[satName]) {
                satPos = window._satCurrentPositions[satName];
            } else if (lastSatellitesData) {
                for (var fi = 0; fi < lastSatellitesData.length; fi++) {
                    if (lastSatellitesData[fi].name === satName && lastSatellitesData[fi].position) {
                        var sp = lastSatellitesData[fi].position;
                        satPos = new Cesium.Cartesian3(sp.x * 1000, sp.y * 1000, sp.z * 1000);
                        break;
                    }
                }
            }

            if (satPos) {
                // 위성이 있는 방향에서 달 전체 + 궤도가 보이도록 카메라 배치
                var satDir = Cesium.Cartesian3.normalize(
                    Cesium.Cartesian3.subtract(satPos, moonCenter, new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                );
                // 위성~달 중심 거리를 기반으로 카메라 거리 동적 계산
                var satDistance = Cesium.Cartesian3.distance(satPos, moonCenter);
                // 카메라는 위성보다 더 뒤에서 바라봐야 전체 궤도가 보임
                // 최소 달 반지름 * 3.5, 최대는 위성 거리 * 2.5
                var camDist = Math.max(moonRadius * 3.5, satDistance * 2.5);
                // 원거리 위성(flyby 등) 포커스 시 줌 제한 동적 확장
                if (camDist > viewer.scene.screenSpaceCameraController.maximumZoomDistance) {
                    viewer.scene.screenSpaceCameraController.maximumZoomDistance = camDist * 1.5;
                }
                var camPos = Cesium.Cartesian3.add(
                    moonCenter,
                    Cesium.Cartesian3.multiplyByScalar(satDir, camDist, new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                );

                viewer.camera.flyTo({
                    destination: camPos,
                    orientation: {
                        direction: Cesium.Cartesian3.normalize(
                            Cesium.Cartesian3.subtract(moonCenter, camPos, new Cesium.Cartesian3()),
                            new Cesium.Cartesian3()
                        ),
                        up: new Cesium.Cartesian3(0, 0, 1)
                    },
                    duration: 3.0
                });
            } else {
                // 위성 위치 없으면 달 전체만
                viewer.camera.flyToBoundingSphere(
                    new Cesium.BoundingSphere(moonCenter, moonRadius),
                    {
                        offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-25), moonRadius * 0.3),
                        duration: 3.0
                    }
                );
            }
        }
        if (message.type === 'SET_MODEL_URI') {
            // GLB 모델 URI 동적 주입 (달 로드 후 나중에 도착)
            if (message.model === 'apollo') {
                window.APOLLO_LM_URI = message.uri;
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_LOG', payload: '[Apollo] URI received, length=' + message.uri.length }));
                // 이미 렌더링된 Apollo 엔티티 모델 URI 업데이트
                viewer.entities.values.forEach(function(entity) {
                    if (entity.model && entity._isApolloModel) {
                        entity.model.uri = new Cesium.ConstantProperty(message.uri);
                    }
                });
                // ── 착륙지에 모델 배치 ──
                var SITES = message.sites || [
                    { lat: 0.674, lng: 23.473, height: 1400, scale: 6 },
                    { lat: 29.1, lng: 0.0, height: 1400, scale: 6 },
                ];
                for (var si = 0; si < SITES.length; si++) {
                    (function(site) {
                        try {
                            var latRad = Cesium.Math.toRadians(site.lat);
                            var lngRad = Cesium.Math.toRadians(site.lng);
                            var pos = Cesium.Cartesian3.fromRadians(lngRad, latRad, site.height || 1400, Cesium.Ellipsoid.MOON);
                            var ent = viewer.entities.add({
                                position: pos,
                                model: {
                                    uri: message.uri,
                                    scale: site.scale || 6,
                                },
                            });
                            ent._isApolloModel = true;
                            ent.show = true;
                        } catch(e) {
                            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_LOG', payload: '[Apollo] ERROR: ' + e.message }));
                        }
                    })(SITES[si]);
                }
                console.log('[Controls] Apollo GLB URI injected + landing models placed');
            } else if (message.model === 'danuri' || message.model === 'capstone' || message.model === 'lro' || message.model === 'artemis_ii' || message.model === 'themis' || message.model === 'chandrayaan2' || message.model === 'flag') {
                var _mKey = message.model.toUpperCase() + '_GLB_URI';
                window[_mKey] = message.uri;
                // 이미 렌더링된 엔티티 모델 URI 업데이트
                var _mFound = false;
                var _mFlag = '_is' + message.model.charAt(0).toUpperCase() + message.model.slice(1) + 'Model';
                viewer.entities.values.forEach(function(entity) {
                    if (entity.model && entity[_mFlag]) {
                        entity.model.uri = new Cesium.ConstantProperty(message.uri);
                        _mFound = true;
                    }
                });
                // danuri는 모든 위성의 폴백 모델이므로, 도착 시 반드시 재렌더링
                // 다른 모델도 매칭 엔티티가 없으면 재렌더링
                if (lastSatellitesData && (message.model === 'danuri' || !_mFound)) {
                    drawSatelliteData(lastSatellitesData);
                }
                console.log('[Controls] ' + message.model + ' GLB URI injected (rerender=' + (message.model === 'danuri' || !_mFound) + ')');
            }
        }
        // ═══ 지구 텍스처 로드 (file:// URI) ═══
        if (message.type === 'SET_EARTH_TEXTURE') {
            var earthUri = message.uri;
            sendToRN('DEBUG_LOG', '[Earth] SET_EARTH_TEXTURE received, uri=' + (earthUri ? earthUri.substring(0, 60) : 'null'));
            if (!earthUri) return;
            
            var earthImg = new Image();
            earthImg.crossOrigin = 'anonymous';
            earthImg.onload = function() {
                sendToRN('DEBUG_LOG', '[Earth] Image loaded: ' + earthImg.width + 'x' + earthImg.height);
                if (typeof window._recreateEarth === 'function') {
                    window._recreateEarth(earthImg);
                } else {
                    window._pendingEarthTexture = earthImg;
                }
            };
            earthImg.onerror = function(e) {
                sendToRN('DEBUG_LOG', '[Earth] Image load FAILED');
            };
            earthImg.src = earthUri;
        }
        // ═══ 달 표면 텍스처 로드 (1인칭 뷰 바닥용) ═══
        if (message.type === 'SET_SURFACE_TEXTURE') {
            window._surfaceTextureReady = false;
            var stImg = new Image();
            stImg.onload = function() {
                try {
                    var stCanvas = document.createElement('canvas');
                    var stMaxSize = 1024;
                    var stW = Math.min(stImg.width, stMaxSize);
                    var stH = Math.min(stImg.height, stMaxSize);
                    stCanvas.width = stW;
                    stCanvas.height = stH;
                    var stCtx = stCanvas.getContext('2d');
                    stCtx.drawImage(stImg, 0, 0, stW, stH);
                    var stImgData = stCtx.getImageData(0, 0, stW, stH);
                    window._surfaceTextureData = {
                        typedArray: new Uint8Array(stImgData.data.buffer),
                        width: stW,
                        height: stH
                    };
                    window._surfaceTextureReady = true;
                    console.log('[Controls] Surface texture loaded: ' + stW + 'x' + stH);
                } catch(e) {
                    console.warn('[Controls] Surface texture canvas error:', e);
                }
            };
            stImg.onerror = function() {
                console.warn('[Controls] Surface texture Image load failed, storing URI fallback');
                window._surfaceTextureUri = message.uri;
                window._surfaceTextureReady = true;
            };
            stImg.src = message.uri;
            console.log('[Controls] Surface texture loading from:', message.uri);
        }
        // ═══ 모든 3D 모델 제거 (개척모드 안전장치) ═══
        if (message.type === 'REMOVE_ALL_3D_MODELS') {
            var modelFlags = ['_isApolloModel', '_isDanuriModel', '_isCapstoneModel', '_isLroModel'];
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
            console.log('[Controls] REMOVE_ALL_3D_MODELS: removed ' + entsToRemove.length + ' entities');
        }
        // ═══ 카메라 비행 전체 취소 (1인칭 진입 전 호출) ═══
        if (message.type === 'CANCEL_FLIGHTS') {
            if (window._autoOrbitRemove) { window._autoOrbitRemove(); window._autoOrbitRemove = null; }
            window._orbitState = null;
            if (window._orbitPitchClamp) { window._orbitPitchClamp(); window._orbitPitchClamp = null; }
            if (window._goToTickListener) {
                viewer.clock.onTick.removeEventListener(window._goToTickListener);
                window._goToTickListener = null;
            }
            viewer.camera.cancelFlight();
            viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
            if (window._fpAnimFrame) { cancelAnimationFrame(window._fpAnimFrame); window._fpAnimFrame = null; }
            console.log('[Controls] CANCEL_FLIGHTS: all camera animations stopped');
        }
        // ═══ 1인칭 지표면 뷰 ═══
        if (message.type === 'FIRST_PERSON_ENTER') {
            // 즉시 1인칭 플래그 설정 (GO_TO_LOCATION 등 다른 메시지가 방해하지 않도록)
            window._firstPersonMode = true;

            // S2 토큰에서 정확한 셀 중심 좌표 계산 (message.lat/lng는 DB 값이라 오차 가능)
            var fpLat, fpLng;
            if (message.token && window.s2) {
                var _fpCenterCid = window.s2.cellid.fromToken(message.token);
                var _fpCenterCell = window.s2.Cell.fromCellID(_fpCenterCid);
                var _fpCenter = _fpCenterCell.center();
                var _fpCenterR = Math.sqrt(_fpCenter.x*_fpCenter.x + _fpCenter.y*_fpCenter.y + _fpCenter.z*_fpCenter.z);
                fpLat = Math.asin(_fpCenter.z / _fpCenterR);
                fpLng = Math.atan2(_fpCenter.y, _fpCenter.x);
            } else {
                fpLat = Cesium.Math.toRadians(message.lat);
                fpLng = Cesium.Math.toRadians(message.lng);
            }

            // ──── 진행 중인 모든 카메라 작업 취소 ────
            // orbit 자동 회전 취소
            if (window._autoOrbitRemove) { window._autoOrbitRemove(); window._autoOrbitRemove = null; }
            window._orbitState = null;
            // orbit pitch 제한 취소
            if (window._orbitPitchClamp) { window._orbitPitchClamp(); window._orbitPitchClamp = null; }
            // goTo tick listener 취소
            if (window._goToTickListener) {
                viewer.clock.onTick.removeEventListener(window._goToTickListener);
                window._goToTickListener = null;
            }
            // 진행 중인 flyTo 취소
            viewer.camera.cancelFlight();
            viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

            // ──── 지형 높이 비동기 확정 → 단일 lerp 진입 ────
            var EYE_HEIGHT = 2.5;

            // clampToHeightMostDetailed로 정확한 지형 높이를 비동기로 확정
            var probeCart = Cesium.Cartesian3.fromRadians(fpLng, fpLat, 50000, Cesium.Ellipsoid.MOON);
            var _enterCancelled = false;

            function _doSingleLerp(terrainH) {
                if (_enterCancelled || !window._firstPersonMode) return;

                var fpH = terrainH + EYE_HEIGHT;
                var fpDest = Cesium.Cartesian3.fromRadians(fpLng, fpLat, fpH, Cesium.Ellipsoid.MOON);
                var startPos = Cesium.Cartesian3.clone(viewer.camera.position);
                var startHeading = viewer.camera.heading;
                var startPitch = viewer.camera.pitch;
                var targetPitch = 0; // 수평
                var duration = 2000; // 2초 (멀리서 오니까 좀 더 여유)
                var startTime = null;
                if (window._fpAnimFrame) { cancelAnimationFrame(window._fpAnimFrame); }

                // 과장된 셀 숨기고, 실제 크기 S2 셀로 교체
                if (window._highlightCellPrim) window._highlightCellPrim.show = false;
                try {
                    if (window._highlightCellRealPrim) {
                        try { viewer.scene.primitives.remove(window._highlightCellRealPrim); } catch(e) {}
                    }
                    if (window.s2 && message.token) {
                        var fpCid = window.s2.cellid.fromToken(message.token);
                        var fpCell = window.s2.Cell.fromCellID(fpCid);
                        var realPositions = [];
                        for (var ri = 0; ri < 4; ri++) {
                            var rv = fpCell.vertex(ri);
                            var rvr = Math.sqrt(rv.x*rv.x + rv.y*rv.y + rv.z*rv.z);
                            var rlon = Math.atan2(rv.y, rv.x);
                            var rlat = Math.asin(rv.z / rvr);
                            var rh = viewer.scene.sampleHeight(Cesium.Cartographic.fromRadians(rlon, rlat));
                            if (rh === undefined || rh === null) rh = terrainH;
                            realPositions.push(Cesium.Cartesian3.fromRadians(rlon, rlat, rh, Cesium.Ellipsoid.MOON));
                        }
                        window._highlightCellRealPrim = viewer.scene.primitives.add(new Cesium.ClassificationPrimitive({
                            geometryInstances: new Cesium.GeometryInstance({
                                geometry: new Cesium.PolygonGeometry({
                                    polygonHierarchy: new Cesium.PolygonHierarchy(realPositions),
                                    ellipsoid: Cesium.Ellipsoid.MOON,
                                    height: -20000,
                                    extrudedHeight: 20000,
                                }),
                                attributes: {
                                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(new Cesium.Color(0.4, 0.7, 1.0, 0.25)),
                                },
                            }),
                            appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                            classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
                            asynchronous: false,
                        }));
                    }
                } catch(e) { console.warn('[FP] real cell draw error:', e); }

                function enterFrame(time) {
                    if (_enterCancelled || !window._firstPersonMode) { window._fpAnimFrame = null; return; }
                    if (!startTime) startTime = time;
                    var t = Math.min((time - startTime) / duration, 1);
                    var ease = t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;

                    viewer.camera.position = Cesium.Cartesian3.lerp(startPos, fpDest, ease, new Cesium.Cartesian3());
                    viewer.camera.setView({
                        orientation: {
                            heading: startHeading,
                            pitch: Cesium.Math.lerp(startPitch, targetPitch, ease),
                            roll: 0
                        }
                    });

                    if (t < 1) {
                        window._fpAnimFrame = requestAnimationFrame(enterFrame);
                    } else {
                        window._fpAnimFrame = null;
                        viewer.scene.screenSpaceCameraController.enableInputs = false;
                        window._fpPosition = fpDest;

                        // ── [TODO] CustomShader로 3D Tileset에 달 표면 텍스처 적용 (추후 개선) ──
                        // if (window._surfaceTextureReady && window.moonTileset) {
                        //     try {
                        //         if (window._originalTilesetShader === undefined) {
                        //             window._originalTilesetShader = window.moonTileset.customShader;
                        //         }
                        //         var texUniformConfig;
                        //         if (window._surfaceTextureData) {
                        //             texUniformConfig = new Cesium.TextureUniform({
                        //                 typedArray: window._surfaceTextureData.typedArray,
                        //                 width: window._surfaceTextureData.width,
                        //                 height: window._surfaceTextureData.height,
                        //                 repeat: true,
                        //                 minificationFilter: Cesium.TextureMinificationFilter.LINEAR,
                        //                 magnificationFilter: Cesium.TextureMagnificationFilter.LINEAR,
                        //             });
                        //         } else if (window._surfaceTextureUri) {
                        //             texUniformConfig = new Cesium.TextureUniform({
                        //                 url: window._surfaceTextureUri,
                        //                 repeat: true,
                        //             });
                        //         }
                        //         if (texUniformConfig) {
                        //             var fpShaderCarto = Cesium.Cartographic.fromCartesian(fpDest, Cesium.Ellipsoid.MOON);
                        //             window.moonTileset.customShader = new Cesium.CustomShader({
                        //                 uniforms: {
                        //                     u_surfaceTex: { type: Cesium.UniformType.SAMPLER_2D, value: texUniformConfig },
                        //                     u_centerLon: { type: Cesium.UniformType.FLOAT, value: fpShaderCarto.longitude },
                        //                     u_centerLat: { type: Cesium.UniformType.FLOAT, value: fpShaderCarto.latitude }
                        //                 },
                        //                 fragmentShaderText: [
                        //                     'void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {',
                        //                     '  vec3 nPos = normalize(fsInput.attributes.positionWC);',
                        //                     '  float lon = atan(nPos.y, nPos.x) - u_centerLon;',
                        //                     '  float lat = asin(nPos.z) - u_centerLat;',
                        //                     '  float moonR = 1737400.0;',
                        //                     '  float texSizeM = 30.0;',
                        //                     '  float scale = moonR / texSizeM;',
                        //                     '  vec2 uv = vec2(lon, lat) * scale;',
                        //                     '  vec4 texColor = texture(u_surfaceTex, uv);',
                        //                     '  material.diffuse = texColor.rgb;',
                        //                     '}'
                        //                 ].join('\\n')
                        //             });
                        //             console.log('[FP] CustomShader surface texture applied');
                        //         }
                        //     } catch(texErr) {
                        //         console.warn('[FP] CustomShader texture error:', texErr);
                        //     }
                        // }

                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FP_READY' }));
                        console.log('[FP] enter complete: eye at', fpH, '(terrain:', terrainH, ')');
                    }
                }
                window._fpAnimFrame = requestAnimationFrame(enterFrame);
            }

            // clampToHeightMostDetailed: 타일 로드 대기 후 정확한 높이 반환
            if (viewer.scene.clampToHeightMostDetailed) {
                viewer.scene.clampToHeightMostDetailed([probeCart]).then(function(clamped) {
                    if (_enterCancelled || !window._firstPersonMode) return;
                    if (clamped && clamped[0]) {
                        var cc = Cesium.Cartographic.fromCartesian(clamped[0], Cesium.Ellipsoid.MOON);
                        if (cc && cc.height !== undefined) {
                            console.log('[FP] clamp height:', cc.height);
                            _doSingleLerp(cc.height);
                            return;
                        }
                    }
                    // fallback: sampleHeight 동기
                    var sp = Cesium.Cartographic.fromRadians(fpLng, fpLat);
                    var h = viewer.scene.sampleHeight(sp);
                    _doSingleLerp(h !== undefined && h !== null ? h : 0);
                }).catch(function(e) {
                    console.warn('[FP] clamp error:', e);
                    var sp = Cesium.Cartographic.fromRadians(fpLng, fpLat);
                    var h = viewer.scene.sampleHeight(sp);
                    _doSingleLerp(h !== undefined && h !== null ? h : 0);
                });
            } else {
                // clamp 미지원: sampleHeight 시도
                var sp = Cesium.Cartographic.fromRadians(fpLng, fpLat);
                var h = viewer.scene.sampleHeight(sp);
                _doSingleLerp(h !== undefined && h !== null ? h : 0);
            }



            // (clampToHeightMostDetailed 비동기 흐름이 _doSingleLerp를 호출합니다)
        }
        if (message.type === 'GYRO_UPDATE' && window._firstPersonMode) {
            var heading = Cesium.Math.toRadians(message.azimuth);
            var pitch = Cesium.Math.toRadians(message.altitude);
            viewer.camera.setView({
                destination: window._fpPosition,
                orientation: {
                    heading: heading,
                    pitch: pitch,
                    roll: 0,
                }
            });
        }
        if (message.type === 'FIRST_PERSON_EXIT') {
            window._firstPersonMode = false;
            viewer.scene.screenSpaceCameraController.enableInputs = true;
            if (window._fpAnimFrame) { cancelAnimationFrame(window._fpAnimFrame); window._fpAnimFrame = null; }


            // [TODO] 달 표면 텍스처 CustomShader 복원 (추후 개선)
            // if (window._originalTilesetShader !== undefined && window.moonTileset) {
            //     window.moonTileset.customShader = window._originalTilesetShader;
            //     window._originalTilesetShader = undefined;
            //     console.log('[FP] Original tileset shader restored');
            // }

            // 실제 크기 셀 제거, 과장 셀 복원
            if (window._highlightCellRealPrim) {
                try { viewer.scene.primitives.remove(window._highlightCellRealPrim); } catch(e) {}
                window._highlightCellRealPrim = null;
            }
            if (window._highlightCellPrim) window._highlightCellPrim.show = true;

            // lerp → orbit 뷰 (lookAt 목표 위치 사전 계산 → lerp → 도착 후 lookAt 전환)
            if (message.lat !== undefined) {
                var exitLat = Cesium.Math.toRadians(message.lat);
                var exitLng = Cesium.Math.toRadians(message.lng);
                var exitCenter = Cesium.Cartesian3.fromRadians(exitLng, exitLat, 0, Cesium.Ellipsoid.MOON);
                var exitTransform = Cesium.Transforms.eastNorthUpToFixedFrame(exitCenter);
                var exitTargetPitch = Cesium.Math.toRadians(-45);
                var exitRange = 20000;
                var exitTargetHeading = 0;

                // ① lookAtTransform 임시 적용 → orbit 카메라 위치/방향 캡처
                var savedPos = Cesium.Cartesian3.clone(viewer.camera.position);
                var savedHeading = viewer.camera.heading;
                var savedPitch = viewer.camera.pitch;
                viewer.camera.lookAtTransform(exitTransform, new Cesium.HeadingPitchRange(exitTargetHeading, exitTargetPitch, exitRange));
                var lookAtPos = Cesium.Cartesian3.clone(viewer.camera.positionWC);
                var lookAtHeading = viewer.camera.heading;
                var lookAtPitch = viewer.camera.pitch;
                // ② 원래 위치로 복원
                viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
                viewer.camera.setView({
                    destination: savedPos,
                    orientation: { heading: savedHeading, pitch: savedPitch, roll: 0 }
                });

                var exitStartPos = Cesium.Cartesian3.clone(viewer.camera.position);
                var exitStartHeading = viewer.camera.heading;
                var exitStartPitch = viewer.camera.pitch;
                var exitDuration = 1500;
                var exitStartTime = null;

                // ③ lookAt 목표 위치까지 lerp
                function exitAnimFrame(time) {
                    if (!exitStartTime) exitStartTime = time;
                    var t = Math.min((time - exitStartTime) / exitDuration, 1);
                    var ease = t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;

                    viewer.camera.position = Cesium.Cartesian3.lerp(exitStartPos, lookAtPos, ease, new Cesium.Cartesian3());
                    // heading 최단 경로 보간
                    var dH = lookAtHeading - exitStartHeading;
                    while (dH > Math.PI) dH -= 2*Math.PI;
                    while (dH < -Math.PI) dH += 2*Math.PI;
                    viewer.camera.setView({
                        orientation: {
                            heading: exitStartHeading + dH * ease,
                            pitch: Cesium.Math.lerp(exitStartPitch, lookAtPitch, ease),
                            roll: 0
                        }
                    });

                    if (t < 1) {
                        window._fpAnimFrame = requestAnimationFrame(exitAnimFrame);
                    } else {
                        window._fpAnimFrame = null;
                        // ④ 카메라가 이미 정확한 위치 → lookAtTransform 적용 (스냅 없음)
                        viewer.camera.lookAtTransform(exitTransform, new Cesium.HeadingPitchRange(exitTargetHeading, exitTargetPitch, exitRange));
                        window._orbitState = { transform: exitTransform, heading: exitTargetHeading, pitch: exitTargetPitch, range: exitRange };

                        // ── 자동 회전 복원 ──
                        var oh = exitTargetHeading, stopped = false;
                        var orbitTick = function() {
                            if (stopped) return;
                            oh += 0.05 / 60;
                            var curR = window._orbitState ? window._orbitState.range : exitRange;
                            viewer.camera.lookAtTransform(exitTransform, new Cesium.HeadingPitchRange(oh, exitTargetPitch, curR));
                            if (window._orbitState) { window._orbitState.heading = oh; window._orbitState.range = curR; }
                        };
                        viewer.clock.onTick.addEventListener(orbitTick);
                        var stopOrbit = function() {
                            if (stopped) return; stopped = true;
                            viewer.clock.onTick.removeEventListener(orbitTick);
                        };
                        var cvs = viewer.canvas;
                        ['pointerdown','wheel'].forEach(function(ev) { cvs.addEventListener(ev, stopOrbit, {once:true}); });
                        window._autoOrbitRemove = function() {
                            stopOrbit();
                            ['pointerdown','wheel'].forEach(function(ev) { cvs.removeEventListener(ev, stopOrbit); });
                        };

                        // ── pitch 제한 복원 ──
                        viewer.scene.screenSpaceCameraController.enableTilt = true;
                        if (window._orbitPitchClamp) { window._orbitPitchClamp(); window._orbitPitchClamp = null; }
                        var _exitClampListener = viewer.scene.preUpdate.addEventListener(function() {
                            if (!window._orbitState) return;
                            var minP = Cesium.Math.toRadians(-70);
                            var maxP = Cesium.Math.toRadians(-15);
                            if (viewer.camera.pitch < minP) {
                                viewer.camera.lookAtTransform(window._orbitState.transform, new Cesium.HeadingPitchRange(viewer.camera.heading, minP, window._orbitState.range));
                            } else if (viewer.camera.pitch > maxP) {
                                viewer.camera.lookAtTransform(window._orbitState.transform, new Cesium.HeadingPitchRange(viewer.camera.heading, maxP, window._orbitState.range));
                            }
                        });
                        window._orbitPitchClamp = function() { _exitClampListener(); };
                    }
                }
                window._fpAnimFrame = requestAnimationFrame(exitAnimFrame);
            }
        }
        if (message.type === 'LOAD_MINERAL_DATA') {
            loadMineralData(message.data, message.isFirst, message.isLast);
        }
        if (message.type === 'UPDATE_MINERAL_FILTER') {
            updateMineralFilter(message.filter, message.enabled);
        }
        if (message.type === 'TOGGLE_TEMP_MAP') {
            toggleTempMap(message.enabled);
        }
        if (message.type === 'LOAD_TEMP_MAP_IMAGE') {
            loadTempMapImage(message.data);
        }
        if (message.type === 'TOGGLE_THERMAL_GRID') {
            toggleThermalGrid(message.enabled);
        }
        if (message.type === 'LOAD_THERMAL_GRID_DATA') {
            processThermalGridData(message.data);
        }
        if (message.type === 'UPDATE_THERMAL_MODE') {
            isDayTempMode = message.isDay;
            if (thermalGridCsvContent) {
                renderThermalGridFromData();
            }
        }
        if (message.type === 'TOGGLE_GRAVITY_MAP') {
            toggleGravityMap(message.enabled);
        }
        if (message.type === 'LOAD_GRAVITY_DATA') {
            processGravityData(message.data);
        }
        if (message.type === 'TOGGLE_GRAVITY_GRID_MODE') {
            toggleGravityGridMode(message.enabled);
        }
        if (message.type === 'TOGGLE_NEUTRON_MAP') {
            toggleNeutronMap(message.enabled);
        }
        if (message.type === 'LOAD_NEUTRON_DATA') {
            processNeutronData(message.data);
        }
        if (message.type === 'TOGGLE_NEUTRON_GRID_MODE') {
            toggleNeutronGridMode(message.enabled);
        }
        if (message.type === 'SET_ENV_MINERAL_FILTER') {
            // 환경 자원 셀 클릭을 위해 activeMineralFilter를 직접 설정/해제
            console.log('[SET_ENV_MINERAL_FILTER] received, filter:', message.filter, 'prev:', activeMineralFilter);
            if (message.filter) {
                activeMineralFilter = message.filter;
            } else {
                activeMineralFilter = null;
                clearEnvHighlight();
            }
            console.log('[SET_ENV_MINERAL_FILTER] activeMineralFilter is now:', activeMineralFilter);
        }
        if (message.type === 'TOGGLE_LANDMARKS') {
            toggleLandmarks(message.enabled);
        }
        if (message.type === 'TOGGLE_LANDING_SITES') {
            toggleLandingSites(message.enabled, message.countries || null);
        }
        // ═══ 셀 하이라이트 + 핀 (구역 상세 상단용) ═══
        if (message.type === 'HIGHLIGHT_CELL') {
            var hlToken = message.token;
            if (hlToken && window.s2) {
                window._hlPendingToken = hlToken;
                var _hlRetryCount = 0;
                function _tryHighlight() {
                    var tk = window._hlPendingToken;
                    if (!tk) return;
                    try {
                        var s2 = window.s2;
                        var hlCid = s2.cellid.fromToken(tk);
                        var hlCell = s2.Cell.fromCellID(hlCid);
                        var positions = [];
                        var ok = true;
                        for (var i = 0; i < 4; i++) {
                            var v = hlCell.vertex(i);
                            var vr = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
                            var lon = Math.atan2(v.y, v.x);
                            var lat = Math.asin(v.z / vr);
                            var h = viewer.scene.sampleHeight(Cesium.Cartographic.fromRadians(lon, lat));
                            if (h === undefined || h === null || isNaN(h)) { ok = false; break; }
                            positions.push({ lon: lon, lat: lat, h: h });
                        }
                        if (!ok) {
                            _hlRetryCount++;
                            if (_hlRetryCount < 30) setTimeout(_tryHighlight, 500);
                            return;
                        }
                        // 기존 하이라이트 제거
                        if (window._highlightCellPrim) {
                            try { viewer.scene.primitives.remove(window._highlightCellPrim); } catch(e) {}
                            try { viewer.entities.remove(window._highlightCellPrim); } catch(e) {}
                        }
                        if (window._highlightOutlinePrim) {
                            try { viewer.scene.primitives.remove(window._highlightOutlinePrim); } catch(e) {}
                        }
                        // 셀 중심 좌표 계산
                        var cLatSum = 0, cLonSum = 0;
                        for (var j = 0; j < positions.length; j++) {
                            cLatSum += positions[j].lat;
                            cLonSum += positions[j].lon;
                        }
                        var cLatRad = cLatSum / positions.length;
                        var cLonRad = cLonSum / positions.length;
                        var cLatDeg = Cesium.Math.toDegrees(cLatRad);
                        var cLonDeg = Cesium.Math.toDegrees(cLonRad);
                        // S2 셀 꼭지점 사이 거리로 크기 추정 (km)
                        var p0 = Cesium.Cartesian3.fromRadians(positions[0].lon, positions[0].lat, 0, Cesium.Ellipsoid.MOON);
                        var p1 = Cesium.Cartesian3.fromRadians(positions[1].lon, positions[1].lat, 0, Cesium.Ellipsoid.MOON);
                        var p2 = Cesium.Cartesian3.fromRadians(positions[2].lon, positions[2].lat, 0, Cesium.Ellipsoid.MOON);
                        var cellSizeM = Math.max(
                            Cesium.Cartesian3.distance(p0, p1),
                            Cesium.Cartesian3.distance(p1, p2)
                        );
                        var cellSizeKm = Math.max(cellSizeM / 1000, 1.0); // 최소 1km
                        // ClassificationPrimitive (showFeatureArea와 동일 패턴)
                        var hlAreaPos = generateAreaPositions(cLatDeg, cLonDeg, cellSizeKm * 0.575, cellSizeKm * 0.575, 0, 4);
                        window._highlightCellPrim = viewer.scene.primitives.add(new Cesium.ClassificationPrimitive({
                            geometryInstances: new Cesium.GeometryInstance({
                                geometry: new Cesium.PolygonGeometry({
                                    polygonHierarchy: new Cesium.PolygonHierarchy(hlAreaPos),
                                    ellipsoid: Cesium.Ellipsoid.MOON,
                                    height: -20000,
                                    extrudedHeight: 20000,
                                }),
                                attributes: {
                                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(new Cesium.Color(0.4, 0.7, 1.0, 0.35)),
                                },
                            }),
                            appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                            classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
                            asynchronous: false,
                        }));
                        window._highlightOutlinePrim = null;
                        window._hlPendingToken = null;
                        console.log('[Controls] HIGHLIGHT_CELL done:', tk, 'retries:', _hlRetryCount);
                    } catch(e) {
                        console.error('[Controls] HIGHLIGHT_CELL error:', e);
                        _hlRetryCount++;
                        if (_hlRetryCount < 30) setTimeout(_tryHighlight, 500);
                    }
                }
                setTimeout(_tryHighlight, 3000);
            }
        }
        if (message.type === 'TOGGLE_TERRAIN') {
            toggleTerrainFlags(message.enabled, message.types || null);
        }
        if (message.type === 'SHOW_FEATURE_AREA') {
            var p = message.payload;
            showFeatureArea(p.lat, p.lng, p.diameterKm, p.widthKm, p.angle, p.typeKr);
        }
        if (message.type === 'HIDE_FEATURE_AREA') {
            hideFeatureArea();
        }
        if (message.type === 'CLEAR_MINERAL_HIGHLIGHT') {
            clearMineralHighlight();
        }
        if (message.type === 'RECOMMEND_LAND') {
            const { lat, lng } = message.payload;

            // 위경도를 통해 S2Point 획득
            const latRad = Cesium.Math.toRadians(lat);
            const lngRad = Cesium.Math.toRadians(lng);
            const point = new s2.Point(
                Math.cos(latRad) * Math.cos(lngRad),
                Math.cos(latRad) * Math.sin(lngRad),
                Math.sin(latRad)
            );

            // 최종 목표: Level 16 셀
            const leafId = s2.cellid.fromPoint(point);
            const finalTargetId = s2.cellid.parent(leafId, 16);

            // selectionStack 한번에 세팅 (기존 클릭 로직과 동일한 계층구조)
            selectionStack = [
                s2.cellid.parent(finalTargetId, 4),
                s2.cellid.parent(finalTargetId, 8),
                s2.cellid.parent(finalTargetId, 12),
                finalTargetId // Level 16
            ];
            lastRenderedDepth = 0;
            parentPrimitives.removeAll();

            // 그리드 렌더링 (render 내부에서 CELL_SELECTED도 자동 전송)
            render();
            flashCell(finalTargetId);

            // 기존 flyToCell 그대로 사용 (레벨별 적절한 높이 자동 계산)
            flyToCell(finalTargetId);

            // 줌 레벨도 최대(4)로 동기화
            currentZoomLevel = ZOOM_LEVELS.length - 1;
            updateUI();
        }
        if (message.type === 'FLY_TO_LOCATION') {
            const { lat, lng } = message.payload;
            // 선택 마커 하이라이트
            if (window.highlightLandmark) {
                window.highlightLandmark(lat, lng);
            }
            const dest = Cesium.Cartesian3.fromRadians(
                Cesium.Math.toRadians(lng),
                Cesium.Math.toRadians(lat),
                Cesium.Ellipsoid.MOON.maximumRadius + 50000,
                Cesium.Ellipsoid.MOON
            );
            viewer.camera.flyTo({
                destination: dest,
                orientation: {
                    heading: 0,
                    pitch: Cesium.Math.toRadians(-60),
                    roll: 0
                },
                duration: 3.0,
                complete: function() {}

            });
        }
    } catch (e) {
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_LOG', payload: 'Cesium JS Error: ' + e.message }));
        }
        console.error("Cesium Message Error:", e);
    }
}

// === 클릭 핸들러 (드래그/줌과 탭 구분) ===
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

// 터치 시작 위치 저장 (드래그 vs 탭 구분용)
var _touchStartPos = null;
handler.setInputAction(function(movement) {
    _touchStartPos = Cesium.Cartesian2.clone(movement.position);
}, Cesium.ScreenSpaceEventType.LEFT_DOWN);

handler.setInputAction((movement) => {
    // 드래그 vs 탭 구분: 시작점과 끝점 거리가 10px 이상이면 드래그로 간주
    if (_touchStartPos) {
        var dx = movement.position.x - _touchStartPos.x;
        var dy = movement.position.y - _touchStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
            _touchStartPos = null;
            return; // 드래그 → 무시
        }
    }
    _touchStartPos = null;



    // ── 탐사 모드: 히트맵 셀 클릭 처리 (광물 + 환경) ──
    var envFilters = ['neutron', 'thermalGrid', 'gravity'];
    var isEnvFilter = envFilters.indexOf(activeMineralFilter) >= 0;
    var hasData = isEnvFilter
        ? (activeMineralFilter === 'neutron' ? neutronParsed.length > 0 : activeMineralFilter === 'thermalGrid' ? thermalGridParsed.length > 0 : gravityParsed.length > 0)
        : mineralDataArray.length > 0;

    console.log('[HeatmapClick] mainMode:', mainMode, 'filter:', activeMineralFilter, 'isEnv:', isEnvFilter, 'hasData:', hasData,
        'envData:', { thermal: thermalGridParsed.length, gravity: gravityParsed.length, neutron: neutronParsed.length });

    if (mainMode === 'exploration' && activeMineralFilter && hasData) {
        var ray = viewer.camera.getPickRay(movement.position);
        var intersection = Cesium.IntersectionTests.rayEllipsoid(ray, Cesium.Ellipsoid.MOON);

        if (intersection && intersection.start > 0) {
            var clickPos = Cesium.Ray.getPoint(ray, intersection.start);
            var carto = Cesium.Cartographic.fromCartesian(clickPos, Cesium.Ellipsoid.MOON);
            if (carto) {
                var clickLat = Cesium.Math.toDegrees(carto.latitude);
                var clickLon = Cesium.Math.toDegrees(carto.longitude);
                console.log('[HeatmapClick] lat:', clickLat.toFixed(3), 'lon:', clickLon.toFixed(3), 'filter:', activeMineralFilter);

                if (isEnvFilter) {
                    // ── 환경 데이터 (1도 해상도) ──
                    // 환경 히트맵은 +halfW 없이 렌더링되므로 Cesium 클릭 좌표를 180° 보정
                    var envLon = clickLon > 0 ? clickLon - 180 : clickLon + 180;
                    var envArr = activeMineralFilter === 'neutron' ? neutronParsed
                        : activeMineralFilter === 'thermalGrid' ? thermalGridParsed
                        : gravityParsed;
                    // 1도 셀: floor(lat), floor(lon) 범위
                    var cellLatMin = Math.floor(clickLat);
                    var cellLonMin = Math.floor(envLon);
                    var foundEnv = null;
                    for (var ei = 0; ei < envArr.length; ei++) {
                        var ed = envArr[ei];
                        if (Math.floor(ed.lat) === cellLatMin && Math.floor(ed.lon) === cellLonMin) {
                            foundEnv = ed;
                            break;
                        }
                    }
                    if (foundEnv) {
                        console.log('[EnvClick DEBUG] clickLon:', clickLon.toFixed(1), 'envLon:', envLon.toFixed(1), 'foundLon:', foundEnv.lon, 'foundVal:', foundEnv.val.toFixed(2));
                        var envUnitMap = { neutron: 'count/s', thermalGrid: 'K', gravity: 'mGal' };
                        sendToRN('MINERAL_CELL_INFO', {
                            latMin: cellLatMin, latMax: cellLatMin + 1,
                            lonMin: cellLonMin, lonMax: cellLonMin + 1,
                            value: foundEnv.val,
                            filter: activeMineralFilter,
                            unit: envUnitMap[activeMineralFilter] || ''
                        });
                        clearMineralHighlight();
                        highlightEnvCell(activeMineralFilter, clickLat, envLon);
                    } else {
                        clearEnvHighlight();
                        sendToRN('MINERAL_CELL_INFO', null);
                    }
                } else {
                    // ── 광물 데이터 (2도 해상도) ──
                    var foundCell = null;
                    for (var mi = 0; mi < mineralDataArray.length; mi++) {
                        var md = mineralDataArray[mi];
                        if (clickLat >= md.latMin && clickLat < md.latMax &&
                            clickLon >= md.lonMin && clickLon < md.lonMax) {
                            foundCell = md;
                            break;
                        }
                    }
                    if (foundCell) {
                        var cellVal = getMineralValue(foundCell, activeMineralFilter);
                        var unitMap = {
                            feo: 'wt%', tio2: 'wt%', mgo: 'wt%', al2o3: 'wt%',
                            sio2: 'wt%', cao: 'wt%', k: 'ppm', th: 'ppm', u: 'ppm',
                            am: 'g/mol'
                        };
                        sendToRN('MINERAL_CELL_INFO', {
                            latMin: foundCell.latMin, latMax: foundCell.latMax,
                            lonMin: foundCell.lonMin, lonMax: foundCell.lonMax,
                            value: cellVal,
                            filter: activeMineralFilter,
                            unit: unitMap[activeMineralFilter] || ''
                        });
                        clearEnvHighlight();
                        highlightMineralCell(clickLat, clickLon);
                    } else {
                        clearMineralHighlight();
                        sendToRN('MINERAL_CELL_INFO', null);
                    }
                }
            }
        }
        return;
    }

    // 2. 히트박스 기반 셀 선택 (scene.pick)
    if (mainMode !== 'occupation') return;

    var picked = null;
    var drillResults = viewer.scene.drillPick(movement.position);
    for (var di = 0; di < drillResults.length; di++) {
        if (Cesium.defined(drillResults[di]) && drillResults[di].id && typeof drillResults[di].id !== 'string') {
            picked = drillResults[di];
            break;
        }
    }
    if (!picked || !picked.id) return;
    var pickedCellId = picked.id;

    const lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
    const currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;


    if (currentLevel >= 12) {
        // 3단계: L16 셀 개별 선택 (1셀씩)
        var pickedLevel = s2.cellid.level(pickedCellId);
        // 클릭된 셀을 L16으로 변환
        var targetL16 = (pickedLevel === 16) ? pickedCellId : (pickedLevel < 16 ? getDescendants(pickedCellId, 16)[0] : s2.cellid.parent(pickedCellId, 16));
        if (!targetL16) return;

        var targetToken = s2.cellid.toToken(targetL16);

        // 이미 점유된 셀 → 선택하지 않고 정보만 전송
        var isOccupied = occupiedTokens.indexOf(targetToken) !== -1;
        var isMyTerritory = myOccupiedTokens.indexOf(targetToken) !== -1;
        if (isOccupied) {
            var occ2 = s2.Cell.fromCellID(targetL16).center();
            var occr2 = Math.sqrt(occ2.x**2+occ2.y**2+occ2.z**2);
            sendToRN('CELL_SELECTED', {
                cellId: targetToken, token: targetToken,
                lat: parseFloat((Math.asin(occ2.z / occr2) * 180 / Math.PI).toFixed(2)),
                lng: parseFloat((Math.atan2(occ2.y, occ2.x) * 180 / Math.PI).toFixed(2)),
                level: 16, childLevel: 16,
                magCount: 1, area: '1,740 m²',
                isOccupied: true,
                isMyTerritory: isMyTerritory
            });
            flashCell(targetL16); // 클릭 피드백
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
            // 선택 하이라이트만 정리 (그리드/히트박스는 그대로 유지)
            selectionPrimitives.removeAll();
            window.selectionPrimMap = {};
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
        if (!window.selectionPrimMap) window.selectionPrimMap = {};

        if (existingIdx !== -1) {
            // 제거된 셀 primitive 삭제
            if (window.selectionPrimMap[targetToken]) {
                selectionPrimitives.remove(window.selectionPrimMap[targetToken]);
                delete window.selectionPrimMap[targetToken];
            }
        } else {
            // 새 셀 primitive 추가
            if (!window.selectionPrimMap[targetToken]) {
                var cid = s2.cellid.fromToken(targetToken);
                var cell = s2.Cell.fromCellID(cid);
                var positions = [];
                for (var vi = 0; vi < 4; vi++) {
                    var v = cell.vertex(vi);
                    var vr = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                    positions.push(Cesium.Cartesian3.fromRadians(
                        Math.atan2(v.y, v.x), Math.asin(v.z / vr), 0, Cesium.Ellipsoid.MOON
                    ));
                }
                var prim = selectionPrimitives.add(new Cesium.ClassificationPrimitive({
                    geometryInstances: new Cesium.GeometryInstance({
                        geometry: new Cesium.PolygonGeometry({
                            polygonHierarchy: new Cesium.PolygonHierarchy(positions),
                            ellipsoid: Cesium.Ellipsoid.MOON,
                            height: -15000, extrudedHeight: 15000,
                        }),
                        attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                            new Cesium.Color(0.15, 0.45, 0.95, 0.45)
                        )}
                    }),
                    appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                    classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
                    asynchronous: true,
                }));
                window.selectionPrimMap[targetToken] = prim;
            }
        }
        return;
    }

    // 0~2단계: 히트박스에서 직접 감지된 셀 사용
    var cellId = pickedCellId;
    var lvl = s2.cellid.level(cellId);
    if (lvl <= 0) return;

    // 프러스텀 컬링: 모든 보이는 셀 클릭 가능 (부모 범위 제한 제거)

    flashCell(cellId);
    selectionStack.push(cellId);
    render();
    flyToCell(cellId);
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
// --- 위성 포커스 상태 ---
var _focusSatPos = null;
var _focusSatLookTarget = null;
var _focusSatRange = 1200;
var _focusSatName = null;

// --- 줌 증감 함수 (누적 목표 + lookAtTransform 애니메이션) ---
// 연타 시 목표가 누적되어 최종 위치까지 하나의 부드러운 애니메이션으로 이동
var _zoomAnimFrame = null;
var _zoomTargetRange = null;   // 누적 목표 range (일반/위성 공용)

// --- 탐사모드 전용 줌 (카메라 방향 100% 보존, 거리만 변경) ---
var _exploreZoomAnim = null;
var _exploreZoomTarget = null;

function exploreZoom(direction) {
    var cam = viewer.camera;

    // 위성 lookAt 모드: range만 변경 (lookAt 유지)
    if (_focusSatPos && _focusSatLookTarget) {
        var scale = direction > 0 ? 0.6 : 1.667;
        _focusSatRange = Math.max(200, Math.min(5000000, _focusSatRange * scale));
        cam.lookAt(_focusSatLookTarget, new Cesium.HeadingPitchRange(cam.heading, cam.pitch, _focusSatRange));
        return;
    }

    // lookAtTransform 모드인 경우: range만 변경
    if (window._orbitState) {
        var os = window._orbitState;
        var scale = direction > 0 ? 0.6 : 1.667;
        os.range = Math.max(2000, Math.min(500000, os.range * scale));
        cam.lookAtTransform(os.transform, new Cesium.HeadingPitchRange(os.heading, os.pitch, os.range));
        return;
    }

    // 일반 모드: 기존 로직
    var pos = cam.positionWC;
    var currentRange = Cesium.Cartesian3.magnitude(pos);
    
    var scale = direction > 0 ? 0.6 : 1.667;
    var base = (_exploreZoomTarget !== null) ? _exploreZoomTarget : currentRange;
    _exploreZoomTarget = Math.max(1800000, Math.min(20000000, base * scale));

    if (_exploreZoomAnim) { cancelAnimationFrame(_exploreZoomAnim); _exploreZoomAnim = null; }

    var startRange = currentRange;
    var targetRange = _exploreZoomTarget;
    var dir = Cesium.Cartesian3.normalize(pos, new Cesium.Cartesian3());
    var duration = 700;
    var startTime = null;
    var finalTarget = _exploreZoomTarget;

    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1.0);
        var t = 1 - Math.pow(1 - progress, 3);
        var curRange = startRange + (targetRange - startRange) * t;

        var newPos = Cesium.Cartesian3.multiplyByScalar(dir, curRange, new Cesium.Cartesian3());
        cam.position = newPos;

        if (progress >= 1.0) {
            _exploreZoomAnim = null;
            if (_exploreZoomTarget === finalTarget) {
                _exploreZoomTarget = null;
            }
            return;
        }
        _exploreZoomAnim = requestAnimationFrame(animate);
    }
    _exploreZoomAnim = requestAnimationFrame(animate);
}

function changeZoomLevel(direction) {

    // 위성 포커스 활성 시: range 누적 스케일링
    if (_focusSatPos) {
        var scale = direction > 0 ? 0.6 : 1.667;
        // 이전 애니메이션 진행 중이면 누적 목표에서 계속 줌
        var baseRange = (_zoomTargetRange !== null) ? _zoomTargetRange : _focusSatRange;
        _zoomTargetRange = Math.max(50, Math.min(100000, baseRange * scale));

        var newLookTarget = Cesium.Cartesian3.clone(_focusSatPos);

        // 진행 중이던 애니메이션 취소
        if (_zoomAnimFrame) { cancelAnimationFrame(_zoomAnimFrame); _zoomAnimFrame = null; }

        // 현재 카메라 상태에서 새 목표로 애니메이션 시작
        var startRange = _focusSatRange;
        var targetRange = _zoomTargetRange;
        var startHeadingSat = viewer.camera.heading;
        var startPitchSat = viewer.camera.pitch;
        var duration = 800;
        var startTime = null;

        function animateSat(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1.0);
            var t = 1 - Math.pow(1 - progress, 3);
            var currentRange = startRange + (targetRange - startRange) * t;
            var hpr = new Cesium.HeadingPitchRange(startHeadingSat, startPitchSat, currentRange);
            viewer.camera.lookAt(newLookTarget, hpr);

            if (progress >= 1.0) {
                _focusSatRange = targetRange;
                _focusSatLookTarget = newLookTarget;
                _zoomAnimFrame = null;
                _zoomTargetRange = null;
                return;
            }
            _zoomAnimFrame = requestAnimationFrame(animateSat);
        }
        _zoomAnimFrame = requestAnimationFrame(animateSat);
        return;
    }
    // 일반 줌: lookAtTransform(IDENTITY) range 보간
    var hpr = window._getCamHPR();
    var currentRange = hpr.range;

    // 누적 목표 range 계산
    var baseRange = (_zoomTargetRange !== null) ? _zoomTargetRange : currentRange;
    var scale = direction > 0 ? 0.6 : 1.667;
    _zoomTargetRange = Math.max(1800000, Math.min(20000000, baseRange * scale));

    // 진행 중이던 애니메이션 취소
    if (_zoomAnimFrame) { cancelAnimationFrame(_zoomAnimFrame); _zoomAnimFrame = null; }

    var startRange = currentRange;
    var targetRange = _zoomTargetRange;
    var fixedHeading = hpr.heading;
    var fixedPitch = hpr.pitch;
    var duration = 800;
    var startTime = null;
    var finalTarget = _zoomTargetRange;

    function animateZoom(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1.0);
        var t = 1 - Math.pow(1 - progress, 3);
        var curRange = startRange + (targetRange - startRange) * t;
        viewer.camera.lookAtTransform(
            Cesium.Matrix4.IDENTITY,
            new Cesium.HeadingPitchRange(fixedHeading, fixedPitch, curRange)
        );

        if (progress >= 1.0) {
            _zoomAnimFrame = null;
            if (_zoomTargetRange === finalTarget) {
                _zoomTargetRange = null;
            }
            return;
        }
        _zoomAnimFrame = requestAnimationFrame(animateZoom);
    }
    _zoomAnimFrame = requestAnimationFrame(animateZoom);
}

// ==== 모드 전환 헬퍼 함수 ====
function updateAppMode(payload) {
    // 위성 포커스 해제
    if (_focusSatPos) {
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        _focusSatPos = null;
        _focusSatLookTarget = null;
        _focusSatName = null;
    }
    const oldMainMode = mainMode;
    mainMode = payload.mainMode;
    subMode = payload.subMode;

    // 탐사 <-> 점유 모드 상호 전환 시 카메라 뷰 완전 초기화
    if (oldMainMode && oldMainMode !== mainMode) {
        viewer.camera.cancelFlight();

        // ── 위성 완전 초기화 ──
        // 1) 프리미티브 제거
        if (typeof satellitePrimitives !== 'undefined') {
            satellitePrimitives.removeAll();
        }
        // 2) 위성 3D 모델 엔티티 제거
        if (typeof _satModelEntities !== 'undefined') {
            _satModelEntities.forEach(function(e) { viewer.entities.remove(e); });
            _satModelEntities = [];
        }
        // 3) 위성 애니메이션 프레임 취소
        if (window._satAnimFrameId) {
            cancelAnimationFrame(window._satAnimFrameId);
            window._satAnimFrameId = null;
        }
        // 4) 위성 데이터 완전 삭제 (초기화 버튼 눌러도 복원 안 되도록)
        lastSatellitesData = null;
        highlightedSatelliteName = null;
        window._satCurrentPositions = {};
        // 5) 하이라이트 해제 메시지
        if (typeof highlightSatellite === 'function') {
            highlightSatellite(null);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SATELLITE_DESELECTED' }));
        }

        // ── orbit / 자동 회전 정리 ──
        if (window._autoOrbitRemove) { window._autoOrbitRemove(); window._autoOrbitRemove = null; }
        window._orbitState = null;
        if (window._orbitPitchClamp) { window._orbitPitchClamp(); window._orbitPitchClamp = null; }

        // ── 1인칭 모드 잔여물 정리 ──
        if (window._fpPitchClamp) { window._fpPitchClamp(); window._fpPitchClamp = null; }
        window._fpAboveAlt = null;
        window._fpLookTarget = null;
        window._firstPersonMode = false;
        if (window._fpAnimFrame) { cancelAnimationFrame(window._fpAnimFrame); window._fpAnimFrame = null; }
        if (window._fpFlagEntities) {
            window._fpFlagEntities.forEach(function(e) { viewer.entities.remove(e); });
            window._fpFlagEntities = null;
        }
        // goTo tick listener 정리
        if (window._goToTickListener) {
            viewer.clock.onTick.removeEventListener(window._goToTickListener);
            window._goToTickListener = null;
        }

        // ── 지형 하이라이트/광고 정리 ──
        clearFeatureHighlight();
        if (_adImageryLayer) {
            viewer.scene.primitives.remove(_adImageryLayer);
            _adImageryLayer = null;
        }

        // 기본 뷰로 부드럽게 이동 (skipCameraReset이면 스킵 — 시스템이 별도 카메라 이동 처리)
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        if (!payload.skipCameraReset && moonTileset) {
            viewer.camera.flyToBoundingSphere(moonTileset.boundingSphere, {
                duration: 3.0,
                complete: function() { sendToRN('MODE_TRANSITION_COMPLETE', {}); },
                cancel: function() { sendToRN('MODE_TRANSITION_COMPLETE', {}); }
            });
        } else {
            sendToRN('MODE_TRANSITION_COMPLETE', {});
        }

        // ── 착륙선 3D 모델: 탐사모드에서만 표시 ──
        var isExploration = (mainMode === 'exploration');
        viewer.entities.values.forEach(function(entity) {
            if (entity._isApolloModel) entity.show = isExploration;
        });
        // 랜드마크 마커도 개척모드에서 숨기기
        if (!isExploration) {
            if (typeof landingEntities !== 'undefined') {
                for (var li = 0; li < landingEntities.length; li++) landingEntities[li].show = false;
            }
            if (typeof terrainEntities !== 'undefined') {
                for (var ti = 0; ti < terrainEntities.length; ti++) terrainEntities[ti].show = false;
            }
            landingSitesVisible = false;
            terrainVisible = false;
        }

    }

    // 탐사모드로 복귀: 빌트인 컨트롤러 최소 설정
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    viewer.scene.screenSpaceCameraController.enableLook = false;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1000;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 10000000;


    // 일인칭 컨트롤러 이벤트 제거
    if (firstPersonData.handler) {
        firstPersonData.handler.destroy();
        firstPersonData.handler = null;
    }

    // 그리드/아이템 표시 여부 초기화 (test1/3이면 모드1 그리드 건드리지 않음)
    if (mainMode === 'occupation') {
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = true;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = true;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = true;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = true;
    }

    // 위성 레이어 플러시 로직 (점유 모드로 가거나 탐사 모드 중 위성이 아닐 때 모두 초기화)
    if (typeof satellitePrimitives !== 'undefined') {
        if (mainMode === 'occupation' || subMode !== 'satellite') {
            satellitePrimitives.removeAll();
        }
    }

    if (mainMode === 'occupation') {
        // 점유 모드(모드1): 오리지널 그리드 활성화, PL/TR 그리드 숨김
        // 점유모드에서는 내장 rotation 활성화 (셀 선택/드래그 필요)
        viewer.scene.screenSpaceCameraController.enableRotate = true;
        showGrid = true;
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = true;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = true;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = true;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = true;
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.show = false;
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.show = false;
        sendToRN('GRID_VISIBILITY_CHANGED', { visible: true });
        render(false, true);
    } else if (mainMode === 'test1') {
        // 점유 모드(모드2): 내장 rotation 활성화
        viewer.scene.screenSpaceCameraController.enableRotate = true;
        // 점유 모드(모드2): 모드1/TR 그리드 숨기기, PL은 cesiumControlsOld.js가 독립 관리
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = false;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = false;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = false;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = false;
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.show = true;
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.show = false;
    } else if (mainMode === 'test2') {
        // 점유 모드(모드3): 내장 rotation 활성화
        viewer.scene.screenSpaceCameraController.enableRotate = true;
        // 개척모드: 핀치 줌 차단
        viewer.scene.screenSpaceCameraController.enableZoom = false;
        // 점유 모드(모드3): 모드1/2 그리드 숨기기, TR은 cesiumControlsOccupation.js가 독립 관리
        // ClassificationPrimitive는 show=false를 무시하고 3D Tile에 투영되므로 반드시 removeAll()로 완전 제거
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) { gridPrimitives.removeAll(); gridPrimitives.show = false; }
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) { pillarPrimitives.removeAll(); pillarPrimitives.show = false; }
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) { parentPrimitives.removeAll(); parentPrimitives.show = false; }
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) { flashPrimitives.removeAll(); flashPrimitives.show = false; }
        if (typeof selectionPrimitives !== 'undefined' && selectionPrimitives) { selectionPrimitives.removeAll(); }
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.show = false;
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.show = true;
    } else if (mainMode === 'test3') {
        // 개척모드3: 모드1/2 그리드 완전 제거, T3만 활성화
        viewer.scene.screenSpaceCameraController.enableRotate = true;
        // 모드1 ClassificationPrimitive 완전 제거
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) { gridPrimitives.removeAll(); gridPrimitives.show = false; }
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) { pillarPrimitives.removeAll(); pillarPrimitives.show = false; }
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) { parentPrimitives.removeAll(); parentPrimitives.show = false; }
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) { flashPrimitives.removeAll(); flashPrimitives.show = false; }
        if (typeof selectionPrimitives !== 'undefined' && selectionPrimitives) { selectionPrimitives.removeAll(); }
        // test2 PrimitiveCollection 완전 제거
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) { trGridPrimitives.removeAll(); trGridPrimitives.show = false; }
        if (typeof trNeighborPrimitives !== 'undefined' && trNeighborPrimitives) { trNeighborPrimitives.removeAll(); }
        if (typeof trAccumulatedPrimitives !== 'undefined' && trAccumulatedPrimitives) { trAccumulatedPrimitives.removeAll(); }
        if (typeof trFlashPrimitives !== 'undefined' && trFlashPrimitives) { trFlashPrimitives.removeAll(); }
        // test1 PrimitiveCollection
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) { plGridPrimitives.removeAll(); plGridPrimitives.show = false; }
        // T3 활성화
        if (typeof t3GridPrimitives !== 'undefined' && t3GridPrimitives) t3GridPrimitives.show = true;
    } else {
        // 탐사 모드: 모든 그리드 숨기기
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = false;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = false;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = false;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = false;
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.show = false;
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.show = false;
        // 셀 선택 하이라이트도 정리 (모드 간섭 방지)
        if (typeof selectionPrimitives !== 'undefined' && selectionPrimitives) {
            selectionPrimitives.removeAll();
        }
        window.multiSelectedL16 = [];
        window.selectionPrimMap = {};

        // ═══ 핀치 줌 복원 (개척모드에서 차단했던 것) ═══
        viewer.scene.screenSpaceCameraController.enableZoom = true;
        if (window._savedZoomEventTypes) {
            viewer.scene.screenSpaceCameraController.zoomEventTypes = window._savedZoomEventTypes;
            window._savedZoomEventTypes = null;
        }
        if (window._savedTiltEventTypes) {
            viewer.scene.screenSpaceCameraController.tiltEventTypes = window._savedTiltEventTypes;
            window._savedTiltEventTypes = null;
        }
        if (window._blockPinchZoom) {
            viewer.scene.canvas.removeEventListener('touchmove', window._blockPinchZoom, { capture: true });
            viewer.scene.canvas.removeEventListener('touchstart', window._blockPinchZoom, { capture: true });
            window._blockPinchZoom = null;
        }
        if (window._blockGesture) {
            viewer.scene.canvas.removeEventListener('gesturestart', window._blockGesture);
            viewer.scene.canvas.removeEventListener('gesturechange', window._blockGesture);
            window._blockGesture = null;
        }

        if (subMode === 'satellite') {
            // 위성 뷰: 내장 rotation 활성화 + 틸팅 허용
            viewer.scene.screenSpaceCameraController.enableRotate = true;
            viewer.scene.screenSpaceCameraController.enableTilt = true;
            viewer.scene.screenSpaceCameraController.enableLook = false;
            // flyby 위성(아르테미스 II 등)은 달에서 수만 km 거리 → 줌 제한 확장
            viewer.scene.screenSpaceCameraController.maximumZoomDistance = 500000000;
            let carto = viewer.camera.positionCartographic;
            const newPos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 20000000, Cesium.Ellipsoid.MOON);
            viewer.camera.flyTo({ destination: newPos, duration: 2.5 });

            // 위성 데이터 다시 렌더링
            if (typeof drawSatelliteData === 'function' && typeof lastSatellitesData !== 'undefined' && lastSatellitesData) {
                drawSatelliteData(lastSatellitesData);
            }
        } else if (subMode === 'firstPerson') {
            // 1인칭 뷰: 내장 rotation 활성화
            viewer.scene.screenSpaceCameraController.enableRotate = true;
            // 1인칭 뷰 로직 (재사용 가능: 지형 줌인, 땅보기, 탐사지점 1인칭 전환 등)
            const carto = viewer.camera.positionCartographic;
            let terrainHeight = 0;
            let fallbackHeight = viewer.scene.globe.getHeight(carto);
            if (fallbackHeight !== undefined && !isNaN(fallbackHeight)) {
                terrainHeight = Math.max(0, fallbackHeight);
            }

            const targetHeight = terrainHeight + 2000.0; // 2km 고도

            const surfacePos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, targetHeight, Cesium.Ellipsoid.MOON);

            viewer.camera.flyTo({
                destination: surfacePos,
                orientation: {
                    heading: viewer.camera.heading,
                    pitch: 0,
                    roll: 0
                },
                duration: 2.5,
                complete: function () {
                    // 제어 제한: 회전, 이동 방지. Look만 허용 (드래그로 시야 변경)
                    viewer.scene.screenSpaceCameraController.enableRotate = false;
                    viewer.scene.screenSpaceCameraController.enableTranslate = false;
                    viewer.scene.screenSpaceCameraController.enableZoom = false;
                    viewer.scene.screenSpaceCameraController.enableTilt = true;
                    viewer.scene.screenSpaceCameraController.enableLook = true;

                    // 터치 드래그로 Camera Look 방향 변경 핸들러 추가
                    firstPersonData.handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
                    firstPersonData.handler.setInputAction(function (movement) {
                        const dx = movement.endPosition.x - movement.startPosition.x;
                        const dy = movement.endPosition.y - movement.startPosition.y;
                        const lookFactor = 0.005;

                        let newHeading = viewer.camera.heading + (dx * lookFactor);
                        let newPitch = viewer.camera.pitch - (dy * lookFactor);

                        // Pitch 제한 (서서 걷는 느낌을 위해 누운 시점 방지, 상하 80도 제한)
                        const maxPitch = Cesium.Math.toRadians(80);
                        const minPitch = Cesium.Math.toRadians(-80);
                        if (newPitch > maxPitch) newPitch = maxPitch;
                        if (newPitch < minPitch) newPitch = minPitch;

                        viewer.camera.setView({
                            orientation: {
                                heading: newHeading,
                                pitch: newPitch,
                                roll: 0.0 // Roll 완전 고정
                            }
                        });
                    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE); // 드래그 시야 변경
                }
            });
        } else {
            // 기본 뷰 (우주 뷰 = 기본): 줌/회전 가능
            viewer.scene.screenSpaceCameraController.enableTilt = true;
            viewer.scene.screenSpaceCameraController.enableLook = false;
        }
    }
}

// === 텔레메트리 변수 ===
let lastTelemetryTime = 0;

// === 1인칭 및 텔레메트리 루프 ===
viewer.scene.preUpdate.addEventListener(function (scene, time) {
    if (mainMode === 'exploration') {
        // 1. 텔레메트리 데이터 전송 (1초마다 4번, 즉 250ms 마다)
        const now = Date.now();
        if (now - lastTelemetryTime > 250) {
            lastTelemetryTime = now;
            // positionCartographic는 Cesium 내부적으로 WGS84 기준일 수 있으므로
            // 반드시 MOON ellipsoid로 직접 변환해야 올바른 표면 기준 고도가 나옴
            const camCartesian = viewer.camera.position;
            const camPos = Cesium.Cartographic.fromCartesian(camCartesian, Cesium.Ellipsoid.MOON);
            const lat = Cesium.Math.toDegrees(camPos.latitude).toFixed(4);
            const lon = Cesium.Math.toDegrees(camPos.longitude).toFixed(4);
            const alt = camPos.height.toFixed(0); // 달 표면 기준 미터(m)
            const heading = Cesium.Math.toDegrees(viewer.camera.heading).toFixed(1);
            const pitch = Cesium.Math.toDegrees(viewer.camera.pitch).toFixed(1);

            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'TELEMETRY_UPDATE',
                payload: { lat, lon, alt, heading, pitch }
            }));
        }

        // 2. 1인칭 이동 로직
        if (subMode === 'firstPerson') {
            const moveAmount = 50.0; // 한번에 이동하는 거리(속도)
            if (firstPersonData.forward) viewer.camera.moveForward(moveAmount);
            if (firstPersonData.backward) viewer.camera.moveBackward(moveAmount);
            if (firstPersonData.left) viewer.camera.moveLeft(moveAmount);
            if (firstPersonData.right) viewer.camera.moveRight(moveAmount);

            if (firstPersonData.forward || firstPersonData.backward || firstPersonData.left || firstPersonData.right) {
                const currentPos = viewer.camera.position;
                const carto = Cesium.Cartographic.fromCartesian(currentPos, Cesium.Ellipsoid.MOON);

                let terrainHeight = 0;
                let fallbackHeight = viewer.scene.globe.getHeight(carto); // Use globe.getHeight
                if (fallbackHeight !== undefined && !isNaN(fallbackHeight)) {
                    terrainHeight = Math.max(0, fallbackHeight);
                }

                const targetHeight = terrainHeight + 2000.0; // 사용자가 띄우라고 요청함

                // 보간 추적 로직 (부드러운 카메라 이동 제한)
                carto.height += (targetHeight - carto.height) * 0.1;

                const finalPos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height, Cesium.Ellipsoid.MOON);
                viewer.camera.position = finalPos;
            }
        }
    }
});

let lastSatellitesData = null;
let highlightedSatelliteName = null;

function highlightSatellite(name) {
    highlightedSatelliteName = name;
    if (lastSatellitesData) {
        drawSatelliteData(lastSatellitesData);
    }
}

// ==== 육각형 마커 이미지 생성 (2x 해상도) ====
var _hexCanvas = document.createElement('canvas');
_hexCanvas.width = 64; _hexCanvas.height = 64;
var _hctx = _hexCanvas.getContext('2d');
_hctx.strokeStyle = 'rgba(210,210,210,1)';
_hctx.lineWidth = 2.5;
_hctx.beginPath();
for (var hi = 0; hi < 6; hi++) {
    var hAngle = Math.PI / 3 * hi - Math.PI / 6;
    var hx = 32 + 22 * Math.cos(hAngle);
    var hy = 32 + 22 * Math.sin(hAngle);
    if (hi === 0) _hctx.moveTo(hx, hy);
    else _hctx.lineTo(hx, hy);
}
_hctx.closePath();
_hctx.stroke();
var _hexDataUrl = _hexCanvas.toDataURL();

// Centripetal Catmull-Rom 스플라인 (오버슈팅 방지)
function catmullRomSmooth(points, subdivisions) {
    if (points.length < 3) return points.slice();
    var result = [];

    function dist(a, b) {
        var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    for (var i = 0; i < points.length - 1; i++) {
        var p0 = points[Math.max(0, i - 1)];
        var p1 = points[i];
        var p2 = points[Math.min(points.length - 1, i + 1)];
        var p3 = points[Math.min(points.length - 1, i + 2)];
        result.push(p1);

        // centripetal 파라미터 (alpha=0.5)
        var d01 = Math.pow(dist(p0, p1), 0.5) || 1;
        var d12 = Math.pow(dist(p1, p2), 0.5) || 1;
        var d23 = Math.pow(dist(p2, p3), 0.5) || 1;

        for (var s = 1; s < subdivisions; s++) {
            var t = s / subdivisions;

            // Barry-Goldman 알고리즘
            var t0 = 0, t1 = d01, t2 = t1 + d12, t3 = t2 + d23;
            var tt = t1 + t * (t2 - t1);

            var a1x = (t1 - tt) / (t1 - t0) * p0.x + (tt - t0) / (t1 - t0) * p1.x;
            var a1y = (t1 - tt) / (t1 - t0) * p0.y + (tt - t0) / (t1 - t0) * p1.y;
            var a1z = (t1 - tt) / (t1 - t0) * p0.z + (tt - t0) / (t1 - t0) * p1.z;

            var a2x = (t2 - tt) / (t2 - t1) * p1.x + (tt - t1) / (t2 - t1) * p2.x;
            var a2y = (t2 - tt) / (t2 - t1) * p1.y + (tt - t1) / (t2 - t1) * p2.y;
            var a2z = (t2 - tt) / (t2 - t1) * p1.z + (tt - t1) / (t2 - t1) * p2.z;

            var a3x = (t3 - tt) / (t3 - t2) * p2.x + (tt - t2) / (t3 - t2) * p3.x;
            var a3y = (t3 - tt) / (t3 - t2) * p2.y + (tt - t2) / (t3 - t2) * p3.y;
            var a3z = (t3 - tt) / (t3 - t2) * p2.z + (tt - t2) / (t3 - t2) * p3.z;

            var b1x = (t2 - tt) / (t2 - t0) * a1x + (tt - t0) / (t2 - t0) * a2x;
            var b1y = (t2 - tt) / (t2 - t0) * a1y + (tt - t0) / (t2 - t0) * a2y;
            var b1z = (t2 - tt) / (t2 - t0) * a1z + (tt - t0) / (t2 - t0) * a2z;

            var b2x = (t3 - tt) / (t3 - t1) * a2x + (tt - t1) / (t3 - t1) * a3x;
            var b2y = (t3 - tt) / (t3 - t1) * a2y + (tt - t1) / (t3 - t1) * a3y;
            var b2z = (t3 - tt) / (t3 - t1) * a2z + (tt - t1) / (t3 - t1) * a3z;

            var cx = (t2 - tt) / (t2 - t1) * b1x + (tt - t1) / (t2 - t1) * b2x;
            var cy = (t2 - tt) / (t2 - t1) * b1y + (tt - t1) / (t2 - t1) * b2y;
            var cz = (t2 - tt) / (t2 - t1) * b1z + (tt - t1) / (t2 - t1) * b2z;

            result.push(new Cesium.Cartesian3(cx, cy, cz));
        }
    }
    result.push(points[points.length - 1]);
    return result;
}

// ==== 위성 데이터 렌더링 ====
var _satModelEntities = []; // 다누리 + chandrayaan + capstone + lro 모델 엔티티
window._satCurrentPositions = {}; // 위성 이름 → 현재 Cartesian3 (FOCUS_SATELLITE용)

function drawSatelliteData(satellites) {
    if (typeof satellitePrimitives === 'undefined') return;
    lastSatellitesData = satellites;
    satellitePrimitives.removeAll();
    _satModelEntities.forEach(function(e) { viewer.entities.remove(e); });
    _satModelEntities = [];
    if (window._satAnimFrameId) { cancelAnimationFrame(window._satAnimFrameId); window._satAnimFrameId = null; }
    window._satCurrentPositions = {};

    var labels = satellitePrimitives.add(new Cesium.LabelCollection());
    var billboards = satellitePrimitives.add(new Cesium.BillboardCollection());
    var animatedStates = [];
    var nowMs = Date.now();

    satellites.forEach(function(sat) {
        var isHighlighted = highlightedSatelliteName === sat.name;
        var hasHighlight = highlightedSatelliteName !== null;
        var baseAlpha = hasHighlight ? (isHighlighted ? 0.8 : 0.08) : 0.5;
        var markerAlpha = hasHighlight ? (isHighlighted ? 1.0 : 0.15) : 0.9;
        if (!sat.position) return;

        // ─── 1. 궤적 전체 정렬 (과거+미래 모두) ───
        var sorted = [];
        if (sat.trajectory && sat.trajectory.length > 1) {
            sorted = sat.trajectory.slice()
                .filter(function(p) { return p.epochMs && !isNaN(p.epochMs); })
                .sort(function(a, b) { return a.epochMs - b.epochMs; });
        }

        // [DEBUG] 궤적 데이터 진단
        console.log('[drawSat] ' + sat.name + ': raw traj=' + (sat.trajectory ? sat.trajectory.length : 0) + ', filtered sorted=' + sorted.length);
        if (sat.name.toUpperCase().indexOf('ARTEMIS II') !== -1 || (sat.id && sat.id === '-1024')) {
            sendToRN('DEBUG_LOG', '[drawSat] Artemis II: pos=' + JSON.stringify({x: sat.position.x, y: sat.position.y, z: sat.position.z}).substring(0, 80) + ', traj=' + sorted.length + ', mType=' + sat.missionType);
        }
        if (sat.trajectory && sat.trajectory.length > 0 && sorted.length === 0) {
            console.log('[drawSat] ' + sat.name + ' FILTERED OUT! sample:', JSON.stringify(sat.trajectory[0]));
        }

        if (sorted.length < 2) {
            // 궤적 없으면 정적 마커만
            var staticPos = new Cesium.Cartesian3(sat.position.x * 1000, sat.position.y * 1000, sat.position.z * 1000);
            window._satCurrentPositions[sat.name] = staticPos;
            billboards.add({ position: staticPos, image: _hexDataUrl, width: 28, height: 28, color: new Cesium.Color(0.85, 0.85, 0.85, markerAlpha), sizeInMeters: false, disableDepthTestDistance: Number.POSITIVE_INFINITY });
            labels.add({ position: staticPos, text: sat.name.toUpperCase(), font: '14px sans-serif', fillColor: new Cesium.Color(0.8, 0.8, 0.8, 0.8), outlineColor: Cesium.Color.BLACK.withAlpha(0.6), outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(22, 0), horizontalOrigin: Cesium.HorizontalOrigin.LEFT, verticalOrigin: Cesium.VerticalOrigin.CENTER, disableDepthTestDistance: Number.POSITIVE_INFINITY });
            return;
        }

        // ─── 2. 전체 궤적을 Catmull-Rom으로 한 번에 스무딩 ───
        var rawPts = [];
        var rawTimes = [];
        for (var i = 0; i < sorted.length; i++) {
            rawPts.push(new Cesium.Cartesian3(sorted[i].x * 1000, sorted[i].y * 1000, sorted[i].z * 1000));
            rawTimes.push(sorted[i].epochMs);
        }
        var smoothPts = catmullRomSmooth(rawPts, 8);

        // ─── 3. 스무스 포인트마다 시간 매핑 ───
        var smoothTimes = [];
        var subsPerSeg = 8; // catmullRomSmooth의 subdivisions
        var origCount = rawPts.length;
        // 각 원본 세그먼트(i→i+1) 사이에 subsPerSeg개 보간점
        // smoothPts 구조: [p0, sub1..sub8, p1, sub1..sub8, p2, ...]
        // 총 포인트 = (origCount - 1) * subsPerSeg + origCount  ... 아님
        // catmullRomSmooth 결과: 각 세그먼트에 subdivisions개 + 마지막 원본 = (n-1)*subs + 1 + (n-1) 대략
        // 정확히는: smoothPts 개수를 기반으로 선형 매핑
        var totalSmooth = smoothPts.length;
        for (var si = 0; si < totalSmooth; si++) {
            // 전체 스무스 범위를 원본 시간 범위에 선형 매핑
            var frac = si / (totalSmooth - 1);
            var t = rawTimes[0] + frac * (rawTimes[rawTimes.length - 1] - rawTimes[0]);
            smoothTimes.push(t);
        }

        // ─── 4. 현재 위치 = 스무스 경로 위 시간 보간 ───
        var pos = interpSmooth(smoothPts, smoothTimes, nowMs);
        window._satCurrentPositions[sat.name] = pos;

        // ─── 5. 과거 트레일 (현재까지 지나간 부분만) ───
        var pastIdx = findSplitIndex(smoothTimes, nowMs);
        var pastSlice = smoothPts.slice(0, pastIdx + 1);
        pastSlice.push(pos); // 현재 보간 위치까지

        // 10단계 그라데이션 트레일
        var lineW = isHighlighted ? 2.5 : 1.5;
        var trailPolylines = []; // 나중에 업데이트용
        var trailCollections = [];
        if (pastSlice.length >= 2) {
            var numSeg = 10;
            var segSz = Math.max(2, Math.floor(pastSlice.length / numSeg));
            for (var gi = 0; gi < numSeg; gi++) {
                var s = gi * segSz;
                var e = (gi === numSeg - 1) ? pastSlice.length : Math.min((gi + 1) * segSz + 1, pastSlice.length);
                if (s >= pastSlice.length) break;
                var sp = pastSlice.slice(s, e);
                if (sp.length < 2) continue;
                var tr = (gi + 1) / numSeg;
                var al = 0.05 + (baseAlpha - 0.05) * tr * tr;
                var pc = satellitePrimitives.add(new Cesium.PolylineCollection());
                var pl = pc.add({ positions: sp, width: lineW, material: Cesium.Material.fromType('Color', { color: new Cesium.Color(0.75, 0.75, 0.75, al) }) });
                pl.id = { name: sat.name, isSatellite: true, nocsId: sat.nocsId };
                trailPolylines.push(pl);
                trailCollections.push(pc);
            }
        }

        // ─── flyby 미션 판별 (Artemis II 등) ───
        var isFlyby = sat.missionType === 'flyby';

        // ─── 라이브 팁 (그라데이션 끝 → 현재 위치, 매 프레임 연장) ───
        // flyby는 거리가 멀어 보간 시 떨림 → tip 비활성
        var tipPoly = null;
        if (!isFlyby) {
            var tipColl = satellitePrimitives.add(new Cesium.PolylineCollection());
            tipPoly = tipColl.add({
                positions: [pos.clone(), pos.clone()],
                width: lineW,
                material: Cesium.Material.fromType('Color', { color: new Cesium.Color(0.75, 0.75, 0.75, baseAlpha) })
            });
            tipPoly.id = { name: sat.name, isSatellite: true, nocsId: sat.nocsId };
        }

        // ─── 미래 궤적 (예측 경로, 점선) — flyby 미션만 ───
        if (isFlyby) {
            var futureSlice = smoothPts.slice(pastIdx + 1);
            futureSlice.unshift(pos);
            if (futureSlice.length >= 2) {
                var futureAlpha = hasHighlight ? (isHighlighted ? 0.35 : 0.05) : 0.2;
                var futureColl = satellitePrimitives.add(new Cesium.PolylineCollection());
                var futurePoly = futureColl.add({
                    positions: futureSlice,
                    width: isHighlighted ? 2.0 : 1.0,
                    material: Cesium.Material.fromType('PolylineDash', {
                        color: new Cesium.Color(0.6, 0.85, 1.0, futureAlpha),
                        dashLength: 16.0,
                        dashPattern: parseInt('0011001100110011', 2)
                    })
                });
                futurePoly.id = { name: sat.name, isSatellite: true, nocsId: sat.nocsId };
            }
        }

        // ─── 6. 마커 + 라벨 ───
        var bb = billboards.add({
            position: pos, image: _hexDataUrl,
            width: isHighlighted ? 36 : 28, height: isHighlighted ? 36 : 28,
            color: new Cesium.Color(0.85, 0.85, 0.85, markerAlpha),
            sizeInMeters: false, disableDepthTestDistance: Number.POSITIVE_INFINITY
        });
        bb.id = { name: sat.name, isSatellite: true, nocsId: sat.nocsId };
        var lbl = labels.add({
            position: pos, text: sat.name.toUpperCase(),
            font: isHighlighted ? '500 16px sans-serif' : '14px sans-serif',
            fillColor: new Cesium.Color(0.8, 0.8, 0.8, hasHighlight ? (isHighlighted ? 1.0 : 0.2) : 0.8),
            outlineColor: Cesium.Color.BLACK.withAlpha(0.6), outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(22, 0),
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT, verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        });

        // ─── 7. 3D 위성 모델 (다누리, Chandrayaan, CAPSTONE, LRO) ───
        var snu = sat.name.toUpperCase();
        var _satModelEntity = null;
        var _satModelConfigs = [
            { check: snu.indexOf('DANURI') !== -1 || snu.indexOf('KPLO') !== -1 || (sat.id && sat.id === '-155'), uriKey: 'DANURI_GLB_URI', flag: '_isDanuriModel', color: '#60A5FA', scale: 150 },
            { check: snu.indexOf('CHANDRAYAAN') !== -1 || (sat.id && sat.id === '-152'), uriKey: 'CHANDRAYAAN2_GLB_URI', flag: '_isChandrayaan2Model', color: '#FF9800', scale: 200 },
            { check: snu.indexOf('CAPSTONE') !== -1, uriKey: 'CAPSTONE_GLB_URI', flag: '_isCapstoneModel', color: '#8B5CF6', scale: 640 },
            { check: snu.indexOf('LRO') !== -1 || snu.indexOf('LUNAR RECONNAISSANCE') !== -1, uriKey: 'LRO_GLB_URI', flag: '_isLroModel', color: '#10B981', scale: 300 },
            { check: snu.indexOf('ARTEMIS II') !== -1 || snu.indexOf('ARTEMIS 2') !== -1 || (sat.id && sat.id === '-1024'), uriKey: 'ARTEMIS_II_GLB_URI', flag: '_isArtemis_iiModel', color: '#00BCD4', scale: 50 },
            { check: snu.indexOf('THEMIS') !== -1 || snu.indexOf('ARTEMIS-P') !== -1 || snu.indexOf('ARTEMIS P') !== -1, uriKey: 'THEMIS_GLB_URI', flag: '_isThemisModel', color: '#F59E0B', scale: 240 },
        ];
        for (var mi = 0; mi < _satModelConfigs.length; mi++) {
            var mc = _satModelConfigs[mi];
            if (mc.check && window[mc.uriKey]) {
                try {
                    _satModelEntity = viewer.entities.add({
                        position: pos, model: { uri: window[mc.uriKey], scale: mc.scale, minimumPixelSize: 32, maximumScale: 50000 }
                    });
                    _satModelEntity[mc.flag] = true; _satModelEntities.push(_satModelEntity);
                } catch(e) {}
                break; // 하나의 모델만 적용
            }
        }
        // 전용 모델이 없는 위성은 다누리 모델을 폴백으로 사용
        if (!_satModelEntity && window['DANURI_GLB_URI']) {
            try {
                _satModelEntity = viewer.entities.add({
                    position: pos, model: { uri: window['DANURI_GLB_URI'], scale: 150, minimumPixelSize: 32, maximumScale: 50000 }
                });
                _satModelEntity._isDanuriModel = true; _satModelEntities.push(_satModelEntity);
            } catch(e) {}
        }

        // flyby 미션은 실시간 보간 안 함 (먼 거리 떨림 방지)
        if (!isFlyby) {
            animatedStates.push({
                name: sat.name, billboard: bb, label: lbl, modelEntity: _satModelEntity,
                smoothPts: smoothPts, smoothTimes: smoothTimes,
                tipPoly: tipPoly, lastTipAnchor: pos.clone(),
                baseAlpha: baseAlpha, lineW: lineW, nocsId: sat.nocsId,
                lastEpochMs: sorted[sorted.length - 1].epochMs,
                prevPos: pos.clone()
            });
        }
    });

    // ─── 스무스 경로 위 시간 보간 ───
    function interpSmooth(pts, times, t) {
        if (t <= times[0]) return pts[0].clone();
        if (t >= times[times.length - 1]) return pts[pts.length - 1].clone();
        // 이진탐색
        var lo = 0, hi = times.length - 1;
        while (lo < hi - 1) { var mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
        var frac = (t - times[lo]) / (times[hi] - times[lo]);
        return new Cesium.Cartesian3(
            pts[lo].x + (pts[hi].x - pts[lo].x) * frac,
            pts[lo].y + (pts[hi].y - pts[lo].y) * frac,
            pts[lo].z + (pts[hi].z - pts[lo].z) * frac
        );
    }

    function findSplitIndex(times, t) {
        // t 이하인 마지막 인덱스
        var lo = 0, hi = times.length - 1;
        if (t >= times[hi]) return hi;
        if (t <= times[lo]) return 0;
        while (lo < hi - 1) { var mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
        return lo;
    }

    // ─── 실시간 애니메이션 루프 ───
    if (animatedStates.length > 0) {
        function animLoop() {
            try {
                var now = Date.now();
                for (var i = 0; i < animatedStates.length; i++) {
                    var st = animatedStates[i];

                    // 위성 위치 = 스무스 경로 위 보간
                    var np = interpSmooth(st.smoothPts, st.smoothTimes, now);
                    st.billboard.position = np;
                    st.label.position = np;
                    if (st.modelEntity) {
                        st.modelEntity.position = np;
                        // 궤적 포인트 기반 이동 방향 계산 (30초 앞뒤 포인트 사용)
                        try {
                            var dt = 30000; // 30초
                            var posBefore = interpSmooth(st.smoothPts, st.smoothTimes, now - dt);
                            var posAfter = interpSmooth(st.smoothPts, st.smoothTimes, now + dt);
                            var vel = Cesium.Cartesian3.subtract(posAfter, posBefore, new Cesium.Cartesian3());
                            var velMag = Cesium.Cartesian3.magnitude(vel);
                            if (velMag > 0.1) {
                                var velNorm = Cesium.Cartesian3.normalize(vel, new Cesium.Cartesian3());
                                // Moon 타원체 기반 ENU 프레임
                                var mtx = Cesium.Transforms.eastNorthUpToFixedFrame(np, Cesium.Ellipsoid.MOON);
                                var invMtx = Cesium.Matrix4.inverse(mtx, new Cesium.Matrix4());
                                var localVel = Cesium.Matrix4.multiplyByPointAsVector(invMtx, velNorm, new Cesium.Cartesian3());
                                var heading = Math.atan2(localVel.x, localVel.y);
                                var pitch = Math.asin(Cesium.Math.clamp(localVel.z, -1.0, 1.0));
                                var hpr = new Cesium.HeadingPitchRoll(heading, pitch, 0);
                                st.modelEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(np, hpr, Cesium.Ellipsoid.MOON);
                            }
                        } catch(oe) {}
                    }
                    window._satCurrentPositions[st.name] = np;

                    // 카메라 포커스 추적
                    if (_focusSatName === st.name && _focusSatPos) {
                        _focusSatPos = np;
                        _focusSatLookTarget = Cesium.Cartesian3.clone(np);
                        try { viewer.camera.lookAt(_focusSatLookTarget, new Cesium.HeadingPitchRange(viewer.camera.heading, viewer.camera.pitch, _focusSatRange)); } catch(e) {}
                    }

                    // 매 프레임: 팁 폴리라인을 현재 위치까지 연장 (부드러운 그리기)
                    st.tipPoly.positions = [st.lastTipAnchor, np];

                    // 미래 데이터 끝 근처(5분 전)이면 재갱신 트리거
                    if (now > st.lastEpochMs - 5 * 60 * 1000 && !st._refreshTriggered) {
                        st._refreshTriggered = true;
                        try {
                            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SATELLITE_DATA_REFRESH_NEEDED' }));
                        } catch(e) {}
                    }
                }
            } catch(e) { console.error('[Sat] Anim error:', e); }
            window._satAnimFrameId = requestAnimationFrame(animLoop);
        }
        window._satAnimFrameId = requestAnimationFrame(animLoop);
    }
}
// --- 초기 렌더링 ---
if (mainMode === 'test3') {
    renderTerrainT3();
} else if (mainMode === 'test2') {
    renderTerrain();
} else if (mainMode === 'test1') {
    renderPolyline();
} else {
    render(false, true);
}

// --- 초기화 완료: 메시지 큐 리플레이 ---
window._initComplete = true;
document.removeEventListener('message', _earlyMessageHandler);
window.removeEventListener('message', _earlyMessageHandler);
if (window._messageQueue.length > 0) {
    console.log('[Queue] Replaying', window._messageQueue.length, 'buffered messages');
    window._messageQueue.forEach(function(msgData) {
        var evt = new MessageEvent('message', { data: msgData });
        document.dispatchEvent(evt);
    });
    window._messageQueue = [];
}
console.log('[Init] initMoon() fully complete');
sendToRN('INIT_COMPLETE', {});

    } // end of initMoon

// Start initialization
initMoon().catch(err => {
    console.error("Top Level Init Error:", err);
    if (window.onerror) window.onerror(err.message, "initMoon", 0, 0, err);
});
`;
