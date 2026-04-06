/**
 * Supabase 클라이언트 설정
 */
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://buglkkowaddezcxoprdm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Z2xra293YWRkZXpjeG9wcmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMzYwMjksImV4cCI6MjA5MDYxMjAyOX0.X5J8AG4FSPBF3hol5OWLlDjIEKJrNu826-fRDKte-ek';

// AsyncStorage를 빌드 시점이 아닌 런타임에서만 로드
let storage: any = undefined;
try {
  if (typeof window !== 'undefined') {
    storage = require('@react-native-async-storage/async-storage').default;
  }
} catch (e) {}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storage,
    autoRefreshToken: true,
    persistSession: typeof window !== 'undefined',
    detectSessionInUrl: false,
  },
});
