/**
 * aiZoneRecommender.ts
 * 5개 설문 답변을 기반으로 실제 CSV 데이터를 필터링/스코어링하여
 * 상위 3개 후보 구역을 추천하는 엔진
 */
import {
  loadFeatures, loadLandingSites, loadThermal, loadHydrogen, loadGravity,
  getThermalAt, getHydrogenAt, getGravityAt, degDistance,
  type LunarFeature,
} from './lunarDataLoader';

// ─── 설문 답변 타입 ───
export interface AIAnswers {
  side: 'near' | 'far';                                          // Q1
  resources: ('building' | 'energy' | 'geology' | 'survival')[]; // Q2 복수
  temperature: 'normal' | 'shadow' | 'polar_peak';               // Q3
  history: 'explored' | 'unexplored' | 'crater_mineral' | 'geological'; // Q4
  terrain: 'mare' | 'crater' | 'mountain';                       // Q5
}

export interface RecommendResult {
  rank: number;
  feature: LunarFeature;
  matchPercent: number;     // 0~100
  tempC: number;            // 대표 온도 (°C)
  hydrogenScore: number;    // 수소 점수 (원시값)
  gravityVal: number;       // 중력 이상값
  nearestLanding: string | null;   // 가장 가까운 착륙지 이름
  nearestLandingDist: number;      // 거리 (도)
  reasons: string[];        // 추천 사유 리스트
  terrainLabel: string;     // "분지 지형", "평탄 지형" 등
}

