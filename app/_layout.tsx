import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { Text, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColorScheme } from '@/components/useColorScheme';
import OnboardingScreen from '@/components/OnboardingScreen';
import OnboardingScreenB from '@/components/OnboardingScreenB';
import { OnboardingProvider, useOnboarding } from '@/components/OnboardingContext';
import { AuthProvider } from '@/components/AuthContext';
import { EllProvider } from '@/components/EllContext';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';

// iOS 시스템 글자 크기에 무관하게 앱 내 폰트 크기 고정
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.allowFontScaling = false;
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.allowFontScaling = false;

// 커스텀 ErrorBoundary로 교체 — 빨간 에러 화면 대신 깔끔한 안내 화면 표시
export { default as ErrorBoundary } from '@/components/GlobalErrorBoundary';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GlobalErrorBoundary>
      <OnboardingProvider>
        <AuthProvider>
          <EllProvider>
            <RootLayoutNav />
          </EllProvider>
        </AuthProvider>
      </OnboardingProvider>
    </GlobalErrorBoundary>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { showOnboarding, setShowOnboarding, showOnboardingB, setShowOnboardingB } = useOnboarding();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
        if (!hasSeenOnboarding) {
          setShowOnboarding(true);
        }
      } catch (e) {
        // 무시
      }
      setChecked(true);
    };
    checkOnboarding();
  }, []);

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    } catch (e) {
      // 저장 실패해도 진행
    }
    setShowOnboarding(false);
  };

  // B안 온보딩 다시보기
  if (showOnboardingB) {
    return <OnboardingScreenB onComplete={() => setShowOnboardingB(false)} />;
  }

  // 온보딩 표시 (첫 실행 or 다시보기 모두 동일)
  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  // 아직 확인 중이면 아무것도 표시하지 않음 (스플래시가 가려줌)
  if (!checked) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: '#FFFFFF' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="news" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
