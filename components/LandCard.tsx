import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Themed';
import { FontAwesome } from '@expo/vector-icons';

interface LandCardProps {
    id: string;
    location: string;
    coordinates: string;
    area: string;
    purchaseDate: string;
    imageUrl: string;
    onViewMap?: () => void;
}

export default function LandCard({ id, location, coordinates, area, purchaseDate, imageUrl, onViewMap }: LandCardProps) {
    return (
        <View style={styles.card}>
            <View style={styles.topSection}>
                <View style={styles.imageContainer}>
                    <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" transition={200} />
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>LUNAR</Text>
                    </View>
                </View>

                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <Text style={styles.idText}>{id}</Text>
                        <FontAwesome name="ellipsis-v" size={14} color="#666" />
                    </View>

                    <View style={styles.infoRow}>
                        <FontAwesome name="calendar" size={12} color="#888" style={{ width: 14 }} />
                        <Text style={styles.infoText}>구매일: {purchaseDate}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <FontAwesome name="arrows-alt" size={11} color="#888" style={{ width: 14 }} />
                        <Text style={styles.infoText}>면적: {area}m²</Text>
                    </View>
                </View>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.mapButton} onPress={onViewMap} activeOpacity={0.8}>
                    <FontAwesome name="map-o" size={14} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.mapButtonText}>지도 보기</Text>
                </TouchableOpacity>
                <View style={styles.shareButton}>
                    <FontAwesome name="share-alt" size={16} color="#888" />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#161622',
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 16,
    },
    topSection: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    imageContainer: {
        width: 80,
        height: 80,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        marginRight: 16,
        backgroundColor: '#333',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    badge: {
        position: 'absolute',
        top: 6,
        left: 6,
        backgroundColor: '#3B82F6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    idText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'System', // Adjust if custom font needed
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    infoText: {
        color: '#aaa',
        fontSize: 13,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    mapButton: {
        flex: 1,
        backgroundColor: '#2563EB',
        borderRadius: 8,
        height: 40,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    shareButton: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#232333',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    }
});
