import React, { useRef, useState, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    Dimensions,
    TouchableOpacity,
    ImageBackground,
    StatusBar,
    ViewToken,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SLIDES_B = [
    {
        id: '1',
        image: require('../assets/images/onboarding/1.png'),
        title: 'Plus Ultra와 함께\n달을 탐험해 보세요.',
        subtitle: '지도를 통해 다양한 지역과 지형을\n한 눈에 볼 수 있습니다.',
    },
    {
        id: '2',
        image: require('../assets/images/onboarding/2.png'),
        title: '달의 다양한 정보를\n확인해 보세요.',
        subtitle: '착륙 지점과 주요 지점 등 풍부한\n데이터를 살펴볼 수 있습니다.',
    },
    {
        id: '3',
        image: require('../assets/images/onboarding/3.png'),
        title: '나만의 흔적을\n남겨보세요.',
        subtitle: '약 250여 개의 공간 속에서\n나만의 장소를 새겨보세요.',
    },
    {
        id: '4',
        image: require('../assets/images/onboarding/4.png'),
        title: '달 관련 정보를\n한곳에서 확인해보세요.',
        subtitle: '탐사와 우주에 대한 다양한\n이야기를 만나볼 수 있습니다.',
    },
    {
        id: '5',
        image: require('../assets/images/onboarding/5.png'),
        title: '이제 달 탐험을\n시작해보세요.',
        subtitle: 'Plus Ultra와 함께\n새로운 우주를 경험하세요.',
    },
];

interface OnboardingScreenBProps {
    onComplete: () => void;
}

export default function OnboardingScreenB({ onComplete }: OnboardingScreenBProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (viewableItems.length > 0 && viewableItems[0].index !== null) {
                setCurrentIndex(viewableItems[0].index);
            }
        },
        []
    );

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const isLastSlide = currentIndex === SLIDES_B.length - 1;

    const renderSlide = ({ item }: { item: typeof SLIDES_B[0] }) => (
        <View style={styles.slide}>
            <ImageBackground
                source={item.image}
                style={styles.backgroundImage}
                resizeMode="cover"
            >
                {/* 어두운 오버레이 — 상단 그라데이션 효과 */}
                <View style={styles.overlay} />
                <View style={styles.overlayGradientTop} />

                {/* 텍스트 영역 — 상단 배치 */}
                <View style={styles.textContainer}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.subtitle}>{item.subtitle}</Text>
                </View>
            </ImageBackground>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* 슬라이드 영역 */}
            <FlatList
                ref={flatListRef}
                data={SLIDES_B}
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

            {/* ───── 고정 오버레이: SKIP + 인디케이터 + 버튼 ───── */}

            {/* 상단 SKIP (고정) */}
            {!isLastSlide && (
                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={onComplete}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Text style={styles.skipText}>SKIP</Text>
                </TouchableOpacity>
            )}

            {/* 하단 고정 영역: 인디케이터 + 시작 버튼 */}
            <View style={styles.bottomFixed} pointerEvents="box-none">
                {/* 페이지 인디케이터 */}
                <View style={styles.pagination}>
                    {SLIDES_B.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                index === currentIndex && styles.dotActive,
                            ]}
                        />
                    ))}
                </View>

                {/* 마지막 페이지 시작 버튼 */}
                {isLastSlide && (
                    <TouchableOpacity
                        style={styles.startButton}
                        onPress={onComplete}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.startButtonText}>시작하기</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0E1A',
    },
    slide: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    backgroundImage: {
        flex: 1,
        justifyContent: 'flex-start', // B안: 상단 정렬
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 14, 26, 0.45)',
    },
    // 상단 그라데이션 오버레이 — 텍스트 가독성 확보
    overlayGradientTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.4,
        backgroundColor: 'transparent',
        // React Native에서는 LinearGradient를 못쓰므로 반투명 블록으로 대체
        opacity: 0,
    },

    // 텍스트 — 상단 배치 (SafeArea 아래)
    textContainer: {
        paddingHorizontal: 32,
        paddingTop: 120, // SafeArea + 여유 공간
        zIndex: 10,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '700',
        lineHeight: 38,
        marginBottom: 14,
        letterSpacing: -0.3,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 15,
        fontWeight: '400',
        lineHeight: 23,
    },

    // 상단 SKIP (절대 위치 — 고정)
    skipButton: {
        position: 'absolute',
        top: 60,
        right: 24,
        paddingVertical: 6,
        paddingHorizontal: 12,
        zIndex: 20,
    },
    skipText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 1.5,
    },

    // 하단 고정 영역 (절대 위치)
    bottomFixed: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingBottom: 60,
        zIndex: 20,
    },
    pagination: {
        flexDirection: 'row',
        marginBottom: 28,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.25)',
        marginHorizontal: 5,
    },
    dotActive: {
        backgroundColor: '#FFFFFF',
        width: 24,
        borderRadius: 4,
    },

    // 시작 버튼
    startButton: {
        backgroundColor: '#4A90D9',
        paddingVertical: 16,
        paddingHorizontal: 80,
        borderRadius: 14,
    },
    startButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
    },
});
