import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// ═══ 커스텀 탭 바 ═══
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();

    const tabs = [
        { routeName: 'moon', label: 'Insight', icon: 'newspaper-outline' as const },
        { routeName: 'index', label: 'home', icon: null },
        { routeName: 'mypage', label: 'My', icon: 'person-outline' as const },
    ];

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

                    // Insight / My 탭
                    return (
                        <TouchableOpacity
                            key={tab.routeName}
                            style={styles.tabItem}
                            onPress={onPress}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={tab.icon}
                                size={22}
                                color={isFocused ? '#FFFFFF' : '#666666'}
                            />
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

export default function TabLayout() {
    return (
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
        >
            <Tabs.Screen name="moon" />
            <Tabs.Screen name="index" />
            <Tabs.Screen name="mypage" />
            <Tabs.Screen name="two" options={{ href: null }} />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBarOuter: {
        backgroundColor: '#0D0F14',
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
