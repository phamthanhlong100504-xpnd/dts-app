import type { ReactNode } from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, Text, View, StatusBar, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
export function AuthFrame({ title, subtitle, kind = 'login', children }: { title: string; subtitle?: string; kind?: 'login' | 'register' | 'forgot'; children: ReactNode }) {
  const { height } = useWindowDimensions();
  const topSpace = kind === 'register' ? Math.max(72, Math.min(height * 0.13, 132))
    : kind === 'forgot' ? Math.max(112, Math.min(height * 0.24, 220))
    : Math.max(170, Math.min(height * 0.40, 360));
  return <ImageBackground source={require('../../../../assets/images/auth-bg.png')} style={{ flex: 1, backgroundColor: '#EAF7FF' }} resizeMode="cover">
    <Stack.Screen options={{ headerShown: false }} /><StatusBar barStyle="dark-content" />
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: topSpace, paddingBottom: 28 }}>
          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 20, paddingVertical: 22, shadowColor: '#164E87', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
            <Text accessibilityRole="header" style={{ fontSize: 25, fontWeight: '700', color: '#0877F9', textAlign: 'center', marginBottom: 12 }}>{title}</Text>
            {subtitle && <Text style={{ fontSize: 15, lineHeight: 22, color: '#4B5563', textAlign: 'center', marginBottom: 14 }}>{subtitle}</Text>}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </ImageBackground>;
}
