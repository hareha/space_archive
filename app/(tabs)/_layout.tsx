import React from 'react';
import { Tabs } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';

export default function TabLayout() {

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#1A1A1A',
                tabBarInactiveTintColor: '#ACACAC',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopColor: '#E5E5E5',
                    borderTopWidth: 1,
                    height: 90,
                    paddingVertical: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '500',
                },
                headerShown: false,
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: '인사이트',
                    tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="moon"
                options={{
                    title: '홈',
                    tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="mypage"
                options={{
                    title: '마이페이지',
                    tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="two"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}
