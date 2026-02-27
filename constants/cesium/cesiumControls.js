// cesiumControls.js — 클릭 핸들러 + 줌 + RN 메시지 라우팅 모듈
// handleRNMessage, 클릭 핸들러, changeZoomLevel

export const CESIUM_CONTROLS = `
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
        if (message.type === 'GO_BACK') goBack();
        if (message.type === 'RESET') resetExplorer();
        if (message.type === 'TOGGLE_GRID') {
            showGrid = message.payload;
            if (gridPrimitives) gridPrimitives.show = showGrid;
        }
        if (message.type === 'TOGGLE_GRID_MODE') {
            gridRenderMode = gridRenderMode === 'fill' ? 'line' : 'fill';
            var btn = document.getElementById('gridModeToggle');
            if (btn) btn.textContent = gridRenderMode === 'fill' ? '▦ 면' : '╬ 선';
            lastRenderedDepth = 0;
            parentPrimitives.removeAll();
            render();
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
        if (message.type === 'UPDATE_MODE') {
            updateAppMode(message.payload);
        }
        if (message.type === 'CHANGE_GRID_COLOR') {
            render();
        }
        if (message.type === 'ZOOM_IN') {
            changeZoomLevel(1);
        }
        if (message.type === 'ZOOM_OUT') {
            changeZoomLevel(-1);
        }
        if (message.type === 'RESET_VIEW') {
            resetExplorer();
        }
        if (message.type === 'GO_TO_LOCATION') {
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
        if (message.type === 'TOGGLE_LANDMARKS') {
            toggleLandmarks(message.enabled);
        }
        if (message.type === 'TOGGLE_LANDING_SITES') {
            toggleLandingSites(message.enabled);
        }
        if (message.type === 'TOGGLE_TERRAIN') {
            toggleTerrainFlags(message.enabled);
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
    } catch (e) {
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_LOG', payload: 'Cesium JS Error: ' + e.message }));
        }
        console.error("Cesium Message Error:", e);
    }
}

// === 표면 레이캐스팅 기반 클릭 핸들러 ===
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction((movement) => {
    // 1. 위성 픽킹 (탐사 모드 + 위성 뷰)
    const pickedObjects = viewer.scene.drillPick(movement.position);
    let satellitePicked = false;
    for (let i = 0; i < pickedObjects.length; i++) {
        const pickedObject = pickedObjects[i];
        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.isSatellite) {
            const sat = pickedObject.id;
            highlightSatellite(sat.name);
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SATELLITE_SELECTED',
                payload: {
                    name: sat.name,
                    speed: sat.speed || '알 수 없음',
                    description: sat.description || ''
                }
            }));
            satellitePicked = true;
            break;
        }
    }

    if (satellitePicked) return;

    if (mainMode === 'exploration' && subMode === 'satellite') {
        highlightSatellite(null);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SATELLITE_DESELECTED' }));
        return;
    }

    // 2. 달 표면 좌표 얻기 (pickPosition fails on some mobile WebViews, use raycast)
    let cartesian = viewer.scene.pickPosition(movement.position);

    if (!Cesium.defined(cartesian)) {
        const ray = viewer.camera.getPickRay(movement.position);
        cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    }
    if (!Cesium.defined(cartesian)) {
        cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
    }

    if (!Cesium.defined(cartesian)) return;

    // Cartesian3 → S2 Point → 어떤 셀인지 계산
    const s2Point = cesiumToS2Point(cartesian);
    if (!s2Point) return;

    // 점유 모드가 아니면 클릭 이벤트를 무시 (그리드 선택 불가)
    if (mainMode !== 'occupation') return;

    // 현재 활성 레벨에서 타겟 레벨 결정
    const lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
    const currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;

    if (currentLevel >= 16) {
        // L16 이미 선택됨 — 최종 확정 메시지 전송
        if (lastCellId) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'CELL_CONFIRMED',
                payload: { token: s2.cellid.toToken(lastCellId), level: 16 }
            }));
        }
        return;
    }

    const targetLevel = currentLevel + 4;

    // 클릭한 좌표가 속하는 타겟 레벨 셀 찾기 (fromPoint는 leaf 반환)
    try {
        const leafCellId = s2.cellid.fromPoint(s2Point);
        if (!leafCellId) return;

        const cellId = s2.cellid.parent(leafCellId, targetLevel);

        // 유효성 검증: 현재 선택된 부모 안에 있는 셀인지 확인
        if (lastCellId) {
            const parentOfClicked = s2.cellid.parent(cellId, currentLevel);
            if (s2.cellid.toToken(parentOfClicked) !== s2.cellid.toToken(lastCellId)) {
                return; // 부모 영역 밖 클릭 무시
            }
        }

        const lvl = s2.cellid.level(cellId);
        if (lvl <= 0) return;

        flashCell(cellId);
        selectionStack.push(cellId);
        render();
        flyToCell(cellId);
    } catch (e) {
        return;
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// --- 5단계 고정 줌 레벨 함수 ---
function changeZoomLevel(direction) {
    const newLevel = currentZoomLevel + direction;

    if (newLevel < 0 || newLevel >= ZOOM_LEVELS.length) {
        updateUI();
        return;
    }

    currentZoomLevel = newLevel;
    const targetHeight = ZOOM_LEVELS[currentZoomLevel].height;

    const center = viewer.camera.pickEllipsoid(
        new Cesium.Cartesian2(viewer.canvas.width / 2, viewer.canvas.height / 2),
        moonEllipsoid
    );

    let targetPosition;

    if (center) {
        const normal = Cesium.Cartesian3.normalize(center, new Cesium.Cartesian3());
        targetPosition = Cesium.Cartesian3.add(
            center,
            Cesium.Cartesian3.multiplyByScalar(normal, targetHeight, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );
    } else {
        const camPos = viewer.camera.position;
        const normal = Cesium.Cartesian3.normalize(camPos, new Cesium.Cartesian3());
        const surfacePoint = Cesium.Cartesian3.multiplyByScalar(normal, moonRadius, new Cesium.Cartesian3());
        targetPosition = Cesium.Cartesian3.add(
            surfacePoint,
            Cesium.Cartesian3.multiplyByScalar(normal, targetHeight, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );
    }

    const startPosition = Cesium.Cartesian3.clone(viewer.camera.position);
    const startHeading = viewer.camera.heading;
    const startPitch = viewer.camera.pitch;
    const targetPitch = Cesium.Math.toRadians(-90);
    const duration = 1000;
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

        const t = 1 - Math.pow(1 - progress, 3);

        const currentPos = new Cesium.Cartesian3();
        Cesium.Cartesian3.lerp(startPosition, targetPosition, t, currentPos);

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
    updateUI();
}

// ==== 모드 전환 헬퍼 함수 ====
function updateAppMode(payload) {
    const oldMainMode = mainMode;
    mainMode = payload.mainMode;
    subMode = payload.subMode;

    // 탐사 모드일 때 좌측 상단 "면/선" 전환 버튼 숨김
    const gridModeBtn = document.getElementById('gridModeToggle');
    if (gridModeBtn) {
        gridModeBtn.style.display = mainMode === 'occupation' ? 'block' : 'none';
    }

    // 탐사 모드일 때 좌측 하단 디버그 패널(그리드 정보) 숨김
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
        debugPanel.style.display = mainMode === 'occupation' ? 'block' : 'none';
    }

    // 탐사 <-> 점유 모드 상호 전환 시 카메라 뷰 완전 초기화
    if (oldMainMode && oldMainMode !== mainMode) {
        viewer.camera.cancelFlight();

        // 모드 전환 시 이전 모드의 잔여물(예: 위성 궤적) 완벽히 초기화
        if (typeof satellitePrimitives !== 'undefined') {
            satellitePrimitives.removeAll();
        }
        if (typeof highlightSatellite === 'function') {
            highlightSatellite(null);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SATELLITE_DESELECTED' }));
        }

        const defaultPos = Cesium.Cartesian3.fromRadians(0, 0, 6105648, Cesium.Ellipsoid.MOON);
        viewer.camera.flyTo({
            destination: defaultPos,
            orientation: {
                heading: 0.0,
                pitch: Cesium.Math.toRadians(-90),
                roll: 0.0
            },
            duration: 1.5
        });
    }

    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = true;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.enableTilt = false; // 틸트 항상 잠금
    viewer.scene.screenSpaceCameraController.enableLook = true;

    // 일인칭 컨트롤러 이벤트 제거
    if (firstPersonData.handler) {
        firstPersonData.handler.destroy();
        firstPersonData.handler = null;
    }

    // 그리드/아이템 표시 여부 초기화
    if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = true;
    if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = true;
    if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = true;
    if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = true;

    // 위성 레이어 플러시 로직 (점유 모드로 가거나 탐사 모드 중 위성이 아닐 때 모두 초기화)
    if (typeof satellitePrimitives !== 'undefined') {
        if (mainMode === 'occupation' || subMode !== 'satellite') {
            satellitePrimitives.removeAll();
        }
    }

    if (mainMode === 'occupation') {
        // 점유 모드: 기존 자유 탐색 (그리드 표시)
    } else {
        // 탐사 모드
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = false;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = false;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = false;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = false;

        if (subMode === 'satellite') {
            // 위성 뷰: 틸팅 비활성화, 화면에 달이 절반만 찰 정도로 아주 멀리 줌 아웃 (2만 km 고도)
            viewer.scene.screenSpaceCameraController.enableTilt = false;
            viewer.scene.screenSpaceCameraController.enableLook = false;
            let carto = viewer.camera.positionCartographic;
            const newPos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 20000000, Cesium.Ellipsoid.MOON);
            viewer.camera.flyTo({ destination: newPos, duration: 1.5 });

            // 위성 데이터 다시 렌더링
            if (typeof drawSatelliteData === 'function' && typeof lastSatellitesData !== 'undefined' && lastSatellitesData) {
                drawSatelliteData(lastSatellitesData);
            }
        } else if (subMode === 'space') {
            // 우주 뷰: 틸팅 비활성화, 줌/회전만 가능
            viewer.scene.screenSpaceCameraController.enableTilt = false;
            viewer.scene.screenSpaceCameraController.enableLook = false;

            // 만약 1인칭이었다가 돌아왔다면 고도를 좀 높여줌
            let carto = viewer.camera.positionCartographic;
            if (carto.height < 1000) {
                const newPos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 500000, Cesium.Ellipsoid.MOON);
                viewer.camera.flyTo({ destination: newPos, duration: 1.0 });
            }
        } else if (subMode === 'firstPerson') {
            // 1인칭 뷰: 첫 진입 시 카메라를 표면에 배치 (일단 충돌 문제로 임시 높이 띄움)
            const carto = viewer.camera.positionCartographic;
            let terrainHeight = 0;
            let fallbackHeight = viewer.scene.globe.getHeight(carto);
            if (fallbackHeight !== undefined && !isNaN(fallbackHeight)) {
                terrainHeight = Math.max(0, fallbackHeight);
            }

            const targetHeight = terrainHeight + 2000.0; // 사용자가 띄우라고 요청함 (2km 고도)

            const surfacePos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, targetHeight, Cesium.Ellipsoid.MOON);

            viewer.camera.flyTo({
                destination: surfacePos,
                orientation: {
                    heading: viewer.camera.heading,
                    pitch: 0,
                    roll: 0
                },
                duration: 1.5,
                complete: function () {
                    // 제어 제한: 회전, 이동 방지. Look만 허용 (드래그로 시야 변경)
                    viewer.scene.screenSpaceCameraController.enableRotate = false;
                    viewer.scene.screenSpaceCameraController.enableTranslate = false;
                    viewer.scene.screenSpaceCameraController.enableZoom = false; // 기본 줌 불가 (추후 전진/후진 터치로)
                    viewer.scene.screenSpaceCameraController.enableTilt = false;
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

// ==== 위성 데이터 렌더링 ====
function drawSatelliteData(satellites) {
    if (typeof satellitePrimitives === 'undefined') return;
    lastSatellitesData = satellites;
    satellitePrimitives.removeAll();

    var labels = satellitePrimitives.add(new Cesium.LabelCollection());
    var billboards = satellitePrimitives.add(new Cesium.BillboardCollection());

    satellites.forEach(function(sat) {
        var isHighlighted = highlightedSatelliteName === sat.name;
        var hasHighlight = highlightedSatelliteName !== null;
        var baseAlpha = hasHighlight ? (isHighlighted ? 0.8 : 0.08) : 0.5;

        // ─── 궤적 (그라데이션 페이드) ───
        if (sat.trajectory && sat.trajectory.length > 1) {
            var totalPts = sat.trajectory.length;
            // 궤적을 여러 세그먼트로 나눠 각각 다른 투명도
            var segCount = Math.min(totalPts - 1, 40);
            var step = Math.max(1, Math.floor(totalPts / segCount));

            for (var si = 0; si < totalPts - step; si += step) {
                var ei = Math.min(si + step + 1, totalPts);
                var segPositions = [];
                for (var pi = si; pi < ei; pi++) {
                    var pt = sat.trajectory[pi];
                    segPositions.push(new Cesium.Cartesian3(pt.x * 1000, pt.y * 1000, pt.z * 1000));
                }
                // 현재위치(끝)에 가까울수록 밝고, 과거(시작)일수록 흐림
                var progress = si / (totalPts - 1); // 0=과거, 1=현재
                var segAlpha = baseAlpha * (0.05 + 0.95 * progress);
                var lineWidth = isHighlighted ? 2.5 : 1.5;

                var polylines = satellitePrimitives.add(new Cesium.PolylineCollection());
                var polyline = polylines.add({
                    positions: segPositions,
                    width: lineWidth,
                    material: Cesium.Material.fromType('Color', {
                        color: new Cesium.Color(0.75, 0.75, 0.75, segAlpha)
                    })
                });
                polyline.id = { name: sat.name, isSatellite: true, nocsId: sat.nocsId };
            }
        }

        // ─── 현재 위치 마커 (육각형) ───
        if (sat.position) {
            var pos = new Cesium.Cartesian3(
                sat.position.x * 1000,
                sat.position.y * 1000,
                sat.position.z * 1000
            );

            var markerAlpha = hasHighlight ? (isHighlighted ? 1.0 : 0.15) : 0.9;
            var bb = billboards.add({
                position: pos,
                image: _hexDataUrl,
                width: isHighlighted ? 36 : 28,
                height: isHighlighted ? 36 : 28,
                color: new Cesium.Color(0.85, 0.85, 0.85, markerAlpha),
                sizeInMeters: false,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            });
            bb.id = { name: sat.name, isSatellite: true, nocsId: sat.nocsId };

            // ─── 라벨 (심플 무채색) ───
            labels.add({
                position: pos,
                text: sat.name.toUpperCase(),
                font: isHighlighted ? '500 16px sans-serif' : '14px sans-serif',
                fillColor: new Cesium.Color(0.8, 0.8, 0.8, hasHighlight ? (isHighlighted ? 1.0 : 0.2) : 0.8),
                outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(22, 0),
                horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            });
        }
    });
}

// --- 초기 렌더링 ---
render();
    } // end of initMoon

// Start initialization
initMoon().catch(err => {
    console.error("Top Level Init Error:", err);
    if (window.onerror) window.onerror(err.message, "initMoon", 0, 0, err);
});
`;
