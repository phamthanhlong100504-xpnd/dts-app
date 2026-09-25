import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '../components/Button';
import { useAppStore } from '../store/useAppStore';

export default function HomeScreen() {
  const { theme, setTheme } = useAppStore();

  return (
    <View className={`flex-1 items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <Text className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Chào mừng đến với Base Project
      </Text>
      
      <Text className={`text-base mb-8 text-center px-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
        Project này đã được tích hợp sẵn Expo Router, Zustand và NativeWind (Tailwind).
      </Text>

      <Button 
        title={`Đổi sang ${theme === 'dark' ? 'Light' : 'Dark'} Mode`} 
        onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />
    </View>
  );
}
