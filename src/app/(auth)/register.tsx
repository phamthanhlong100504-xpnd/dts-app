import { View, Text, TextInput, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RegisterScreen() {
  const router = useRouter();

  return (
    <ImageBackground 
      source={require('../../../assets/images/auth-bg.png')} 
      className="flex-1"
      resizeMode="cover"
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-6 pt-16" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          <View className="items-center mb-8">
            <Text className="text-blue-600 text-3xl font-black uppercase shadow-sm">ĐĂNG KÝ</Text>
          </View>

          <View className="bg-white/95 rounded-[30px] p-6 shadow-md shadow-gray-300">
            <Text className="text-gray-700 font-bold mb-2 ml-1 text-base">Tên đăng nhập</Text>
            <TextInput className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-800 text-base" placeholder="Nhập tên đăng nhập" />

            <Text className="text-gray-700 font-bold mb-2 ml-1 text-base">Email</Text>
            <TextInput className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-800 text-base" placeholder="Nhập email của bạn" keyboardType="email-address" />

            <Text className="text-gray-700 font-bold mb-2 ml-1 text-base">Mật khẩu</Text>
            <TextInput className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-800 text-base" placeholder="Nhập mật khẩu" secureTextEntry />

            <Text className="text-gray-700 font-bold mb-2 ml-1 text-base">Họ và tên</Text>
            <TextInput className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-800 text-base" placeholder="Nguyễn Văn A" />

            <Text className="text-gray-700 font-bold mb-2 ml-1 text-base">Ngày sinh (dd/mm/yyyy)</Text>
            <TextInput className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-800 text-base" placeholder="Chọn ngày sinh" />

            <Text className="text-gray-700 font-bold mb-2 ml-1 text-base">Số điện thoại</Text>
            <TextInput className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 text-gray-800 text-base" placeholder="Nhập số điện thoại" keyboardType="phone-pad" />

            <TouchableOpacity className="w-full bg-[#1d4ed8] rounded-xl py-4 items-center shadow-sm shadow-blue-500">
              <Text className="text-white font-bold text-lg">Đăng ký</Text>
            </TouchableOpacity>

            <View className="flex-row justify-center mt-6 mb-2">
              <Text className="text-gray-500 text-base">Bạn đã có tài khoản? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text className="text-[#3b82f6] font-bold text-base">Đăng nhập</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
