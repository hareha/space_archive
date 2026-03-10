import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Themed';

interface NewsCardProps {
    category: string;
    title: string;
    summary?: string;
    date: string;
    imageUrl: string;
    viewMode?: 'card' | 'list';
}

export default function NewsCard({ category, title, summary, date, imageUrl, viewMode = 'card' }: NewsCardProps) {
    if (viewMode === 'list') {
        return (
            <View style={listStyles.card}>
                <Image source={{ uri: imageUrl }} style={listStyles.image} contentFit="cover" transition={200} />
                <View style={listStyles.content}>
                    <View style={listStyles.meta}>
                        <Text style={listStyles.category}>{category}</Text>
                        <Text style={listStyles.dot}>·</Text>
                        <Text style={listStyles.date}>{date}</Text>
                    </View>
                    <Text style={listStyles.title} numberOfLines={2}>{title}</Text>
                    {summary ? <Text style={listStyles.summary} numberOfLines={1}>{summary}</Text> : null}
                </View>
            </View>
        );
    }

    return (
        <View style={cardStyles.card}>
            <Image source={{ uri: imageUrl }} style={cardStyles.image} contentFit="cover" transition={200} />
            <View style={cardStyles.content}>
                <Text style={cardStyles.title} numberOfLines={2}>{title}</Text>
                {summary ? <Text style={cardStyles.summary} numberOfLines={2}>{summary}</Text> : null}
                <View style={cardStyles.meta}>
                    <Text style={cardStyles.category}>{category}</Text>
                    <Text style={cardStyles.dot}>·</Text>
                    <Text style={cardStyles.date}>{date}</Text>
                </View>
            </View>
        </View>
    );
}

// ── 카드 모드 스타일 ──
const cardStyles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: 180,
        backgroundColor: '#E5E5E5',
    },
    content: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
        lineHeight: 22,
        marginBottom: 6,
    },
    summary: {
        fontSize: 13,
        color: '#999',
        lineHeight: 19,
        marginBottom: 10,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    category: {
        color: '#888',
        fontSize: 12,
    },
    dot: {
        color: '#CCC',
        fontSize: 12,
        marginHorizontal: 6,
    },
    date: {
        color: '#888',
        fontSize: 12,
    },
});

// ── 리스트 모드 스타일 ──
const listStyles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 12,
        flexDirection: 'row',
        overflow: 'hidden',
        height: 96,
    },
    image: {
        width: 96,
        height: '100%',
        backgroundColor: '#E5E5E5',
    },
    content: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        justifyContent: 'center',
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    category: {
        color: '#999',
        fontSize: 11,
    },
    dot: {
        color: '#CCC',
        fontSize: 11,
        marginHorizontal: 5,
    },
    date: {
        color: '#999',
        fontSize: 11,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1A1A',
        lineHeight: 20,
    },
    summary: {
        fontSize: 12,
        color: '#ACACAC',
        lineHeight: 16,
        marginTop: 2,
    },
});
