import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Themed';

interface NewsCardProps {
    category: string;
    title: string;
    summary: string;
    date: string;
    imageUrl: string;
}

export default function NewsCard({ category, title, summary, date, imageUrl }: NewsCardProps) {
    return (
        <View style={styles.card}>
            <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" transition={200} />
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.category}>{category}</Text>
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
        backgroundColor: '#1E1E2C',
        borderRadius: 20,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    image: {
        width: '100%',
        height: 180,
    },
    content: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        alignItems: 'center',
    },
    category: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        overflow: 'hidden',
    },
    date: {
        color: '#888',
        fontSize: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#fff',
        lineHeight: 26,
    },
    summary: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 20,
        marginBottom: 10,
    },
});
