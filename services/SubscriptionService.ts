/**
 * 구독(이용권) 서비스
 * 
 * Supabase subscriptions 테이블 연동
 * 인앱결제(IAP)는 EAS 빌드 시 별도 추가
 */
import { supabase } from './supabase';
import { Alert } from 'react-native';

// ── 플랜 메타 ──
export const PLAN_META: Record<string, {
    name: string;
    durationDays: number;
    ellAmount: number;
    aiLimit: number;
    productId: string;
}> = {
    basic: {
        name: 'Basic 1개월 탐사권',
        durationDays: 30,
        ellAmount: 500,
        aiLimit: 5,
        productId: 'com.plusultra.basic_1month',
    },
    pro: {
        name: 'PRO 12개월 탐사권',
        durationDays: 365,
        ellAmount: 6000,
        aiLimit: 999999,
        productId: 'com.plusultra.pro_12month',
    },
};

export interface ActiveSubscription {
    id: number;
    plan_id: string;
    start_date: string;
    end_date: string;
    ai_usage_count: number;
    status: string;
}

const SubscriptionService = {
    async init(): Promise<void> {
        // IAP 초기화는 EAS 빌드에서 추가
    },

    async cleanup(): Promise<void> {
        // IAP 정리
    },

    /** 구독 활성화 (DB 처리 + ell 지급) */
    async activateSubscription(
        userId: string,
        planId: string,
    ): Promise<ActiveSubscription | null> {
        const meta = PLAN_META[planId];
        if (!meta) return null;

        try {
            const { data, error } = await supabase.rpc('activate_subscription', {
                p_user_id: userId,
                p_plan_id: planId,
                p_duration_days: meta.durationDays,
                p_ell_amount: meta.ellAmount,
                p_ai_limit: meta.aiLimit,
            });

            if (error) {
                console.error('[SubscriptionService] activate error:', error.message);
                return null;
            }

            // activity_logs에 이용권 구매 기록
            try {
                await supabase.from('activity_logs').insert({
                    user_id: userId,
                    type: 'subscription',
                    description: `${meta.name} 구매`,
                    ell_amount: meta.ellAmount,
                    mag_count: 0,
                    metadata: { plan_id: planId, duration_days: meta.durationDays },
                });
            } catch (logErr) {
                console.warn('[SubscriptionService] activity_logs insert skipped:', logErr);
            }

            return data as ActiveSubscription;
        } catch (e) {
            console.error('[SubscriptionService] activateSubscription error:', e);
            return null;
        }
    },

    /** 현재 활성 구독 조회 */
    async getActiveSubscription(userId: string): Promise<ActiveSubscription | null> {
        try {
            const { data, error } = await supabase.rpc('get_active_subscription', {
                p_user_id: userId,
            });

            if (error) {
                console.error('[SubscriptionService] getActive error:', error.message);
                return null;
            }

            return data as ActiveSubscription | null;
        } catch (e) {
            console.error('[SubscriptionService] getActiveSubscription error:', e);
            return null;
        }
    },

    /** AI 추천 사용 횟수 증가 */
    async incrementAiUsage(userId: string): Promise<boolean> {
        try {
            const sub = await this.getActiveSubscription(userId);
            if (!sub) return false;

            const meta = PLAN_META[sub.plan_id];
            if (meta && sub.ai_usage_count >= meta.aiLimit) {
                return false;
            }

            const { error } = await supabase
                .from('subscriptions')
                .update({
                    ai_usage_count: sub.ai_usage_count + 1,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', sub.id);

            return !error;
        } catch (e) {
            console.error('[SubscriptionService] incrementAiUsage error:', e);
            return false;
        }
    },

    /** 남은 AI 추천 횟수 */
    async getRemainingAiCount(userId: string): Promise<number> {
        const sub = await this.getActiveSubscription(userId);
        if (!sub) return 0;

        const meta = PLAN_META[sub.plan_id];
        if (!meta) return 0;

        if (meta.aiLimit >= 999999) return -1;
        return Math.max(0, meta.aiLimit - sub.ai_usage_count);
    },

    /** 구독 유효 여부 */
    async isSubscriptionActive(userId: string): Promise<boolean> {
        const sub = await this.getActiveSubscription(userId);
        return !!sub;
    },
};

export default SubscriptionService;
