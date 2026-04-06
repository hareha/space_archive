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

    /* 점유 셀 정보 팝업 */
    #occInfoPopup {
        position: absolute;
        display: none;
        z-index: 800;
        pointer-events: none;
        transform: translate(-50%, -100%);
        animation: occPopIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        filter: drop-shadow(0 6px 20px rgba(0,0,0,0.5));
    }
    @keyframes occPopIn {
        0% { opacity: 0; transform: translate(-50%, -85%) scale(0.8); }
        100% { opacity: 1; transform: translate(-50%, -100%) scale(1); }
    }
    #occInfoPopup .occ-card {
        background: rgba(18, 20, 30, 0.88);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(114, 149, 254, 0.2);
        border-radius: 14px;
        padding: 12px 16px;
        min-width: 150px;
        max-width: 210px;
    }
    #occInfoPopup .occ-arrow {
        width: 0; height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid rgba(18, 20, 30, 0.88);
        margin: 0 auto;
    }
    #occInfoPopup .occ-status {
        font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
        padding-bottom: 7px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex;
        align-items: center;
        gap: 6px;
    }
    #occInfoPopup .occ-status::before {
        content: '';
        width: 6px; height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
    }
    #occInfoPopup .occ-status.mine { color: #6ff59a; }
    #occInfoPopup .occ-status.mine::before { background: #6ff59a; box-shadow: 0 0 6px rgba(111, 245, 154, 0.6); }
    #occInfoPopup .occ-status.other { color: #ff7b7b; }
    #occInfoPopup .occ-status.other::before { background: #ff7b7b; box-shadow: 0 0 6px rgba(255, 123, 123, 0.6); }
    #occInfoPopup .occ-info-section {
        margin-bottom: 2px;
    }
    #occInfoPopup .occ-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;
    }
    #occInfoPopup .occ-label {
        font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif;
        font-size: 9px;
        color: rgba(255,255,255,0.35);
        letter-spacing: 0.3px;
    }
    #occInfoPopup .occ-value {
        font-family: 'SF Mono', 'Roboto Mono', monospace;
        font-size: 11px;
        color: rgba(255,255,255,0.85);
        letter-spacing: 0.2px;
        word-break: break-all;
    }
    #occInfoPopup .occ-owner-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255,255,255,0.08);
    }
    #occInfoPopup .occ-avatar {
        width: 22px; height: 22px;
        border-radius: 50%;
        flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; font-weight: 700; color: #fff;
    }
    #occInfoPopup .occ-nickname {
        font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif;
        font-size: 12px;
        font-weight: 600;
        color: rgba(255,255,255,0.9);
    }
`;
