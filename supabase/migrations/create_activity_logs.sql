-- activity_logs 테이블: ELL 소모/획득 활동 기록
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'mag_claim',       -- mag_claim, subscription, ai_recommend, etc.
    description TEXT,
    ell_amount INTEGER NOT NULL DEFAULT 0,        -- 양수: 획득, 음수: 소모
    mag_count INTEGER NOT NULL DEFAULT 0,         -- MAG 수량
    metadata JSONB DEFAULT '{}',                  -- 추가 정보 (cell_id, plan_id 등)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- RLS 활성화
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 정책: 본인 기록만 읽기
CREATE POLICY "Users can view own activity logs"
    ON activity_logs FOR SELECT
    USING (auth.uid() = user_id);

-- 정책: 본인 기록 삽입
CREATE POLICY "Users can insert own activity logs"
    ON activity_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);
