/**
 * AIZoneRecommendModal.tsx
 * 5단계 설문 → 분석 프로그레스 → 상위 3개 결과 모달
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  Animated, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { recommendZones, type AIAnswers, type RecommendResult } from '@/constants/aiZoneRecommender';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectZone: (lat: number, lng: number, name: string) => void;
}

// ─── 5개 질문 정의 ───
const QUESTIONS = [
  {
    id: 'side',
    num: 'Q 1 / 5',
    title: '달의 어느 쪽으로\n가볼까요?',
    options: [
      { key: 'near', label: '지구와 통신하기 좋은 \'달의 앞면\'', sub: 'Earth 방향, 안정적인 통신 환경\n기존 탐사 데이터 풍부' },
      { key: 'far', label: '전파 간섭이 없는 미지의 \'달의 뒷면\'', sub: '전파 음영 지역, 독립적 연구 환경\n완벽한 전파 정적 보장' },
    ],
  },
  {
    id: 'resources',
    num: 'Q 2 / 5',
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
    num: 'Q 3 / 5',
    title: '어떤 온도의 환경을\n대비할까요?',
    options: [
      { key: 'normal', label: '낮과 밤의 온도 차가 극심한 일반 표면', sub: '+120°C ~ -170°C, 일반 달 표면 환경' },
      { key: 'shadow', label: '얼음이 보존된 영구 음영 지역', sub: '영하 200°C 이하, 크레이터 내부 영역' },
      { key: 'polar_peak', label: '1년 내내 태양광 발전 가능한 극지방 산봉우리', sub: '안정적 온도, 지속 발전 최적 환경' },
    ],
  },
  {
    id: 'history',
    num: 'Q 4 / 5',
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
    num: 'Q 5 / 5  마지막!',
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
  const [step, setStep] = useState(0); // 0~4 = 설문, 5 = 분석중, 6 = 결과
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [results, setResults] = useState<RecommendResult[]>([]);
  const [analysisProg, setAnalysisProg] = useState(0);
  const [analysisCheckIdx, setAnalysisCheckIdx] = useState(-1);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // 리셋
  useEffect(() => {
    if (visible) {
      setStep(0); setAnswers({}); setResults([]);
      setAnalysisProg(0); setAnalysisCheckIdx(-1);
      progressAnim.setValue(0);
    }
  }, [visible]);

  // ── 설문 답변 처리 ──
  const handleOption = (key: string) => {
    const q = QUESTIONS[step];
    const newAnswers = { ...answers, [q.id]: key };
    setAnswers(newAnswers);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      startAnalysis(newAnswers);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else onClose();
  };

  // ── 분석 시작 ──
  const startAnalysis = async (finalAnswers: Record<string, any>) => {
    setStep(5); // 분석 중
    setAnalysisProg(0);
    setAnalysisCheckIdx(-1);

    // 프로그레스 애니메이션 시작
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 4000,
      useNativeDriver: false,
    }).start();

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
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        {step <= 4 && renderQuestion()}
        {step === 5 && renderAnalysis()}
        {step === 6 && renderResults()}
      </SafeAreaView>
    </Modal>
  );

  // ─── 설문 화면 ───
  function renderQuestion() {
    const q = QUESTIONS[step];

    return (
      <View style={s.questionContainer}>
        <View>
          {/* 헤더 */}
          <TouchableOpacity onPress={handleBack} style={s.backBtn}>
            <Text style={s.backText}>← 뒤로</Text>
          </TouchableOpacity>

          {/* 프로그레스 바 */}
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${((step + 1) / QUESTIONS.length) * 100}%` }]} />
          </View>

          {/* 질문 */}
          <Text style={s.questionNum}>{q.num}</Text>
          <Text style={s.questionTitle}>{q.title}</Text>

          {/* 옵션들 */}
          <ScrollView style={{ marginTop: 24 }} showsVerticalScrollIndicator={false}>
            {q.options.map((opt: any) => {
              const selected = answers[q.id] === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.optionCard, selected && s.optionCardSelected]}
                  onPress={() => handleOption(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.optionLabel, selected && s.optionLabelSelected]}>{opt.label}</Text>
                  <Text style={s.optionSub}>{opt.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ height: 48 }} />
      </View>
    );
  }

  // ─── 분석 중 화면 ───
  function renderAnalysis() {
    const progWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <View style={s.analysisContainer}>
        <Ionicons name="planet" size={60} color="#3B82F6" style={{ marginBottom: 24, opacity: 0.8 }} />
        <Text style={s.analysisTitle}>
          AI가 최적 구역을 분석하고 있어요
        </Text>
        <Text style={s.analysisSub}>
          5가지 조건을 달 지도와 매칭 중...
        </Text>

        {/* 체크리스트 */}
        <View style={s.checkList}>
          {ANALYSIS_STEPS.map((label, i) => (
            <View key={i} style={s.checkItem}>
              {i <= analysisCheckIdx
                ? <Ionicons name="checkmark-circle" size={18} color="#34D399" />
                : <View style={s.checkDot} />
              }
              <Text style={[s.checkText, i <= analysisCheckIdx && s.checkTextDone]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* 프로그레스 */}
        <View style={s.bigProgressBar}>
          <Animated.View style={[s.bigProgressFill, { width: progWidth }]} />
        </View>
        <Text style={s.progPercent}>{analysisProg}%</Text>
      </View>
    );
  }

  // ─── 결과 화면 ───
  function renderResults() {
    return (
      <View style={s.resultContainer}>
        {/* 헤더 */}
        <View style={s.resultHeader}>
          <Text style={s.resultMainTitle}>AI 추천 결과</Text>
          <Text style={s.resultSub}>자원 채굴 · 중위 투자 · 미래 가치</Text>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {results.map((r, i) => (
            <View key={i} style={s.resultCard}>
              {/* 카드 헤더 */}
              <View style={s.cardHeader}>
                <Text style={s.rankText}>{r.rank}위</Text>
                <Text style={s.matchText}>{r.matchPercent}% 매칭</Text>
              </View>

              {/* 지형 정보 */}
              <View style={s.cardMeta}>
                <Text style={s.metaItem}>{Math.abs(r.feature.lat).toFixed(0)} mag</Text>
                <Text style={s.metaItem}>{r.tempC}°C</Text>
                <Text style={s.metaItem}>{r.terrainLabel}</Text>
              </View>

              <Text style={s.featureName}>{r.feature.name_kr}</Text>

              {/* 추천 사유 */}
              {r.reasons.slice(0, 4).map((reason, ri) => (
                <Text key={ri} style={s.reasonText}>• {reason}</Text>
              ))}

              {/* 상세보기 버튼 */}
              <TouchableOpacity
                style={s.detailBtn}
                onPress={() => {
                  onSelectZone(r.feature.lat, r.feature.lng, r.feature.name_kr);
                  onClose();
                }}
              >
                <Text style={s.detailBtnText}>상세 보기 →</Text>
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

        {/* 하단 버튼 */}
        <View style={s.resultFooter}>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setStep(0); setAnswers({}); }}>
            <Text style={s.retryText}>다시하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── 스타일 ───
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },

  // 설문
  questionContainer: { flex: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 30, justifyContent: 'space-between' },
  backBtn: { alignSelf: 'flex-start', padding: 8, marginLeft: -8, marginBottom: 16 },
  backText: { color: '#9CA3AF', fontSize: 16, fontWeight: '500' },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 28 },
  progressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
  questionNum: { color: '#6B7280', fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5 },
  questionTitle: { color: '#F9FAFB', fontSize: 24, fontWeight: '800', lineHeight: 34 },
  optionCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 20,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  optionCardSelected: { borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.12)' },
  optionLabel: { color: '#E5E7EB', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  optionLabelSelected: { color: '#93C5FD' },
  optionSub: { color: '#6B7280', fontSize: 12, lineHeight: 18 },
  nextBtn: {
    backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 12,
  },
  nextBtnDisabled: { backgroundColor: '#1F2937', opacity: 0.5 },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // 분석
  analysisContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 36 },
  analysisTitle: { color: '#F9FAFB', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  analysisSub: { color: '#6B7280', fontSize: 14, textAlign: 'center', marginBottom: 32 },
  checkList: { alignSelf: 'stretch', marginBottom: 32, gap: 14 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#374151' },
  checkText: { color: '#4B5563', fontSize: 14 },
  checkTextDone: { color: '#D1D5DB' },
  bigProgressBar: { alignSelf: 'stretch', height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3 },
  bigProgressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 },
  progPercent: { color: '#6B7280', fontSize: 14, marginTop: 10, fontWeight: '600' },

  // 결과
  resultContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  resultHeader: { marginBottom: 20 },
  resultMainTitle: { color: '#F9FAFB', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  resultSub: { color: '#6B7280', fontSize: 13 },
  resultCard: {
    backgroundColor: '#1F2937', borderRadius: 16, padding: 20,
    marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rankText: { color: '#93C5FD', fontSize: 15, fontWeight: '800' },
  matchText: { color: '#34D399', fontSize: 16, fontWeight: '800' },
  cardMeta: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaItem: { color: '#9CA3AF', fontSize: 12, fontWeight: '500' },
  featureName: { color: '#F3F4F6', fontSize: 17, fontWeight: '700', marginBottom: 10 },
  reasonText: { color: '#9CA3AF', fontSize: 12, lineHeight: 20, marginLeft: 4 },
  detailBtn: { marginTop: 14, alignSelf: 'flex-end' },
  detailBtnText: { color: '#60A5FA', fontSize: 13, fontWeight: '600' },
  resultFooter: { flexDirection: 'row', gap: 12, paddingVertical: 16 },
  retryBtn: {
    flex: 1, backgroundColor: '#374151', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  retryText: { color: '#D1D5DB', fontSize: 15, fontWeight: '700' },
  closeBtn: {
    flex: 1, backgroundColor: '#1F2937', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  closeBtnText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
});
