import { useState } from 'react';
import { StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { Text, View } from '@/components/Themed';
import NewsCard from '@/components/NewsCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { NEWS_DATA } from '@/constants/MockData';

export default function TabOneScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [selectedCategory, setSelectedCategory] = useState<string>('최신');

  const filteredNews = selectedCategory === '최신'
    ? NEWS_DATA
    : NEWS_DATA.filter(item => item.category === selectedCategory);

  const handleSearch = () => {
    // Search implementation
  };

  const handleCategoryPress = (category: string) => {
    setSelectedCategory(category);
  };

  const handleBannerPress = () => {
    router.push('/(tabs)/moon');
  };

  const handleNewsPress = (id: string) => {
    // router.push(\`/news/\${id}\`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>코스믹 인사이트</Text>
            <Text style={styles.headerSubtitle}>달의 이야기</Text>
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <FontAwesome name="search" size={20} color="#aaa" />
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
          {['최신', '탐사', '산업', '과학'].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && { backgroundColor: colors.tint, borderColor: colors.tint }
              ]}
              onPress={() => handleCategoryPress(cat)}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory === cat ? { color: '#fff' } : { color: '#888' }
              ]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Banner */}
        {selectedCategory === '최신' && (
          <TouchableOpacity style={styles.bannerContainer} onPress={handleBannerPress} activeOpacity={0.9}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1522030299830-16b8d3d049fe?q=80&w=1000&auto=format&fit=crop' }}
              style={styles.bannerImage}
              contentFit="cover"
            />
            <View style={styles.bannerOverlay}>
              <View style={styles.bannerTag}>
                <Text style={styles.bannerTagText}>Journey Never Ends</Text>
              </View>
              <Text style={styles.bannerTitle}>달 표면 위에 새기는{'\n'}우주의 영혼 좌표</Text>
              <Text style={styles.bannerDesc}>외롬, 시간, 경면, 기억을 가진 최소의 존재단위로 당신의 영혼이 머무를 단 하나의 좌표를 새기세요.</Text>

              <View style={[styles.bannerButton, { backgroundColor: colors.tint }]}>
                <Text style={styles.bannerButtonText}>우주 정보 구독 & 좌표 새기기</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* List */}
        <View style={[styles.sectionHeader, selectedCategory !== '최신' && { marginTop: 0 }]}>
          <FontAwesome name="rss" size={16} color={colors.tint} style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>
            {selectedCategory === '최신' ? '최신 업데이트' : \`\${selectedCategory} 뉴스\`}
          </Text>
        </View>

        {filteredNews.map((news) => (
          <TouchableOpacity key={news.id} onPress={() => handleNewsPress(news.id)}>
            <NewsCard
              category={news.category}
              title={news.title}
              summary={news.summary}
              date={news.date}
              imageUrl={news.imageUrl}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60, // Safe Area padding
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#aaa',
  },
  searchButton: {
    padding: 8,
  },
  categories: {
    marginBottom: 20,
    maxHeight: 50,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    height: 36,
    justifyContent: 'center',
  },
  categoryText: {
    fontWeight: '600',
  },
  bannerContainer: {
    height: 340,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 30,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 20,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bannerTag: {
    backgroundColor: 'rgba(30,30,50,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  bannerTagText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  bannerDesc: {
    fontSize: 13,
    color: '#ddd',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  bannerButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
  },
  bannerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});
