import React from 'react';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '../../constants/Colors';

function TabBarIcon(props: {
    name: React.ComponentProps<typeof FontAwesome>['name'];
    color: string;
}) {
    return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#3B82F6',
                tabBarInactiveTintColor: '#666',
                tabBarStyle: {
                    backgroundColor: '#0B0B15',
                    borderTopColor: 'rgba(255,255,255,0.1)',
                    height: 90,
                    paddingVertical: 10,
                },
                headerShown: false,
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: '인사이트',
                    tabBarIcon: ({ color }) => <TabBarIcon name="newspaper-o" color={color} />,
                }}
            />
            <Tabs.Screen
                name="moon"
                options={{
                    title: 'Moon 3D',
                    tabBarIcon: ({ color }) => <TabBarIcon name="globe" color={color} />,
                }}
            />
            <Tabs.Screen
                name="two"
                options={{
                    href: null, // Hide tab two
                }}
            />
        </Tabs >
    );
}
