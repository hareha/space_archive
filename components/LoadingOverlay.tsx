import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface LoadingOverlayProps {
  visible: boolean;
  /** 로고 크기 (기본 48) */
  logoSize?: number;
  /** 배경 투명도 (기본 0.85) */
  dimOpacity?: number;
}

function LogoSvg({ size }: { size: number }) {
  const h = size * (74 / 51);
  return (
    <Svg width={size} height={h} viewBox="0 0 51 74" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M44.222 55.8513C46.2661 49.9659 48.3111 44.0809 50.6109 38.451H38.8552C35.5333 47.6625 32.2115 56.6192 28.8885 65.8307C28.6327 66.8537 28.3782 67.6216 27.6107 68.1329C26.8447 68.9008 26.0772 69.1571 25.3109 69.4123C24.5449 69.4123 23.2671 69.1571 23.0111 68.3892C22.4996 67.6216 22.7554 66.5986 23.0111 65.8307C26.3329 56.6192 29.9105 47.6625 33.2335 38.451H21.4776C19.4335 44.0809 17.3885 49.9659 15.0887 55.8513C14.3224 57.8983 13.5552 60.2008 13.3004 62.2478C12.7889 64.5512 12.7889 66.8537 13.5552 69.1571C14.5782 71.2042 16.6222 72.4836 18.922 73.2515C20.9661 74.0182 23.2671 74.0182 25.5669 73.763C30.1662 72.9951 34.5113 70.9481 37.5774 67.6216C39.1109 66.0858 40.3887 64.0397 41.6665 61.9927C42.6885 59.9456 43.4557 57.8983 44.222 55.8513Z"
        fill="#10478F"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.4794 18.0434C7.65264 28.7776 3.82677 39.2566 0 49.9897H11.4794C16.5807 35.9334 21.6831 21.877 26.7856 8.07591C27.0404 7.05396 27.295 6.28723 28.0601 5.77572C28.8264 5.00898 29.5915 4.75378 30.3566 4.49748C31.1217 4.49748 32.3974 4.75378 32.652 5.52052C33.1625 6.28723 32.908 7.30917 32.652 8.07591C29.3358 17.2766 25.7647 26.2222 22.4482 35.4231H34.1825C36.2233 29.7995 38.2638 23.922 40.5603 18.0434C41.3255 15.9984 42.0909 13.6982 42.3454 11.6543C42.856 9.35415 42.856 7.05396 42.0909 4.75378C41.0709 2.7088 39.0301 1.43055 36.7336 0.663824C34.6928 -0.102906 32.3974 -0.102907 30.1009 0.153393C25.5099 0.920124 21.1729 2.96401 18.1121 6.28723C16.5807 7.82067 15.3062 9.86459 14.0305 11.9095C13.0096 13.9545 12.2445 15.9984 11.4794 18.0434Z"
        fill="#10478F"
      />
    </Svg>
  );
}

export default function LoadingOverlay({ visible, logoSize = 32, dimOpacity = 0.85 }: LoadingOverlayProps) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      spinAnim.setValue(0);
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.stopAnimation();
    }
  }, [visible]);

  if (!visible) return null;

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: `rgba(0,0,0,${dimOpacity})` }]}>
      <Animated.View
        style={{
          transform: [
            { perspective: 800 },
            { rotateY: spin },
          ],
        }}
      >
        <LogoSvg size={logoSize} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
});

/** 인라인 로고 스피너 (dim 없이 로고 + 텍스트만) */
export function LogoSpinner({ size = 18, text, textColor = '#EBECF1' }: { size?: number; text?: string; textColor?: string }) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spinAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 2800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Animated.View style={{ transform: [{ perspective: 800 }, { rotateY: spin }] }}>
        <LogoSvg size={size} />
      </Animated.View>
      {text && <Text style={{ color: textColor, fontSize: 12, fontWeight: '500' }}>{text}</Text>}
    </View>
  );
}
