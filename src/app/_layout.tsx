import { Stack } from 'expo-router';
import { useAppStore } from '../store/useAppStore';
import { View } from 'react-native';

export default function RootLayout() {
  const theme = useAppStore((state) => state.theme);

  return (
    <Stack screenOptions={{ 
      headerStyle: { backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff' },
      headerTintColor: theme === 'dark' ? '#ffffff' : '#000000'
    }}>
      <Stack.Screen name="index" options={{ title: 'Trang Chủ' }} />
    </Stack>
  );
}
