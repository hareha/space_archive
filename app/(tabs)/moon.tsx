import { useRef, useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Alert, View, StatusBar, ScrollView, Switch } from 'react-native';
import { WebView } from 'react-native-webview';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { CESIUM_HTML } from '@/constants/CesiumHtml';

export default function MoonScreen() {
    const colorScheme = useColorScheme();
    const webViewRef = useRef<WebView>(null);
    const [searchText, setSearchText] = useState('');

    // UI State
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

    // Section 1: 지도 레이어
    const [showCraters, setShowCraters] = useState(true);
    const [showLandingSites, setShowLandingSites] = useState(false);

    // Section 2: 자원 분포
    const [showCoreResources, setShowCoreResources] = useState(true);
    const [showRareElements, setShowRareElements] = useState(false);
    const [showPhysics, setShowPhysics] = useState(false);

    // Section 3: 지형 정보
    const [showSlope, setShowSlope] = useState(false);
    const [showHeight, setShowHeight] = useState(false);

    const sendToWeb = (type: string, payload?: any) => {
        webViewRef.current?.postMessage(JSON.stringify({ type, payload }));
    };

    const handleSearch = () => {
        if (!searchText.trim()) return;
        // Search logic placeholder
        // sendToWeb('SEARCH_LOCATION', searchText);
        Alert.alert('검색', \`'\${searchText}' 검색 결과가 없습니다. (데모)\`);
    };

    const onZoomIn = () => sendToWeb('ZOOM_IN');
    const onZoomOut = () => sendToWeb('ZOOM_OUT');

    // Load Mineral Data
    useEffect(() => {
        async function loadData() {
            try {
                const asset = Asset.fromModule(require('../../assets/lpgrs_high1_elem_abundance_2deg.tab'));
                await asset.downloadAsync();
                
                if (asset.localUri) {
                    const text = await FileSystem.readAsStringAsync(asset.localUri);
                    setMineralData(text);
                }
            } catch (e) {
                console.log("Error loading mineral data:", e);
            }
        }
        loadData();
    }, []);

    const [mineralData, setMineralData] = useState<string | null>(null);
    const [webViewLoaded, setWebViewLoaded] = useState(false);

    useEffect(() => {
        if (webViewLoaded && mineralData) {
            sendToWeb('INJECT_DATA', mineralData);
            console.log("Sent mineral data to WebView");
            
            if(showCoreResources) sendToWeb('TOGGLE_RESOURCE', { show: true, type: 'CORE' });
        }
    }, [webViewLoaded, mineralData]);

    const toggleCore = (val: boolean) => {
        setShowCoreResources(val);
        if (val) {
            setShowRareElements(false);
            setShowPhysics(false);
            sendToWeb('TOGGLE_RESOURCE', { show: true, type: 'CORE' });
        } else {
            sendToWeb('TOGGLE_RESOURCE', { show: false });
        }
    };
    const toggleRare = (val: boolean) => {
        setShowRareElements(val);
        if (val) {
            setShowCoreResources(false);
            setShowPhysics(false);
            sendToWeb('TOGGLE_RESOURCE', { show: true, type: 'RARE' });
        } else {
            sendToWeb('TOGGLE_RESOURCE', { show: false });
        }
    };
    const togglePhysics = (val: boolean) => {
        setShowPhysics(val);
        if (val) {
            setShowRareElements(false);
            setShowCoreResources(false);
            sendToWeb('TOGGLE_RESOURCE', { show: true, type: 'PHYSICS' });
        } else {
            sendToWeb('TOGGLE_RESOURCE', { show: false });
        }
    };

    const toggleCraters = (val: boolean) => {
        setShowCraters(val);
        sendToWeb('TOGGLE_LABELS', val);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            <View style={styles.webViewContainer}>
                <WebView
                    ref={webViewRef}
                    originWhitelist={['*']}
                    source={{ html: CESIUM_HTML }}
                    style={{ backgroundColor: '#000' }}
                    scrollEnabled={false}
                    bounces={false}
                    overScrollMode="never"
                    onLoadEnd={() => setWebViewLoaded(true)}
                    onError={(e) => console.warn('WebView Error:', e.nativeEvent)}
                />
            </View>

            {/* Top Search Bar */}
            <BlurView intensity={30} tint="dark" style={styles.topBar}>
                <View style={[styles.searchContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                    <FontAwesome name="search" size={16} color="#aaa" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="좌표(Lat, Lon) 또는 지역명 검색..."
                        placeholderTextColor="#aaa"
                        value={searchText}
                        onChangeText={setSearchText}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                </View>
            </BlurView>

            {/* Filter Panel */}
            <View style={styles.filterContainer}>
                <BlurView intensity={40} tint="dark" style={styles.filterBlur}>
                    <ScrollView style={styles.filterScrollView}>
                        <Text style={styles.filterTitle}>지도 레이어 설정</Text>
                        
                        {/* Section 1 */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <MaterialCommunityIcons name="moon-waxing-crescent" size={16} color="#3B82F6" />
                                <Text style={styles.sectionTitle}>기본 정보</Text>
                            </View>
                            <View style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>주요 크레이터 표시</Text>
                                <Switch
                                    value={showCraters}
                                    onValueChange={toggleCraters}
                                    trackColor={{ false: '#2C2C35', true: '#3B82F6' }}
                                    thumbColor={'#fff'}
                                    ios_backgroundColor="#2C2C35"
                                />
                            </View>
                            <View style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>아르테미스 착륙 후보지</Text>
                                <Switch
                                    value={showLandingSites}
                                    onValueChange={setShowLandingSites}
                                    trackColor={{ false: '#2C2C35', true: '#3B82F6' }}
                                    thumbColor={'#fff'}
                                    ios_backgroundColor="#2C2C35"
                                />
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Section 2 */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="cube-outline" size={16} color="#3B82F6" />
                                <Text style={styles.sectionTitle}>자원 분포</Text>
                            </View>
                            <View style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>핵심자원 표시 (FeO, TiO2, mgO)</Text>
                                <Switch
                                    value={showCoreResources}
                                    onValueChange={toggleCore}
                                    trackColor={{ false: '#2C2C35', true: '#3B82F6' }}
                                    thumbColor={'#fff'}
                                    ios_backgroundColor="#2C2C35"
                                />
                            </View>
                            <View style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>희귀원소 표시 (K, Th, U)</Text>
                                <Switch
                                    value={showRareElements}
                                    onValueChange={toggleRare}
                                    trackColor={{ false: '#2C2C35', true: '#3B82F6' }}
                                    thumbColor={'#fff'}
                                    ios_backgroundColor="#2C2C35"
                                />
                            </View>
                            <View style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>물리 지표 표시</Text>
                                <Switch
                                    value={showPhysics}
                                    onValueChange={togglePhysics}
                                    trackColor={{ false: '#2C2C35', true: '#3B82F6' }}
                                    thumbColor={'#fff'}
                                    ios_backgroundColor="#2C2C35"
                                />
                            </View>
                        </View>

                        <View style={styles.divider} />

                         {/* Section 3 */}
                         <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="stats-chart-outline" size={16} color="#3B82F6" />
                                <Text style={styles.sectionTitle}>지형 정보</Text>
                            </View>
                            <View style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>경사도 (Slope)</Text>
                                <Switch
                                    value={showSlope}
                                    onValueChange={setShowSlope}
                                    trackColor={{ false: '#2C2C35', true: '#3B82F6' }}
                                    thumbColor={'#fff'}
                                    ios_backgroundColor="#2C2C35"
                                />
                            </View>
                             <View style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>고도 (Height)</Text>
                                <Switch
                                    value={showHeight}
                                    onValueChange={setShowHeight}
                                    trackColor={{ false: '#2C2C35', true: '#3B82F6' }}
                                    thumbColor={'#fff'}
                                    ios_backgroundColor="#2C2C35"
                                />
                            </View>
                        </View>
                    </ScrollView>
                </BlurView>
            </View>

            {/* Zoom Controls */}
            <View style={styles.zoomControls}>
                <TouchableOpacity style={styles.zoomButton} onPress={onZoomIn}>
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <TouchableOpacity style={styles.zoomButton} onPress={onZoomOut}>
                    <Ionicons name="remove" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    webViewContainer: {
        flex: 1,
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 60, // Safe area
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
    },
    filterContainer: {
        position: 'absolute',
        top: 130, // Below search bar
        left: 16,
        width: 250,
        height: 500, // Fixed height for scroll
        borderRadius: 16,
        overflow: 'hidden',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
    },
    filterBlur: {
        flex: 1,
    },
    filterScrollView: {
        padding: 16,
    },
    filterTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#888',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    section: {
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingLeft: 4,
    },
    toggleLabel: {
        color: '#ddd',
        fontSize: 13,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 12,
    },
    zoomControls: {
        position: 'absolute',
        right: 16,
        bottom: 40,
        backgroundColor: 'rgba(30,30,30,0.8)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    zoomButton: {
        padding: 12,
        backgroundColor: 'transparent',
    }
});
