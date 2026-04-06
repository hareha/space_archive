import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Image, Text, Animated, StatusBar, DeviceEventEmitter } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TabActions } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

// ═══ 커스텀 탭 바 ═══
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();

    const tabs = [
        { routeName: 'moon', label: 'Insight', icon: 'insight' as const },
        { routeName: 'index', label: 'home', icon: null },
        { routeName: 'mypage', label: 'My', icon: 'my' as const },
    ];

    // 내 구역 관리 → 추가 구역 개척 이벤트 수신 → index 탭으로 전환
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('switchToPioneer', () => {
            navigation.dispatch(TabActions.jumpTo('index'));
        });
        // 인사이트 기사 하이퍼링크 → 탐사모드 탭 전환
        const sub2 = DeviceEventEmitter.addListener('navigateToExploration', () => {
            navigation.dispatch(TabActions.jumpTo('index'));
        });
        return () => { sub.remove(); sub2.remove(); };
    }, [navigation]);

    return (
        <View style={[styles.tabBarOuter, { paddingBottom: Math.max(insets.bottom, 5) }]}>
            <View style={styles.tabBarContainer}>
                {tabs.map((tab) => {
                    const routeIndex = state.routes.findIndex(r => r.name === tab.routeName);
                    if (routeIndex === -1) return null;

                    const isFocused = state.index === routeIndex;
                    const route = state.routes[routeIndex];

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });
                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    // 중앙 로고
                    if (tab.icon === null) {
                        return (
                            <TouchableOpacity
                                key={tab.routeName}
                                style={styles.tabItem}
                                onPress={onPress}
                                activeOpacity={0.8}
                            >
                                <Image
                                    source={require('@/assets/images/logo_white.png')}
                                    style={[
                                        styles.logoIcon,
                                        {
                                            tintColor: isFocused ? '#FFFFFF' : '#666666',
                                            opacity: isFocused ? 1 : 0.45,
                                        },
                                    ]}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        );
                    }

                    // Insight / My 탭 — SVG 아이콘
                    const iconColor = isFocused ? '#FFFFFF' : '#666666';
                    return (
                        <TouchableOpacity
                            key={tab.routeName}
                            style={styles.tabItem}
                            onPress={onPress}
                            activeOpacity={0.7}
                        >
                            {tab.icon === 'insight' ? (
                                <Svg width={20} height={22} viewBox="0 0 16 18" fill="none">
                                    <Path d="M9.83105 6.18726H4.73444" stroke={iconColor} strokeWidth={1.5} strokeLinecap="square" strokeLinejoin="round" />
                                    <Path d="M6.67968 9.68164H4.73444" stroke={iconColor} strokeWidth={1.5} strokeLinecap="square" strokeLinejoin="round" />
                                    <Path d="M14.812 0.75H0.75V16.2752H14.812V0.75Z" stroke={iconColor} strokeWidth={1.5} strokeLinecap="square" />
                                </Svg>
                            ) : isFocused ? (
                                <Svg width={20} height={21} viewBox="0 0 16 17" fill="none">
                                    <Path d="M7.88743 10.2909C10.5022 10.2909 12.646 8.1543 12.646 5.52004C12.646 2.88579 10.5022 0.75 7.88743 0.75C5.27346 0.75 3.12973 2.88579 3.12973 5.52004C3.12973 8.1543 5.27346 10.2909 7.88743 10.2909Z" fill={iconColor} stroke={iconColor} strokeWidth={1.5} strokeMiterlimit={10} />
                                    <Path d="M0.75 15.8556C0.75 12.7825 3.94504 10.29 7.8874 10.29C11.8289 10.29 15.0248 12.7825 15.0248 15.8556H0.75Z" fill={iconColor} stroke={iconColor} strokeWidth={1.5} strokeMiterlimit={10} />
                                </Svg>
                            ) : (
                                <Svg width={20} height={21} viewBox="0 0 24 24" fill="none">
                                    <Path d="M12.0007 14.3686C15.1142 14.3686 17.6673 11.8232 17.6673 8.6843C17.6673 5.54544 15.1142 3 12.0007 3C8.88711 3 6.33398 5.54544 6.33398 8.6843C6.33398 11.8232 8.88711 14.3686 12.0007 14.3686Z" stroke={iconColor} strokeWidth={1.5} strokeMiterlimit={10} />
                                    <Path d="M3.5 21C3.5 17.3376 7.30584 14.3683 12 14.3683C16.6942 14.3683 20.5 17.3376 20.5 21" stroke={iconColor} strokeWidth={1.5} strokeMiterlimit={10} />
                                </Svg>
                            )}
                            <Text style={isFocused ? styles.labelActive : styles.labelInactive}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

// 앱 최초 실행 시에만 스플래시 표시 (재마운트 시 방지)
let _splashShownOnce = false;

export default function TabLayout() {
    const [showSplash, setShowSplash] = useState(!_splashShownOnce);
    const splashOpacity = useRef(new Animated.Value(_splashShownOnce ? 0 : 1)).current;

    useEffect(() => {
        if (_splashShownOnce) {
            setShowSplash(false);
            return;
        }
        const timer = setTimeout(() => {
            Animated.timing(splashOpacity, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }).start(() => {
                setShowSplash(false);
                _splashShownOnce = true;
            });
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const [activeTab, setActiveTab] = useState('index');

    return (
        <View style={{ flex: 1 }}>
            <StatusBar barStyle={activeTab === 'index' ? 'light-content' : 'dark-content'} />
            <Tabs
                tabBar={(props) => <CustomTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: {
                        backgroundColor: 'transparent',
                        borderTopWidth: 0,
                        elevation: 0,
                    },
                }}
                screenListeners={{
                    state: (e) => {
                        const data = e.data as any;
                        if (data?.state?.routes && data.state.index !== undefined) {
                            const route = data.state.routes[data.state.index];
                            if (route?.name) setActiveTab(route.name);
                        }
                    },
                }}
            >
                <Tabs.Screen name="moon" />
                <Tabs.Screen name="index" />
                <Tabs.Screen name="mypage" />
                <Tabs.Screen name="two" options={{ href: null }} />
            </Tabs>

            {/* 스플래시 — 바텀탭 포함 전체 화면 가림 */}
            {showSplash && (
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 99999, backgroundColor: '#fff', opacity: splashOpacity,
                        alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <Image
                        source={require('../../assets/images/splash.png')}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                    />
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    tabBarOuter: {
        backgroundColor: '#070A12',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    tabBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        height: 64,
    },

    // ── 각 탭 아이템 ──
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 60,
        position: 'relative',
    },

    // ── 라벨 ──
    labelActive: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 3,
    },
    labelInactive: {
        color: '#666666',
        fontSize: 10,
        fontWeight: '500',
        marginTop: 3,
    },

    // ── 로고 ──
    logoIcon: {
        width: 30,
        height: 30,
    },
});
