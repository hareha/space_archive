import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { NEWS_DATA, SCRAPPED_NEWS } from '@/constants/MockData';

export default function NewsDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    // ID로 뉴스 데이터 찾기 (MockData 사용)
    // id가 문자열로 넘어오므로 처리가 필요할 수 있음. MockData의 id는 숫자일 수도 있음.
    // NEWS_DATA와 SCRAPPED_NEWS 모두 검색
    const newsItem = NEWS_DATA.find(item => item.id.toString() === id) ||
        SCRAPPED_NEWS.find(item => item.id.toString() === id);

    if (!newsItem) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>뉴스를 찾을 수 없습니다.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Header (Back Button) */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.actionButton}>
                            <Ionicons name="share-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton}>
                            <Ionicons name="bookmark-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Category & Date */}
                <View style={styles.metaInfo}>
                    <View style={styles.categoryChip}>
                        <Text style={styles.categoryText}>{newsItem.category}</Text>
                    </View>
                    <Text style={styles.dateText}>{newsItem.date}</Text>
                </View>

                {/* Title */}
                <Text style={styles.title}>{newsItem.title}</Text>

                {/* Image */}
                {/* Image */}
                <View style={styles.imageContainer}>
                    <Image source={{ uri: newsItem.imageUrl }} style={styles.image} contentFit="cover" transition={300} />
                </View>

                {/* Summary (Lead) */}
                <Text style={styles.summary}>{newsItem.summary}</Text>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Dummy Content */}
                <View style={styles.contentContainer}>
                    <Text style={styles.contentParagraph}>
                        (이 기사는 더미 텍스트로 구성되어 있습니다. 실제 기사 내용이 들어갈 자리입니다.)
                    </Text>
                    <Text style={styles.contentParagraph}>
                        루나 게이트웨이 정거장 건설이 본격화되면서 달 궤도 경제권에 대한 기대감이 고조되고 있습니다.
                        이번 프로젝트는 단순한 정거장 건설을 넘어, 인류가 심우주로 나아가는 중요한 교두보 역할을 할 것입니다.
                        특히 민간 기업들의 참여가 두드러지면서 우주 산업 생태계가 빠르게 확장되고 있습니다.
                    </Text>
                    <Text style={styles.contentParagraph}>
                        전문가들은 이번 성과가 향후 10년 내 달 거주지 건설의 초석이 될 것이라고 입을 모으고 있습니다.
                        에너지, 자원 채굴, 그리고 우주 관광에 이르기까지 다양한 분야에서 새로운 기회가 창출될 것으로 예상됩니다.
                        하지만 기술적 난제와 막대한 비용 문제는 여전히 해결해야 할 과제로 남아있습니다.
                    </Text>
                    <Text style={styles.contentParagraph}>
                        QiHomeworld를 비롯한 선도 기업들은 지속 가능한 달 개발을 위해 현지 자원 활용(ISRU) 기술 개발에 박차를 가하고 있습니다.
                        달의 표토에서 산소와 물을 추출하고, 건축 자재를 생산하는 기술은 달 기지 건설의 핵심이 될 것입니다.
                    </Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0B15',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    headerActions: {
        flexDirection: 'row',
    },
    actionButton: {
        padding: 8,
        marginLeft: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#fff',
        fontSize: 16,
    },
    metaInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginTop: 20,
        marginBottom: 12,
    },
    categoryChip: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 10,
    },
    categoryText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    dateText: {
        color: '#888',
        fontSize: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        lineHeight: 34,
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    imageContainer: {
        width: '100%',
        height: 250,
        marginBottom: 24,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    summary: {
        fontSize: 18,
        color: '#ddd',
        lineHeight: 28,
        fontWeight: '600',
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    divider: {
        height: 1,
        backgroundColor: '#333',
        marginHorizontal: 24,
        marginBottom: 24,
    },
    contentContainer: {
        paddingHorizontal: 24,
    },
    contentParagraph: {
        fontSize: 16,
        color: '#bbb',
        lineHeight: 26,
        marginBottom: 20,
    },
});
