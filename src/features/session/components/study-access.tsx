import { Fragment, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useLearnerSession } from '../session-store';
import { useStudyHost } from '../study-host';
import { LicenseChoices } from './study-license-picker';

export function StudyAccess({ children }: { children: ReactNode }) {
  const session = useLearnerSession((state) => state.session);
  const version = useLearnerSession((state) => state.version);
  const { openSignIn } = useStudyHost();
  if (!session) {
    return <>
      <Stack.Screen options={{ headerShown: true, title: 'DTS', headerTitleAlign: 'center' }} />
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-lg leading-7 text-gray-800">Vui lòng đăng nhập để tiếp tục học.</Text>
        {openSignIn && <Pressable accessibilityRole="button" onPress={openSignIn}
          className="mt-4 min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6">
          <Text className="text-base font-semibold text-white">Đăng nhập</Text>
        </Pressable>}
      </View>
    </>;
  }
  if (!session.profile.selectedLicenseClass) return <>
    <Stack.Screen options={{ headerShown: true, title: 'Chọn hạng bằng', headerTitleAlign: 'center' }} />
    <View className="flex-1 bg-white p-6">
      <Text className="mb-4 text-lg font-bold text-gray-900">Chọn hạng bằng để bắt đầu học</Text>
      <LicenseChoices onDone={() => {}} />
    </View>
  </>;
  return <Fragment key={JSON.stringify([session.profile.id, session.profile.selectedLicenseClass, version])}>{children}</Fragment>;
}
