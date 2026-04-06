// CesiumARHtml.js — AR 모드 전용 Cesium HTML
// s2js로 점유 구역만 색칠 (그리드/라벨 없이 깔끔하게)

export function createCesiumARHtml() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>AR Moon 3D</title>
  <script src="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Cesium.js"><\/script>
  <link href="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
  <style>
    html, body, #cesiumContainer {
      width: 100%; height: 100%;
      margin: 0; padding: 0;
      overflow: hidden;
      background: transparent !important;
      -webkit-user-select: none;
      user-select: none;
    }
    .cesium-widget, .cesium-widget canvas {
      background: transparent !important;
    }
    .cesium-viewer-toolbar,
    .cesium-viewer-bottom,
    .cesium-credit-logoContainer,
    .cesium-credit-textContainer,
    .cesium-viewer-cesiumWidgetContainer .cesium-widget-credits {
      display: none !important;
    }
    #arCloseBtn {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 99999;
      width: 40px;
      height: 40px;
      border-radius: 20px;
      background: rgba(0,0,0,0.55);
      border: 1.5px solid rgba(255,255,255,0.4);
      color: #fff;
      font-size: 22px;
      line-height: 36px;
      text-align: center;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    #arCloseBtn:active { background: rgba(255,255,255,0.25); }
  </style>
