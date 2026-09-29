import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '../../store/useAppStore';

export default function ProfileScreen() {
  const router = useRouter();
  const currentClass = useAppStore((state) => state.currentClass);
  const logout = useAppStore((state) => state.logout);

  const userName = "Nguyễn Văn A";
  const userEmail = "A@gmail.com";

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1 bg-white pt-12">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-4 pb-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} className="p-2">
          <Text className="text-xl font-bold">{'<'}</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold mr-8">Hồ sơ cá nhân</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        <View className="items-center mt-6">
          <View className="w-24 h-24 bg-gray-300 rounded-full mb-3 justify-center items-center overflow-hidden">
             <Text className="text-4xl">👤</Text>
          </View>
          <Text className="text-xl font-bold text-gray-800">{userName}</Text>
          <Text className="text-gray-500 mt-1">✉️ {userEmail}</Text>
        </View>

        <TouchableOpacity 
          className="bg-gray-100 rounded-2xl p-5 mt-8 flex-row items-center justify-between"
          onPress={() => router.push('/(main)/select-class')}
        >
          <View>
            <Text className="text-blue-600 font-bold text-xs uppercase mb-1">🚗 HẠNG BẰNG ĐANG HỌC</Text>
            <Text className="text-2xl font-black text-gray-800">{currentClass.toUpperCase()}</Text>
            <Text className="text-gray-500 text-xs mt-1">Bấm để thay đổi hạng bằng</Text>
          </View>
          <Text className="text-4xl">🏍️</Text>
        </TouchableOpacity>

        <Text className="text-lg font-bold text-gray-800 mt-8 mb-4">Thông tin tài khoản</Text>
        <View className="bg-gray-100 rounded-2xl p-5 space-y-4">
          <View className="flex-row items-center mb-4">
            <Text className="text-xl mr-3">👤</Text>
            <View>
              <Text className="text-xs text-gray-500 font-bold">Họ tên</Text>
              <Text className="text-gray-800 font-semibold">{userName}</Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <Text className="text-xl mr-3">✉️</Text>
            <View>
              <Text className="text-xs text-gray-500 font-bold">Email</Text>
              <Text className="text-gray-800 font-semibold">{userEmail}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={handleLogout} className="bg-red-500 rounded-xl py-4 items-center mt-10 shadow-sm shadow-red-200">
          <Text className="text-white font-bold text-lg">Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
