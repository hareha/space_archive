import React, { useRef, useState, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    Dimensions,
    TouchableOpacity,
    Image,
    StatusBar,
    ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.62;

const SLIDES = [
    {
        id: '1',
        image: require('../assets/images/onboarding/Image-0.png'),
        title: 'Plus Ultra와 함께 달을 탐험해 보세요.',
        subtitle: '지도를 통해 다양한 지역과\n지형을 한 눈에 볼 수 있습니다.',
    },
    {
        id: '2',
        image: require('../assets/images/onboarding/Image-1.png'),
        title: '달의 다양한 정보를 확인해 보세요.',
        subtitle: '착륙 지점과 주요 지점 등\n풍부한 데이터를 살펴볼 수 있습니다.',
    },
    {
        id: '3',
        image: require('../assets/images/onboarding/Image-2.png'),
        title: '나만의 흔적을 남겨보세요.',
        subtitle: '약 256억 개의 공간 속에서\n나만의 장소를 새겨보세요.',
    },
    {
        id: '4',
        image: require('../assets/images/onboarding/Image-3.png'),
        title: '달 관련 정보를 한곳에서 확인해보세요.',
        subtitle: '탐사와 우주에 대한 다양한\n이야기를 만나볼 수 있습니다.',
    },
    {
        id: '5',
        image: require('../assets/images/onboarding/Image-4.png'),
        title: '지금 하늘의 달을 확인해 보세요.',
        subtitle: 'AR로 실시간 달의 위치와\n궤적을 확인할 수 있습니다.',
    },
    {
        id: '6',
        image: require('../assets/images/onboarding/Image-5.png'),
        title: '이제 달 탐험을 시작해보세요.',
        subtitle: '',
    },
];

interface OnboardingScreenProps {
    onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (viewableItems.length > 0 && viewableItems[0].index !== null) {
                setCurrentIndex(viewableItems[0].index);
            }
        },
        []
    );

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const isLastSlide = currentIndex === SLIDES.length - 1;

    const handleNext = () => {
        if (isLastSlide) {
            onComplete();
        } else {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        }
    };

    const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
        <View style={styles.slide}>
            {/* 상단 이미지 영역 */}
            <View style={styles.imageContainer}>
                <Image
                    source={item.image}
                    style={styles.image}
                    resizeMode="cover"
                />
            </View>

            {/* 하단 텍스트 영역 (흰 배경) */}
            <View style={styles.textContainer}>
                <Text style={styles.title}>{item.title}</Text>
                {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* 슬라이드 영역 */}
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                getItemLayout={(_, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                })}
            />

            {/* ───── 하단 고정: 인디케이터 + Skip/시작 ───── */}
            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
                {/* 페이지 인디케이터 (좌측) */}
                <View style={styles.pagination}>
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                index === currentIndex && styles.dotActive,
                            ]}
                        />
                    ))}
                </View>

                {/* Skip / 시작하기 버튼 (우측) */}
                {isLastSlide ? (
                    <TouchableOpacity
                        style={styles.startButton}
                        onPress={onComplete}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.startButtonText}>시작하기</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={onComplete}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    slide: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },

    // 상단 이미지 — 화면 상단 ~62%
    imageContainer: {
        width: SCREEN_WIDTH,
        height: IMAGE_HEIGHT,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },

    // 하단 텍스트 — 흰 배경
    textContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 28,
        paddingBottom: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: '#1A1A2E',
        fontSize: 18,
        fontWeight: '700',
        lineHeight: 26,
        marginBottom: 10,
        letterSpacing: -0.3,
        textAlign: 'center',
    },
    subtitle: {
        color: '#8E8E9A',
        fontSize: 15,
        fontWeight: '400',
        lineHeight: 23,
        textAlign: 'center',
    },

    // 하단 바 (절대 위치 — 인디케이터 + Skip)
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 28,
        backgroundColor: '#FFFFFF',
    },
    pagination: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#D1D1D6',
        marginRight: 6,
    },
    dotActive: {
        backgroundColor: '#3B5BDB',
        width: 22,
        borderRadius: 4,
    },

    // Skip 텍스트
    skipText: {
        color: '#3B5BDB',
        fontSize: 16,
        fontWeight: '600',
    },

    // 시작하기 버튼
    startButton: {
        backgroundColor: '#3B5BDB',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 20,
    },
    startButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