</head>
<body style="background: transparent !important;">
  <div id="cesiumContainer"></div>
  <script>
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3MjNhYjIzZi0wMWU5LTQzOTEtODY3Ni1kY2JkNTEyMmE2NTgiLCJpZCI6Mzc2MDQ4LCJpYXQiOjE3Njc4MzYyNTR9.K6HpEEiCNNlC8AzsTe3zuuGtcg9AJKEAnt8mA2MIoMg';

    function sendToRN(type, payload) {
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...payload }));
        }
      } catch(e) {}
    }

    async function initARMoon() {
      try {
        var isAndroid = /android/i.test(navigator.userAgent);
        sendToRN('AR_CESIUM_LOG', { step: 'init_start', isAndroid: isAndroid });

        // --- S2 IMPORT (타임아웃 5초 — 실패해도 진행) ---
        try {
          var s2Promise = import('https://esm.sh/s2js');
          var timeoutPromise = new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error('s2js timeout')); }, 5000);
          });
          var s2Module = await Promise.race([s2Promise, timeoutPromise]);
          window.s2 = s2Module.s2;
          sendToRN('AR_CESIUM_LOG', { step: 's2js_loaded' });
        } catch(e) {
          console.warn('[AR] s2js import failed/timeout (non-critical):', e);
          window.s2 = null;
          sendToRN('AR_CESIUM_LOG', { step: 's2js_skipped', error: String(e) });
        }

        sendToRN('AR_CESIUM_LOG', { step: 'creating_viewer' });
        var moonEllipsoid = Cesium.Ellipsoid.MOON;

        var viewer = new Cesium.Viewer('cesiumContainer', {
          globe: new Cesium.Globe(moonEllipsoid),
          baseLayer: false,
          skyBox: false,
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
            webgl: {
              alpha: !isAndroid,
              antialias: !isAndroid,
              premultipliedAlpha: !isAndroid,
              preserveDrawingBuffer: false,
              failIfMajorPerformanceCaveat: false
            }
          }
        });

        viewer.scene.backgroundColor = isAndroid ? Cesium.Color.BLACK : Cesium.Color.TRANSPARENT;
        viewer.scene.globe.show = false;
        viewer.scene.highDynamicRange = false;
        viewer.scene.sun = undefined;
        viewer.scene.moon = undefined;
        viewer.scene.skyBox = undefined;

        var controller = viewer.scene.screenSpaceCameraController;
        controller.enableRotate = true;
        controller.enableZoom = false;
        controller.enableTranslate = false;
        controller.enableTilt = false;
        controller.enableLook = false;
        controller.zoomEventTypes = [];

        // Android: resolutionScale 1로 제한 (메모리/GPU 절약)
        try { viewer.resolutionScale = isAndroid ? 1 : (window.devicePixelRatio || 1); } catch(e) {}

        sendToRN('AR_CESIUM_LOG', { step: 'loading_tileset' });
        var resource = await Cesium.IonResource.fromAssetId(2684829);
        sendToRN('AR_CESIUM_LOG', { step: 'tileset_resource_ready' });
        var moonTileset = await Cesium.Cesium3DTileset.fromUrl(resource);
        // ── 기기 성능 감지 (WebGL 마이크로벤치마크) ──
        var _arTier = 'high';
        try {
            var _bc2 = document.createElement('canvas');
            _bc2.width = 256; _bc2.height = 256;
            var _bgl2 = _bc2.getContext('webgl');
            if (_bgl2) {
                var _vs2 = _bgl2.createShader(_bgl2.VERTEX_SHADER);
                _bgl2.shaderSource(_vs2, 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}');
                _bgl2.compileShader(_vs2);
                var _fs2 = _bgl2.createShader(_bgl2.FRAGMENT_SHADER);
                _bgl2.shaderSource(_fs2, 'void main(){gl_FragColor=vec4(1,0,0,1);}');
                _bgl2.compileShader(_fs2);
                var _pg2 = _bgl2.createProgram();
                _bgl2.attachShader(_pg2, _vs2); _bgl2.attachShader(_pg2, _fs2);
                _bgl2.linkProgram(_pg2); _bgl2.useProgram(_pg2);
                var _buf2 = _bgl2.createBuffer();
                _bgl2.bindBuffer(_bgl2.ARRAY_BUFFER, _buf2);
                _bgl2.bufferData(_bgl2.ARRAY_BUFFER, new Float32Array([0,0.5,-0.5,-0.5,0.5,-0.5]), _bgl2.STATIC_DRAW);
                var _loc2 = _bgl2.getAttribLocation(_pg2, 'p');
                _bgl2.enableVertexAttribArray(_loc2);
                _bgl2.vertexAttribPointer(_loc2, 2, _bgl2.FLOAT, false, 0, 0);
                for (var _w2 = 0; _w2 < 10; _w2++) { _bgl2.drawArrays(_bgl2.TRIANGLES, 0, 3); }
                _bgl2.finish();
                var _t2 = performance.now();
                for (var _b2 = 0; _b2 < 500; _b2++) { _bgl2.drawArrays(_bgl2.TRIANGLES, 0, 3); }
                _bgl2.finish();
                var _e2 = performance.now() - _t2;
                if (_e2 > 50) _arTier = 'low';
                else if (_e2 > 20) _arTier = 'mid';
                _bgl2.getExtension('WEBGL_lose_context')?.loseContext();
            }
        } catch(e) {}
        if (_arTier === 'low') {
            moonTileset.maximumScreenSpaceError = 96;
            moonTileset.maximumMemoryUsage = 48;
            moonTileset.skipLevelOfDetail = true;
            moonTileset.skipLevels = 4;
            moonTileset.loadSiblings = false;
        } else if (_arTier === 'mid') {
            moonTileset.maximumScreenSpaceError = 48;
            moonTileset.maximumMemoryUsage = 96;
            moonTileset.skipLevelOfDetail = true;
            moonTileset.skipLevels = 2;
            moonTileset.loadSiblings = false;
        } else {
            moonTileset.maximumScreenSpaceError = 24;
            moonTileset.maximumMemoryUsage = 192;
        }
        moonTileset.dynamicScreenSpaceError = true;
        moonTileset.dynamicScreenSpaceErrorDensity = 0.00278;
        moonTileset.dynamicScreenSpaceErrorFactor = 4.0;
        viewer.scene.primitives.add(moonTileset);
        sendToRN('AR_CESIUM_LOG', { step: 'tileset_added', tier: _arTier });

        // 초기 카메라: 적도 옆면에서 멀리 시작
        var bs = moonTileset.boundingSphere;
        var farDist = bs.radius * 15;
        var nearDist = bs.radius * 3;

        // 카메라를 X축 방향(적도)에 배치, Z축을 위로
        viewer.camera.setView({
          destination: new Cesium.Cartesian3(farDist, 0, 0),
          orientation: {
            direction: new Cesium.Cartesian3(-1, 0, 0),
            up: new Cesium.Cartesian3(0, 0, 1)
          }
        });

        // 줌인 함수 (RN에서 호출)
        window.startZoomIn = function() {
          viewer.camera.flyTo({
            destination: new Cesium.Cartesian3(nearDist, 0, 0),
            orientation: {
              direction: new Cesium.Cartesian3(-1, 0, 0),
              up: new Cesium.Cartesian3(0, 0, 1)
            },
            duration: 2.5,
            easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
            complete: function() {
              // IDENTITY 프레임에서 카메라를 X축 위에 배치 → 적도 측면뷰 유지
              viewer.camera.lookAtTransform(
                Cesium.Matrix4.IDENTITY,
                new Cesium.Cartesian3(nearDist, 0, 0)
              );
            }
          });
        };

        viewer.shadows = false;
        viewer.scene.light = new Cesium.DirectionalLight({
          direction: new Cesium.Cartesian3(0.5, 0.5, -1.0),
          intensity: 2.0
        });

        // ═══ 위상 음영 — CustomShader로 3D 달 표면에 직접 적용 ═══
        // positionWC(월중심 기준)를 법선으로 사용, 태양 방향과 내적 → 음영
        var moonShader = new Cesium.CustomShader({
          uniforms: {
            u_sunDirection: {
              type: Cesium.UniformType.VEC3,
              value: new Cesium.Cartesian3(1.0, 0.0, 0.0)
            }
          },
          fragmentShaderText: [
            'void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {',
            '  vec3 surfNormal = normalize(fsInput.attributes.positionWC);',
            '  float NdotL = dot(surfNormal, normalize(u_sunDirection));',
            '  float lit = smoothstep(-0.03, 0.12, NdotL);',
            '  material.diffuse *= mix(0.05, 1.0, lit);',
            '}'
          ].join('\\n')
        });
        moonTileset.customShader = moonShader;

        // phase: 0=새달 0.25=상현 0.5=보름 0.75=하현
        window.setMoonPhase = function(phase) {
          var angle = phase * 2.0 * Math.PI;
          // 태양 방향: phase 0.5(보름)→+X(정면), phase 0(새달)→−X(뒤쪽)
          var x = -Math.cos(angle);
          var y = Math.sin(angle);
          moonShader.setUniform('u_sunDirection', new Cesium.Cartesian3(x, y, 0.0));
        };

        var fillPrimitives = new Cesium.PrimitiveCollection();
        viewer.scene.primitives.add(fillPrimitives);
        var territoryVisible = false;

        sendToRN('AR_CESIUM_READY', { success: true });

        // S2 셀 꼭짓점 → Cesium 좌표
        function s2VertexToCartesian(vertex) {
          var r = Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y + vertex.z * vertex.z);
          var sinLat = Math.max(-1, Math.min(1, vertex.z / r));
          return Cesium.Cartesian3.fromRadians(
            Math.atan2(vertex.y, vertex.x),
            Math.asin(sinLat),
            0, moonEllipsoid
          );
        }

        // 점유 셀 색칠 (ClassificationPrimitive → 3D Tileset 표면 밀착)
        function fillCell(cellId, color) {
          var cell = s2.Cell.fromCellID(cellId);
          var positions = [];
          for (var vi = 0; vi < 4; vi++) {
            positions.push(s2VertexToCartesian(cell.vertex(vi)));
          }
          fillPrimitives.add(new Cesium.ClassificationPrimitive({
            geometryInstances: new Cesium.GeometryInstance({
              geometry: new Cesium.PolygonGeometry({
                polygonHierarchy: new Cesium.PolygonHierarchy(positions),
                ellipsoid: moonEllipsoid,
                height: -15000,
                extrudedHeight: 15000,
              }),
              attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
              }
            }),
            appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
            classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
            asynchronous: true
          }));
        }

        // 점유 구역 표시 — 실제 소유 영역에 글로우 마커
        function showTerritories(cellTokens, regions) {
          // regions가 있으면 영역별 마커 표시
          if (regions && regions.length > 0) {
            regions.forEach(function(region) {
              var lat = region.lat * Math.PI / 180;
              var lng = region.lng * Math.PI / 180;
              var pos = Cesium.Cartesian3.fromRadians(lng, lat, 0, moonEllipsoid);
              
              // 글로우 원형 (영역 크기 = 셀 수에 비례, 최소 0.5도 ~ 최대 3도)
              var radiusDeg = Math.max(0.5, Math.min(3, Math.sqrt(region.count) * 0.15));
              var halfR = radiusDeg;
              var latDeg = region.lat;
              var lngDeg = region.lng;
              
              // 글로우 원형 채우기 (극 좌표 클램핑)
              var gS = Math.max(-90, latDeg - halfR);
              var gN = Math.min(90, latDeg + halfR);
              var gW = Math.max(-180, lngDeg - halfR);
              var gE = Math.min(180, lngDeg + halfR);
              var glowRect = Cesium.Rectangle.fromDegrees(gW, gS, gE, gN);
              var glowGeom = new Cesium.RectangleGeometry({
                rectangle: glowRect,
                ellipsoid: moonEllipsoid,
                height: 500
              });
              fillPrimitives.add(new Cesium.Primitive({
                geometryInstances: new Cesium.GeometryInstance({ geometry: glowGeom }),
                appearance: new Cesium.MaterialAppearance({
                  material: new Cesium.Material({
                    fabric: {
                      type: 'Color',
                      uniforms: { color: new Cesium.Color(0.23, 0.51, 0.97, 0.35) }
                    }
                  }),
                  renderState: {
                    depthTest: { enabled: true },
                    blending: Cesium.BlendingState.ALPHA_BLEND
                  }
                }),
                show: true
              }));
              
              // 외곽 링 (극 좌표 클램핑)
              var rS = Math.max(-90, latDeg - halfR * 1.1);
              var rN = Math.min(90, latDeg + halfR * 1.1);
              var rW = Math.max(-180, lngDeg - halfR * 1.1);
              var rE = Math.min(180, lngDeg + halfR * 1.1);
              var ringRect = Cesium.Rectangle.fromDegrees(rW, rS, rE, rN);
              var ringGeom = new Cesium.RectangleOutlineGeometry({
                rectangle: ringRect,
                ellipsoid: moonEllipsoid,
                height: 600
              });
              fillPrimitives.add(new Cesium.Primitive({
                geometryInstances: new Cesium.GeometryInstance({
                  geometry: ringGeom,
                  attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                      new Cesium.Color(0.23, 0.51, 0.97, 0.8)
                    )
                  }
                }),
                appearance: new Cesium.PerInstanceColorAppearance({
                  flat: true, translucent: true
                }),
                show: true
              }));
              
              // 셀 수 라벨 (반투명 라운딩 박스 + 흰 점)
              fillPrimitives._entities = fillPrimitives._entities || [];
              
              // Canvas로 라운딩 배경 라벨 생성
              var lblCanvas = document.createElement('canvas');
              var lblText = region.count + ' Mag';
              var lblCtx = lblCanvas.getContext('2d');
              lblCtx.font = 'bold 22px sans-serif';
              var txtW = lblCtx.measureText(lblText).width;
              var padX = 20, padY = 12;
              var cW = txtW + padX * 2;
              var cH = 34 + padY * 2;
              lblCanvas.width = cW;
              lblCanvas.height = cH;
              
              lblCtx.clearRect(0, 0, cW, cH);
              // 반투명 라운딩 배경
              var rr = 14;
              lblCtx.beginPath();
              lblCtx.moveTo(rr, 0);
              lblCtx.lineTo(cW - rr, 0);
              lblCtx.quadraticCurveTo(cW, 0, cW, rr);
              lblCtx.lineTo(cW, cH - rr);
              lblCtx.quadraticCurveTo(cW, cH, cW - rr, cH);
              lblCtx.lineTo(rr, cH);
              lblCtx.quadraticCurveTo(0, cH, 0, cH - rr);
              lblCtx.lineTo(0, rr);
              lblCtx.quadraticCurveTo(0, 0, rr, 0);
              lblCtx.closePath();
              lblCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
              lblCtx.fill();
              // 테두리
              lblCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
              lblCtx.lineWidth = 1;
              lblCtx.stroke();
              // 텍스트
              lblCtx.font = 'bold 22px sans-serif';
              lblCtx.fillStyle = '#FFFFFF';
              lblCtx.textAlign = 'center';
              lblCtx.textBaseline = 'middle';
              lblCtx.fillText(lblText, cW / 2, cH / 2);
              
              var lblImg = lblCanvas.toDataURL();
              var label = viewer.entities.add({
                position: Cesium.Cartesian3.fromRadians(lng, lat, 3000, moonEllipsoid),
                billboard: {
                  image: lblImg,
                  scale: 0.5,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                  pixelOffset: new Cesium.Cartesian2(0, -10),
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                  scaleByDistance: new Cesium.NearFarScalar(5000, 1.0, 200000, 0.4),
                },
                point: {
                  pixelSize: 6,
                  color: Cesium.Color.WHITE,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
              });
              fillPrimitives._entities.push(label);
            });
          }
          
          territoryVisible = true;
        }

        function hideTerritories() {
          fillPrimitives.removeAll();
          // 라벨 엔티티도 제거
          if (fillPrimitives._entities) {
            fillPrimitives._entities.forEach(function(e) {
              viewer.entities.remove(e);
            });
            fillPrimitives._entities = [];
          }
          territoryVisible = false;
        }

        function handleMessage(event) {
          try {
            var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.type === 'TOGGLE_TERRITORIES') {
              if (territoryVisible) {
                hideTerritories();
                sendToRN('TERRITORY_TOGGLED', { visible: false });
              } else {
                showTerritories(data.cellTokens || [], data.regions || []);
                sendToRN('TERRITORY_TOGGLED', { visible: true });
              }
            }
          } catch(e) {}
        }
        document.addEventListener('message', handleMessage);
        window.addEventListener('message', handleMessage);

      } catch(err) {
        sendToRN('AR_CESIUM_ERROR', { error: String(err) });
      }
    }

    initARMoon();
  <\/script>
</body>
</html>`;
}
