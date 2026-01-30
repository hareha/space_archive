import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from './useColorScheme';

interface NewsCardProps {
    category: string;
    title: string;
    summary: string;
    date: string;
    imageUrl: string;
}

export default function NewsCard({ category, title, summary, date, imageUrl }: NewsCardProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    return (
        <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
            <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={200}
            />
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.category, { color: colors.tint }]}>{category}</Text>
                    <Text style={styles.date}>{date}</Text>
                </View>
                <Text style={styles.title} numberOfLines={2}>{title}</Text>
                <Text style={styles.summary} numberOfLines={2}>{summary}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    image: {
        width: '100%',
        height: 160,
    },
    content: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    category: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    date: {
        fontSize: 12,
        color: '#888',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#fff',
    },
    summary: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 20,
    },
});
