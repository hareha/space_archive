/**
 * jumpToCellStore.ts
 * 구역 상세 → 지도에서 보기: 글로벌 상태로 점프 정보 전달
 * (params로 전달하면 탭 컴포넌트가 리마운트되어 스플래시가 다시 뜸)
 */

type JumpRequest = {
  token: string;
  level: number;
  lat: number;
  lng: number;
} | null;

let _pendingJump: JumpRequest = null;
const _listeners: Array<(req: JumpRequest) => void> = [];

export function requestJumpToCell(req: JumpRequest) {
  _pendingJump = req;
  _listeners.forEach(fn => fn(req));
}

export function consumeJumpRequest(): JumpRequest {
  const req = _pendingJump;
  _pendingJump = null;
  return req;
}

export function onJumpRequest(listener: (req: JumpRequest) => void) {
  _listeners.push(listener);
  return () => {
    const idx = _listeners.indexOf(listener);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}
