import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class GlobalErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // 프로덕션에서는 Sentry 등 에러 리포팅 서비스로 전송
        console.error('[GlobalErrorBoundary]', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <StatusBar barStyle="dark-content" />
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="alert-circle-outline" size={64} color="#7295FE" />
                        </View>
                        <Text style={styles.title}>문제가 발생했습니다</Text>
                        <Text style={styles.message}>
                            죄송합니다. 예상치 못한 오류가 발생했습니다.{'\n'}
                            아래 버튼을 눌러 홈 화면으로 돌아가주세요.
                        </Text>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={this.handleReset}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="home-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.buttonText}>홈으로 돌아가기</Text>
                        </TouchableOpacity>
                        {__DEV__ && this.state.error && (
                            <View style={styles.debugContainer}>
                                <Text style={styles.debugTitle}>디버그 정보</Text>
                                <Text style={styles.debugText} numberOfLines={6}>
                                    {this.state.error.message}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        alignItems: 'center',
        maxWidth: 340,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(114, 149, 254, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        fontWeight: '400',
        color: '#808080',
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 32,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#7295FE',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    debugContainer: {
        marginTop: 32,
        padding: 16,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        width: '100%',
    },
    debugTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#999',
        marginBottom: 8,
    },
    debugText: {
        fontSize: 11,
        color: '#666',
        fontFamily: 'SpaceMono',
    },
});
