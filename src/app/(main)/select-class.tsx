import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '../../store/useAppStore';

const LICENSE_CLASSES = [
  { id: 'A1', title: 'Hạng A1', desc: 'Xe mô tô hai bánh có dung tích xi-lanh đến 125cm3 hoặc công suất động cơ điện đến 11kW' },
  { id: 'A', title: 'Hạng A', desc: 'Xe mô tô hai bánh có dung tích xi-lanh trên 125cm3 hoặc công suất động cơ điện trên 11kW và hạng A1' },
  { id: 'B1', title: 'Hạng B1', desc: 'Lái xe mô tô ba bánh và các loại xe hạng A1' },
  { id: 'B2', title: 'Hạng B2', desc: 'Lái xe ô tô đến 9 chỗ ngồi; ô tô tải dưới 3.500 kg' },
  { id: 'C', title: 'Hạng C', desc: 'Lái xe ô tô tải chuyên dùng trên 3.500 kg...' },
];

export default function SelectClassScreen() {
  const router = useRouter();
  const currentClass = useAppStore((state) => state.currentClass);
  const setCurrentClass = useAppStore((state) => state.setCurrentClass);

  const handleSelect = async (id: string) => {
    try {
      // 1. Gọi API lưu lên Redis thông qua dts-gateway
      // (Bỏ comment khi có Token thật)
      /*
      const response = await fetch('http://103.20.96.56:8888/api/v1/progress/preferences/learning-program', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN_HERE' // Lấy từ Zustand/Storage
        },
        body: JSON.stringify({ programCode: id })
      });
      if (!response.ok) throw new Error('Network error');
      */
      
      // 2. Lưu vào Zustand (Local Cache)
      setCurrentClass(`Hạng ${id}`);
      router.back();
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể đồng bộ hạng bằng, vui lòng thử lại!');
    }
  };

  return (
    <View className="flex-1 bg-white pt-12">
      <StatusBar style="dark" />
      <View className="flex-row items-center px-4 pb-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Text className="text-xl font-bold">{'<'}</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold mr-8">Chọn hạng bằng lái</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {LICENSE_CLASSES.map((item) => {
          const isActive = currentClass === `Hạng ${item.id}`;
          return (
            <TouchableOpacity 
              key={item.id}
              onPress={() => handleSelect(item.id)}
              className={`mb-3 p-4 rounded-xl ${isActive ? 'bg-blue-600' : 'bg-gray-100'}`}
            >
              <Text className={`text-center text-lg font-bold mb-1 ${isActive ? 'text-white' : 'text-gray-800'}`}>
                {item.title}
              </Text>
              <Text className={`text-center text-sm leading-5 ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
                {item.desc}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  );
}
