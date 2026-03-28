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

        // 초기 카메라: 멀리서 시작 (달이 작게 보임)
        var bs = moonTileset.boundingSphere;
        viewer.camera.flyToBoundingSphere(bs, {
          duration: 0,
          offset: new Cesium.HeadingPitchRange(0, -0.0, bs.radius * 15)
        });

        // 줌인 함수 (RN에서 호출)
        window.startZoomIn = function() {
          viewer.camera.flyToBoundingSphere(bs, {
            duration: 2.5,
            offset: new Cesium.HeadingPitchRange(0, -0.0, bs.radius * 3),
            easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
            complete: function() {
              viewer.camera.lookAt(
                bs.center,
                new Cesium.HeadingPitchRange(viewer.camera.heading, viewer.camera.pitch, bs.radius * 3)
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

        // 점유 구역 표시 (색칠만)
        function showTerritories(cellTokens) {
          var ownedLv4Set = {};
          cellTokens.forEach(function(token) {
            try {
              var cellId = s2.cellid.fromToken(token);
              var lv4Parent = s2.cellid.parent(cellId, 4);
              var lv4Token = s2.cellid.toToken(lv4Parent);
              ownedLv4Set[lv4Token] = lv4Parent;
            } catch(e) {}
          });

          var color = Cesium.Color.fromCssColorString('rgba(59, 130, 246, 0.45)');
          Object.keys(ownedLv4Set).forEach(function(token) {
            fillCell(ownedLv4Set[token], color);
          });

          territoryVisible = true;
        }

        function hideTerritories() {
          fillPrimitives.removeAll();
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
                showTerritories(data.cellTokens || []);
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
