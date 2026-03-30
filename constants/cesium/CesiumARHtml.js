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
  <script type="module">
    import { s2 } from 'https://esm.sh/s2js';
    window.s2 = s2;

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
              alpha: true,
              antialias: true,
              premultipliedAlpha: true,
              preserveDrawingBuffer: false
            }
          }
        });

        viewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;
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

        try { viewer.resolutionScale = window.devicePixelRatio || 1; } catch(e) {}

        var resource = await Cesium.IonResource.fromAssetId(2684829);
        var moonTileset = await Cesium.Cesium3DTileset.fromUrl(resource);
        viewer.scene.primitives.add(moonTileset);

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
          return Cesium.Cartesian3.fromRadians(
            Math.atan2(vertex.y, vertex.x),
            Math.asin(vertex.z / r),
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
              
              // 글로우 원형 채우기
              var glowRect = Cesium.Rectangle.fromDegrees(
                lngDeg - halfR, latDeg - halfR, lngDeg + halfR, latDeg + halfR
              );
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
              
              // 외곽 링
              var ringRect = Cesium.Rectangle.fromDegrees(
                lngDeg - halfR * 1.1, latDeg - halfR * 1.1, lngDeg + halfR * 1.1, latDeg + halfR * 1.1
              );
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
              
              // 셀 수 라벨
              fillPrimitives._entities = fillPrimitives._entities || [];
              var label = viewer.entities.add({
                position: Cesium.Cartesian3.fromRadians(lng, lat, 3000, moonEllipsoid),
                label: {
                  text: region.count + ' Mag',
                  font: '11px sans-serif',
                  fillColor: Cesium.Color.WHITE,
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 2,
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                  pixelOffset: new Cesium.Cartesian2(0, -6),
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                  scale: 1.0
                },
                point: {
                  pixelSize: 5,
                  color: new Cesium.Color(0.23, 0.51, 0.97, 1.0),
                  outlineWidth: 0,
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
