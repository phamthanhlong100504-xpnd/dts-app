import { Stack, router } from 'expo-router';
import { Text, View, Pressable } from 'react-native';
import { useLearnerSession } from '../../session/session-store';
import { LicenseChoices } from '../../session/components/study-license-picker';
import { logoutAccount } from '../../auth/account-service';
export default function SettingsScreen() {
  const session = useLearnerSession((state) => state.session);
  if (!session) return null;
  const selected = session.profile.selectedLicenseClass;
  return <>
    <Stack.Screen options={{ title: 'Chọn hạng bằng lái', headerShown: true, headerTitleAlign: 'center', headerBackVisible: !!selected, headerRight: undefined }} />
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
      <LicenseChoices onDone={() => router.dismissTo('/home')} />
      {!selected && <Pressable accessibilityRole="button" onPress={() => { void logoutAccount().then(() => router.replace('/login')); }} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 18 }}><Text style={{ color: '#4B5563', fontSize: 15 }}>Đăng xuất</Text></Pressable>}
    </View>
  </>;
}