// ─── 메인 추천 함수 ───
export async function recommendZones(answers: AIAnswers): Promise<RecommendResult[]> {
  // 1. 데이터 로딩
  const [features, sites] = await Promise.all([
    loadFeatures(),
    loadLandingSites(),
    loadThermal(),
    loadHydrogen(),
    loadGravity(),
  ]);

  // 2. 기본 필터링
  let candidates = features.filter(f => {
    // Q1: 앞면/뒷면
    if (answers.side === 'near' && f.isFarSide) return false;
    if (answers.side === 'far' && !f.isFarSide) return false;
    return true;
  });

  // Q5: 지형 타입 필터 (soft filter - 완전 제외 대신 가점/감점)
  const terrainTypes: Record<string, string[]> = {
    mare: ['Mare', 'Sinus'],
    crater: ['Crater', 'Basin'],
    mountain: ['Montes', 'Mons', 'Rupes', 'Rima', 'Vallis'],
  };
  const preferredTypes = terrainTypes[answers.terrain] || [];

  // 3. 스코어링
  const scored = candidates.map(f => {
    let score = 0;
    const reasons: string[] = [];

    // ── 지형 매칭 (15점) ──
    if (preferredTypes.includes(f.type_en)) {
      score += 15;
      reasons.push(`${f.type_kr} 지형 정확 매칭`);
    } else {
      score += 3; // 부분 점수
    }

    // ── 온도 적합성 (25점) ──
    const thermal = getThermalAt(f.lat, f.lng);
    let tempC = 0;
    if (thermal) {
      const dayC = thermal.day_max - 273.15;
      const nightC = thermal.night_min - 273.15;
      tempC = Math.round((dayC + nightC) / 2);

      if (answers.temperature === 'shadow') {
        // 영구 음영 → 극저온 선호 (night_min 낮을수록 좋음)
        if (thermal.night_min < 100) { score += 25; reasons.push('영구 음영 극저온 환경 확인'); }
        else if (thermal.night_min < 150) { score += 15; reasons.push('저온 환경 부분 매칭'); }
        else score += 5;
      } else if (answers.temperature === 'polar_peak') {
        // 극지방 산봉우리 → 안정 온도
        if (Math.abs(f.lat) > 60) { score += 25; reasons.push('극지방 위치 확인, 안정적 온도'); }
        else if (Math.abs(f.lat) > 40) { score += 15; reasons.push('중위도 안정 온도'); }
        else score += 5;
      } else {
        // 일반 표면 → 극단적이지 않은 온도
        const range = dayC - nightC;
        if (range < 200) { score += 25; reasons.push('온도 변동 안정적'); }
        else if (range < 300) { score += 15; reasons.push('온도 변동 보통'); }
        else score += 5;
      }
    }

    // ── 자원 매칭 (30점) ──
    const hydrogen = getHydrogenAt(f.lat, f.lng) || 0;
    const gravity = getGravityAt(f.lat, f.lng) || 0;
    let resourceScore = 0;

    if (answers.resources.includes('building')) {
      // 건축 자재 → 높은 중력 이상 (지하 밀도 높음 = 광물 풍부)
      if (gravity > 10) { resourceScore += 8; reasons.push('지하 광물 밀도 높음 (건축 자재)'); }
      else if (gravity > 5) { resourceScore += 4; reasons.push('건축 자재 중간 매칭'); }
    }
    if (answers.resources.includes('energy')) {
      // 에너지 → 극지방 영구 일조 봉우리 or 적도 태양광
      if (Math.abs(f.lat) > 80) { resourceScore += 8; reasons.push('극지방 영구 일조 가능'); }
      else if (Math.abs(f.lat) < 30) { resourceScore += 6; reasons.push('적도 태양광 에너지 유리'); }
      else resourceScore += 3;
    }
    if (answers.resources.includes('geology')) {
      // 지질 데이터 → 충돌구/분지 선호 + 중력 이상
      if (['Crater', 'Basin'].includes(f.type_en)) { resourceScore += 8; reasons.push('충돌 지형 — 지질 조사 핵심 구역'); }
      else resourceScore += 3;
    }
    if (answers.resources.includes('survival')) {
      // 생존 자원 → 수소(물) 풍부
      if (hydrogen > 160) { resourceScore += 8; reasons.push('높은 수소 분포 — 수자원 매장 유리'); }
      else if (hydrogen > 140) { resourceScore += 5; reasons.push('수소 분포 중간 수준'); }
      else resourceScore += 2;
    }
    // 자원 선택이 없으면 기본 점수
    if (answers.resources.length === 0) resourceScore = 15;
    else resourceScore = Math.min(30, (resourceScore / answers.resources.length) * (30 / 8));
    score += Math.round(resourceScore);

    // ── 탐사 역사 (20점) ──
    let nearestSite: string | null = null;
    let nearestDist = Infinity;
    for (const s of sites) {
      const d = degDistance(f.lat, f.lng, s.lat, s.lng);
      if (d < nearestDist) { nearestDist = d; nearestSite = s.name_kr; }
    }

    if (answers.history === 'explored') {
      if (nearestDist < 10) { score += 20; reasons.push(`${nearestSite} 착륙지 인근 — 탐사 기록 풍부`); }
      else if (nearestDist < 30) { score += 12; reasons.push('탐사 기록 존재 지역'); }
      else score += 4;
    } else if (answers.history === 'unexplored') {
      if (nearestDist > 50) { score += 20; reasons.push('미개척 처녀지 — 발견 보상 높음'); }
      else if (nearestDist > 30) { score += 14; reasons.push('탐사 기록 적은 지역'); }
      else score += 4;
    } else if (answers.history === 'crater_mineral') {
      if (['Crater', 'Basin'].includes(f.type_en) && gravity > 5) {
        score += 20; reasons.push('충돌구/분지 — 자원 집중 지대');
      } else if (['Crater', 'Basin'].includes(f.type_en)) {
        score += 12; reasons.push('충돌구 지형 확인');
      } else score += 4;
    } else if (answers.history === 'geological') {
      if (['Montes', 'Mons', 'Rupes', 'Rima', 'Vallis'].includes(f.type_en)) {
        score += 20; reasons.push('산맥/계곡/단층 — 지각 조사 핵심');
      } else score += 6;
    }

    // ── 접근성 보너스 (10점) ──
    if (!f.isFarSide) {
      score += 7; reasons.push('지구 직접 통신 가능');
    } else {
      score += 3;
    }
    if (f.area_km2 > 10000) {
      score += 3; reasons.push('넓은 구역 — 기지 건설 용이');
    }

    return {
      rank: 0,
      feature: f,
      matchPercent: Math.min(100, score),
      tempC,
      hydrogenScore: Math.round(hydrogen),
      gravityVal: Math.round(gravity * 100) / 100,
      nearestLanding: nearestSite,
      nearestLandingDist: Math.round(nearestDist * 10) / 10,
      reasons,
      terrainLabel: getTerrainLabel(f),
    };
  });

  // 4. 정렬 & 상위 3개
  scored.sort((a, b) => b.matchPercent - a.matchPercent);
  const top3 = scored.slice(0, 3);
  top3.forEach((r, i) => { r.rank = i + 1; });

  return top3;
}

function getTerrainLabel(f: LunarFeature): string {
  switch (f.type_en) {
    case 'Crater': return '충돌구 지형';
    case 'Mare': return '바다(평원) 지형';
    case 'Sinus': return '만(평원) 지형';
    case 'Basin': return '분지 지형';
    case 'Montes': return '산맥 지형';
    case 'Mons': return '단봉 지형';
    case 'Rupes': return '단층 지형';
    case 'Rima': return '열구 지형';
    case 'Vallis': return '계곡 지형';
    case 'Swirl': return '소용돌이 지형';
    default: return '일반 지형';
  }
}
