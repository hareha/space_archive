import { Stack } from 'expo-router';

export default function ProfileLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="manage" />
            <Stack.Screen name="personal-info" />
            <Stack.Screen name="change-password" />
            <Stack.Screen name="withdraw" />
            <Stack.Screen name="subscription" />
            <Stack.Screen name="customer-service" />
            <Stack.Screen name="notices" />
            <Stack.Screen name="my-territories" />
            <Stack.Screen name="territory-detail" />
            <Stack.Screen name="scrapbook" />
        </Stack>
    );
}
