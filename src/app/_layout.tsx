import { useEffect } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useLearnerSession } from '../features/session/session-store';
import { StudyHostProvider } from '../features/session/study-host';
import '../global.css';
const PUBLIC = new Set(['/login', '/register', '/forgot-password']);
function RootStack() {
  const pathname = usePathname();
  const session = useLearnerSession((state) => state.session);
  useEffect(() => {
    if (!session && !PUBLIC.has(pathname)) router.replace('/login');
    else if (session && !session.profile.selectedLicenseClass && pathname !== '/settings') router.replace('/settings');
    else if (session?.profile.selectedLicenseClass && PUBLIC.has(pathname)) router.replace('/home');
  }, [pathname, session]);
  return <StudyHostProvider actions={{ openSignIn: () => router.replace('/login') }}>
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#FFFFFF' }, headerTintColor: '#111827', headerTitleAlign: 'center', headerTitleStyle: { fontSize: 18, fontWeight: '600' }, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: '#FFFFFF' } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} /><Stack.Screen name="register" options={{ headerShown: false }} /><Stack.Screen name="forgot-password" options={{ headerShown: false }} />
    </Stack>
  </StudyHostProvider>;
}
export default function RootLayout() { return <SafeAreaProvider><RootStack /></SafeAreaProvider>; }
