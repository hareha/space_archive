// cesiumStyles.js — CSS 스타일 모듈
// CesiumHtml의 모든 CSS 스타일을 관리합니다.

export const CESIUM_STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto:wght@300;400;500&display=swap');
    
    html, body, #cesiumContainer {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #000;
      font-family: 'Roboto', sans-serif;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
    }

    /* Loading Overlay — 검정 화면에서 부드럽게 페이드 아웃 */
    #loadingOverlay {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: #000;
        z-index: 9999;
        opacity: 1;
        transition: opacity 0.8s ease-out;
        pointer-events: none;
    }
    #loadingOverlay.fade-out {
        opacity: 0;
    }
    #errorDisplay {
        color: red; font-size: 14px; margin-top: 20px; white-space: pre-wrap; font-family: monospace; text-align: center; padding: 20px; display: none;
        max-width: 90%; overflow-x: auto; background: rgba(50,0,0,0.8); border: 1px solid red;
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    }

    /* Controls hidden - handled by React Native */
    #controls, #cellInfo { display: none; }

    /* dat.gui */
    .dg.ac { position: fixed !important; top: 60px !important; left: 10px !important; right: auto !important; z-index: 1000 !important; }
    .dg .cr { height: 32px !important; }

    /* Debug Panel */
    #debugPanel {
        position: absolute;
        bottom: 20px;
        left: 10px;
        background: rgba(0, 0, 0, 0.75);
        color: #0f0;
        font-family: 'Roboto Mono', monospace;
        font-size: 11px;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid rgba(0, 255, 0, 0.3);
        z-index: 999;
        pointer-events: none;
        line-height: 1.5;
        min-width: 180px;
    }
`;
