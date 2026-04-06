/**
 * AIZoneRecommendModal.tsx
 * 5단계 설문 → 분석 프로그레스 → 상위 3개 결과 모달
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  StyleSheet, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { recommendZones, type AIAnswers, type RecommendResult } from '@/constants/aiZoneRecommender';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectZone: (lat: number, lng: number, name: string, diameterKm?: number) => void;
}

// ─── 5개 질문 정의 ───
const QUESTIONS = [
  {
    id: 'side',
    title: '달의 어느 쪽으로\n가볼까요?',
    options: [
      { key: 'near', label: '지구와 통신하기 좋은 \'달의 앞면\'', sub: 'Earth 방향, 안정적인 통신 환경\n기존 탐사 데이터 풍부' },
      { key: 'far', label: '전파 간섭이 없는 미지의 \'달의 뒷면\'', sub: '전파 음영 지역, 독립적 연구 환경\n완벽한 전파 정적 보장' },
    ],
  },
  {
    id: 'resources',
    title: '가장 찾고 싶은\n자원은 무엇인가요?',
    options: [
      { key: 'building', label: '기지를 지을 건축 자재', sub: '철, 티타늄 등 견고한 구조 소재' },
      { key: 'energy', label: '강력한 특수 에너지원', sub: '우라늄, 트륨 등 핵연료 자원' },
      { key: 'geology', label: '달의 기원을 밝힐 지질 데이터', sub: '마그네슘, 규소 등 지질 분석' },
      { key: 'survival', label: '생존을 위한 필수 조건, 얼음', sub: '낮은 중성자 밀도, 물 자원' },
    ],
  },
  {
    id: 'temperature',
    title: '어떤 온도의 환경을\n대비할까요?',
    options: [
      { key: 'normal', label: '낮과 밤의 온도 차가 극심한 일반 표면', sub: '+120°C ~ -170°C, 일반 달 표면 환경' },
      { key: 'shadow', label: '얼음이 보존된 영구 음영 지역', sub: '영하 200°C 이하, 크레이터 내부 영역' },
      { key: 'polar_peak', label: '1년 내내 태양광 발전 가능한 극지방 산봉우리', sub: '안정적 온도, 지속 발전 최적 환경' },
    ],
  },
  {
    id: 'history',
    title: '탐사 지역의 역사는\n어떨으면 하나요?',
    options: [
      { key: 'explored', label: '과거 탐사선이 다녀간 기록이 있는 곳', sub: 'Apollo, Lunar 시리즈 데이터 보유\n비교 분석 자료 풍부, 안전성 검증됨' },
      { key: 'unexplored', label: '인류가 아직 밟지 않은 완벽한 미개척지', sub: '원시 상태 보존, 과학적 가치 극대화\n탐사 리스크 높음, 발견 보상 높음' },
      { key: 'crater_mineral', label: '운석 충돌로 파인 거대한 구덩이', sub: '충돌구(Crater), 분지 — 자원 집중 지대' },
      { key: 'geological', label: '역동적으로 갈라지는 지각 지형', sub: '산맥·계곡·단층 — 지질 조사 핵심 구역' },
    ],
  },
  {
    id: 'terrain',
    title: '어떤 지형 위를\n걷고 싶으신가요?',
    options: [
      { key: 'mare', label: '바다', sub: '평탄하게 굳어진 넓은 용암 대지\n바다(Mare), 만(Sinus) — 이동·건설 최적' },
      { key: 'crater', label: '충돌구', sub: '거대한 원형(380 mag) 이상\n충돌 면적 일대 투영, 자원 은닉 획득' },
      { key: 'mountain', label: '산맥', sub: '최초 인류 달 착륙 1969 · 총 탐사 기록 6차\n산맥·계곡·단층 — 지질 조사 핵심 구역' },
    ],
  },
];

// ─── 분석 체크리스트 ───
const ANALYSIS_STEPS = [
  '위치 조건 분석 완료',
  '자원 분포 데이터 매칭 완료',
  '환경·온도 필터 적용 완료',
  '역사 기록 데이터베이스 검색 완료',
  '지형 적합도 점수 계산 완료',
];

export default function AIZoneRecommendModal({ visible, onClose, onSelectZone }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0); // 0~4 = 설문, 5 = 분석중, 6 = 결과
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [results, setResults] = useState<RecommendResult[]>([]);
  const [analysisProg, setAnalysisProg] = useState(0);
  const [analysisCheckIdx, setAnalysisCheckIdx] = useState(-1);

  // 리셋
  useEffect(() => {
    if (visible) {
      setStep(0); setAnswers({}); setResults([]);
      setAnalysisProg(0); setAnalysisCheckIdx(-1);
    }
  }, [visible]);

  // ── 설문 답변 처리 ──
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleOption = (key: string) => {
    const q = QUESTIONS[step];
    const newAnswers = { ...answers, [q.id]: key };
    setAnswers(newAnswers);
    setPendingKey(key);
    // 선택 표시 후 딜레이 뒤 다음으로
    setTimeout(() => {
      setPendingKey(null);
      if (step < QUESTIONS.length - 1) {
        setStep(step + 1);
      } else {
        startAnalysis(newAnswers);
      }
    }, 120);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else onClose();
  };

  // ── 분석 시작 ──
  const startAnalysis = async (finalAnswers: Record<string, any>) => {
    setStep(5);
    setAnalysisProg(0);
    setAnalysisCheckIdx(-1);

    // 체크리스트 순차 표시
    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      await delay(700);
      setAnalysisCheckIdx(i);
      setAnalysisProg(Math.round(((i + 1) / ANALYSIS_STEPS.length) * 100));
    }

    // 실제 추천 실행
    try {
      const aiAnswers: AIAnswers = {
        side: finalAnswers.side || 'near',
        resources: [finalAnswers.resources || 'building'],
        temperature: finalAnswers.temperature || 'normal',
        history: finalAnswers.history || 'explored',
        terrain: finalAnswers.terrain || 'crater',
      };
      const res = await recommendZones(aiAnswers);
      setResults(res);
    } catch (e) {
      console.error('[AI Recommend]', e);
      setResults([]);
    }

    await delay(500);
    setStep(6); // 결과
  };

  // ── 렌더링 ──
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        {step <= 4 && renderQuestion()}
        {step === 5 && renderAnalysis()}
        {step === 6 && renderResults()}
      </View>
    </Modal>
  );

  // ─── 설문 화면 ───
  function renderQuestion() {
    const q = QUESTIONS[step];

    return (
      <View style={s.questionContainer}>
        <View>
          {/* 헤더: 뒤로 + 제목 */}
          <View style={s.headerRow}>
            <TouchableOpacity onPress={handleBack} style={s.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Investment Size</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* 스텝 인디케이터 (1~5) */}
          <View style={s.stepIndicator}>
            {[0, 1, 2, 3, 4].map((i) => {
              const isCompleted = i < step;
              const isCurrent = i === step;
              const isActive = isCompleted || isCurrent;
              return (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <View style={[s.stepLine, isActive && s.stepLineActive]} />
                  )}
                  <View style={[s.stepCircle, isActive && s.stepCircleActive]}>
                    <Text style={[s.stepNumber, isActive && s.stepNumberActive]}>{i + 1}</Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>

          {/* 질문 제목: Q번호. 제목 */}
          <Text style={s.questionTitle}>
            <Text style={s.questionBold}>Q{step + 1}.</Text>
            {' '}{q.title}
          </Text>

          {/* 옵션들 */}
          <ScrollView style={{ marginTop: 24 }} showsVerticalScrollIndicator={false}>
            {q.options.map((opt: any) => {
              const selected = pendingKey === opt.key || answers[q.id] === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.optionCard, selected && s.optionCardSelected]}
                  onPress={() => handleOption(opt.key)}
                  activeOpacity={0.7}
                  disabled={pendingKey !== null}
                >
                  <Text style={[s.optionLabel, selected && s.optionLabelSelected]}>{opt.label}</Text>
                  <Text style={[s.optionSub, selected && s.optionSubSelected]}>{opt.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ height: Math.max(48, insets.bottom + 12) }} />
      </View>
    );
  }

  // ─── 분석 중 화면 (Figma AI_5) ───
  function renderAnalysis() {
    return (
      <View style={s.analysisContainer}>
        {/* 앱 로고 */}
        <View style={s.analysisLogoWrap}>
          <Image
            source={require('@/assets/images/logo_white.png')}
            style={{ width: 51, height: 51, tintColor: '#7295FE' }}
            resizeMode="contain"
          />
          <Text style={s.analysisLogoText}>AI</Text>
        </View>

        {/* 설명 텍스트 */}
        <View style={s.analysisTextWrap}>
          <Text style={s.analysisMainText}>
            AI가 최적 구역을 분석하고 있습니다.
          </Text>
          <Text style={s.analysisSubText}>
            잠시만 기다려 주세요...
          </Text>
          <Text style={s.analysisBlueText}>
            약 25,769,803,776개 구역 데이터 분석 중.
          </Text>
        </View>

        {/* 3 dots (나중에 Lottie로 교체) */}
        <View style={s.dotsRow}>
          <View style={[s.dot, { opacity: 0.4 }]} />
          <View style={[s.dot, { opacity: 0.7 }]} />
          <View style={s.dot} />
        </View>
      </View>
    );
  }

  // ─── 결과 화면 (Figma AI result) ───
  function renderResults() {
    const RANK_LABELS = ['1위', '2위', '3위'];
    return (
      <View style={s.resultContainer}>
        {/* 헤더: X + AI 추천 결과 */}
        <View style={s.resultHeaderBar}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color="#EBECF1" />
          </TouchableOpacity>
          <Text style={s.resultHeaderTitle}>AI 추천 결과</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* 서브타이틀 */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          <Text style={s.resultSubtitle}>
            자원 채굴 · 중위 투자 · 미래 가치
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, gap: 12, paddingBottom: 40 }}>
          {results.map((r, i) => (
            <View key={i} style={s.resultCard}>
              {/* 카드 헤더: 1위 + 96% 매칭 */}
              <View style={s.cardHeaderRow}>
                <Text style={s.cardRank}>{RANK_LABELS[i] || `${i+1}위`}</Text>
                <Text style={s.cardMatch}>{r.matchPercent}% 매칭</Text>
              </View>

              {/* 메타 정보 */}
              <View style={s.cardMetaRow}>
                <Text style={s.cardMetaText}>{Math.abs(r.feature.lat).toFixed(0)} mag</Text>
                <View style={s.cardMetaDivider} />
                <Text style={s.cardMetaText}>{r.tempC}°C</Text>
                <View style={s.cardMetaDivider} />
                <Text style={s.cardMetaText}>{r.terrainLabel}</Text>
              </View>

              {/* 추천 사유 */}
              <View style={{ gap: 0 }}>
                {r.reasons.slice(0, 4).map((reason, ri) => (
                  <Text key={ri} style={s.cardReason}>{reason}</Text>
                ))}
              </View>

              {/* 상세보기 → */}
              <TouchableOpacity
                style={s.cardDetailBtn}
                onPress={() => {
                  onSelectZone(r.feature.lat, r.feature.lng, r.feature.name_kr, r.feature.diameter_km);
                  onClose();
                }}
              >
                <Text style={s.cardDetailText}>상세보기</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}

          {results.length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="alert-circle-outline" size={48} color="#4B5563" />
              <Text style={{ color: '#6B7280', fontSize: 15, marginTop: 12 }}>조건에 맞는 구역을 찾지 못했습니다</Text>
            </View>
          )}
        </ScrollView>

        {/* 하단 다시하기 버튼 */}
        <View style={[s.rematchWrap, { paddingBottom: Math.max(16, insets.bottom) }]}>
          <TouchableOpacity style={s.rematchBtn} onPress={() => { setStep(0); setAnswers({}); }}>
            <Text style={s.rematchText}>다시하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── 스타일 ───
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15171C' },

  // 설문
  questionContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30, justifyContent: 'space-between' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingVertical: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  backBtn: { padding: 4 },
  // 스텝 인디케이터
  stepIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  stepCircle: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#25272C',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#3A3D44',
  },
  stepCircleActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  stepNumber: { color: '#6B7280', fontSize: 13, fontWeight: '700' },
  stepNumberActive: { color: '#1A1B1E' },
  stepLine: { width: 18, height: 2, backgroundColor: '#3A3D44', marginHorizontal: 4, borderRadius: 1 },
  stepLineActive: { backgroundColor: '#9CA3AF' },
  questionTitle: { color: '#F9FAFB', fontSize: 18, fontWeight: '500', lineHeight: 26 },
  questionBold: { fontWeight: '800', fontSize: 18 },
  optionCard: {
    backgroundColor: '#25272C', borderRadius: 6, padding: 20,
    marginBottom: 12,
  },
  optionCardSelected: { borderColor: '#3C57E9', backgroundColor: '#3C57E9' },
  optionLabel: { color: '#E5E7EB', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  optionLabelSelected: { color: '#FFFFFF' },
  optionSub: { color: '#6B7280', fontSize: 12, lineHeight: 18 },
  optionSubSelected: { color: 'rgba(255,255,255,0.7)' },
  nextBtn: {
    backgroundColor: '#3C57E9', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 12,
  },
  nextBtnDisabled: { backgroundColor: '#1F2937', opacity: 0.5 },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // 분석 (Figma AI_5)
  analysisContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  analysisLogoWrap: { alignItems: 'center', gap: 4, paddingTop: 48 },
  analysisLogoText: { color: '#EBECF1', fontSize: 20, fontWeight: '500' },
  analysisTextWrap: { alignItems: 'center', gap: 3, paddingTop: 23, paddingHorizontal: 16 },
  analysisMainText: { color: '#EBECF1', fontSize: 16, fontWeight: '400', lineHeight: 24, textAlign: 'center' },
  analysisSubText: { color: '#808080', fontSize: 14, fontWeight: '400', lineHeight: 21, textAlign: 'center' },
  analysisBlueText: { color: '#7295FE', fontSize: 14, fontWeight: '400', lineHeight: 21, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 6, paddingTop: 19 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EBECF1' },

  // 결과 (Figma AI result)
  resultContainer: { flex: 1 },
  resultHeaderBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
  },
  resultHeaderTitle: { color: '#EBECF1', fontSize: 18, fontWeight: '600' },
  resultSubtitle: { color: '#EBECF1', fontSize: 18, fontWeight: '600' },
  resultCard: {
    borderWidth: 1, borderColor: '#333333', borderRadius: 6,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24, gap: 8,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 10 },
  cardRank: { color: '#EBECF1', fontSize: 20, fontWeight: '500' },
  cardMatch: { color: '#999999', fontSize: 14, fontWeight: '500' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardMetaText: { color: '#808080', fontSize: 14, fontWeight: '400' },
  cardMetaDivider: { width: 1, height: 14, backgroundColor: '#333333' },
  cardReason: { color: '#EBECF1', fontSize: 14, fontWeight: '400', lineHeight: 21 },
  cardDetailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 9, paddingTop: 2, paddingLeft: 24, paddingVertical: 6,
    alignSelf: 'flex-end',
  },
  cardDetailText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500', textAlign: 'center' },
  rematchWrap: { paddingHorizontal: 16, paddingTop: 16 },
  rematchBtn: {
    backgroundColor: '#3C57E9', borderRadius: 5, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  rematchText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
