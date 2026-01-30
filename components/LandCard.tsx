import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Themed';
import { Ionicons } from '@expo/vector-icons';

interface LandCardProps {
    id: string;
    location: string;
    coords: string;
    area: string;
    imageUrl: string;
}

export default function LandCard({ id, location, coords, area, imageUrl }: LandCardProps) {
    return (
        <View style={styles.card}>
            <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
            <View style={styles.info}>
                <View style={styles.header}>
                    <Text style={styles.location}>{location}</Text>
                    <Ionicons name="location-outline" size={16} color="#3B82F6" />
                </View>
                <Text style={styles.coords}>{coords}</Text>
                <View style={styles.divider} />
                <View style={styles.footer}>
                    <Text style={styles.label}>ID</Text>
                    <Text style={styles.value}>{id}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.label}>AREA</Text>
                    <Text style={styles.value}>{area}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    image: {
        width: '100%',
        height: 120,
    },
    info: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    location: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    coords: {
        fontSize: 12,
        color: '#888',
        marginBottom: 12,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    label: {
        fontSize: 10,
        color: '#666',
        marginRight: 8,
    },
    value: {
        fontSize: 12,
        color: '#ddd',
        fontWeight: '600',
        marginRight: 16,
    },
});
