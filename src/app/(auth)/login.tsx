import { View, Text, TextInput, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <ImageBackground 
      source={require('../../../assets/images/auth-bg.png')} 
      className="flex-1"
      resizeMode="cover"
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
          {/* Header Chữ */}
          <View className="items-center mt-10 mb-20">
            <Text className="text-blue-600 text-3xl font-black uppercase shadow-sm">ĐĂNG NHẬP</Text>
          </View>

          {/* Form */}
          <View className="px-6">
            <View className="bg-white/90 rounded-[30px] p-6 shadow-md shadow-gray-300">
              <Text className="text-gray-700 font-bold mb-2 ml-1 text-base">Tên đăng nhập</Text>
              <TextInput 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 mb-4 text-gray-800 text-base"
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChangeText={setUsername}
              />

              <Text className="text-gray-700 font-bold mb-2 ml-1 text-base">Mật khẩu</Text>
              <TextInput 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 mb-8 text-gray-800 text-base"
                placeholder="Nhập mật khẩu"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity 
                className="w-full bg-[#1d4ed8] rounded-xl py-4 items-center shadow-sm shadow-blue-500"
                onPress={() => router.replace('/(main)/profile')}
              >
                <Text className="text-white font-bold text-lg">Đăng nhập</Text>
              </TouchableOpacity>

              <View className="flex-row justify-center mt-6 mb-2">
                <Text className="text-gray-500 text-base">Bạn chưa có tài khoản? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                  <Text className="text-[#3b82f6] font-bold text-base">Đăng ký ngay</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
