import { useCallback, useRef, useState } from 'react';
import { Stack, router } from 'expo-router';
import { Modal, Pressable, ScrollView, Text, View, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reloadLearnerProfile } from '../../session/session-service';
import { useLearnerSession } from '../../session/session-store';
import { useLearnerResource } from '../../session/use-learner-resource';
import { changeAccountPassword, logoutAccount, sendRegistrationCode, verifyRegistrationCode } from '../../auth/account-service';
import { FormField } from '../../auth/components/form-field';
import { AppButton, AppIcon, Message } from '../../shared/ui';
function Info({ label, value }: { label: string; value?: string | null }) { return <View style={{ paddingVertical: 10 }}><Text style={{ fontSize: 14, color: '#4B5563', marginBottom: 5 }}>{label}</Text><Text selectable style={{ fontSize: 16, lineHeight: 23, color: '#111827', fontWeight: '500' }}>{value || 'Chưa cập nhật'}</Text></View>; }
export default function ProfileScreen() {
  const session = useLearnerSession((state) => state.session);
  const load = useCallback(() => reloadLearnerProfile(), []), resource = useLearnerResource('account-profile', load);
  const insets = useSafeAreaInsets();
  const [panel, setPanel] = useState<'password' | 'verify' | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const [oldPassword, setOld] = useState(''), [newPassword, setNew] = useState(''), [confirmation, setConfirmation] = useState(''), [code, setCode] = useState('');
  const lock = useRef(false), profile = resource.data ?? session?.profile;
  function close() { if (lock.current) return; setPanel(null); setError(null); setNotice(null); setOld(''); setNew(''); setConfirmation(''); setCode(''); }
  async function run(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(null);
    const version = useLearnerSession.getState().version;
    try { await action(); }
    catch (failure) { if (useLearnerSession.getState().version === version) setError(failure instanceof Error ? failure.message : 'Không thực hiện được yêu cầu.'); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!session || !profile) return null;
  return <>
    <Stack.Screen options={{ title: 'Hồ sơ cá nhân', headerShown: true, headerTitleAlign: 'center', headerRight: undefined }} />
    <ScrollView style={{ flex: 1, backgroundColor: '#FFFFFF' }} contentContainerStyle={{ padding: 18, paddingBottom: 24 + insets.bottom }} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={resource.reload} />}>
      {resource.error && <Message>{resource.error}</Message>}
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <View style={{ width: 74, height: 74, borderRadius: 40, borderWidth: 2, borderColor: '#0877F9', backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}><AppIcon name="user" size={52} color="#64748B" /></View>
        <Text style={{ fontSize: 22, fontWeight: '600', color: '#111827', textAlign: 'center', marginTop: 12 }}>{profile.fullName || profile.username}</Text>
        <Text selectable style={{ fontSize: 15, color: '#4B5563', textAlign: 'center', marginTop: 5 }}>{profile.email}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={{ backgroundColor: '#F3F4F6', borderRadius: 16, padding: 18, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}><Text style={{ fontSize: 13, fontWeight: '600', color: '#0877F9', marginBottom: 18 }}>HẠNG BẰNG ĐANG HỌC</Text><Text style={{ fontSize: 23, fontWeight: '700', color: '#111827' }}>{profile.selectedLicenseClass ? `Hạng ${profile.selectedLicenseClass}` : 'Chưa chọn hạng'}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18 }}><AppIcon name="edit" size={17} color="#4B5563" /><Text style={{ flexShrink: 1, fontSize: 14, lineHeight: 21, color: '#4B5563' }}>Bấm để thay đổi hạng bằng</Text></View></View><AppIcon name="study" size={36} />
      </Pressable>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 24, marginBottom: 12 }}>Thông tin tài khoản</Text>
      <View style={{ backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 8 }}>
        <Info label="Tên đăng nhập" value={profile.username} /><Info label="Họ và tên" value={profile.fullName} /><Info label="Email" value={profile.email} />
        <Info label="Ngày sinh" value={profile.birthOfDate?.split('-').reverse().join('/')} /><Info label="Số điện thoại" value={profile.phoneNumber} />
      </View>
      {profile.emailVerifiedAt === null && <View style={{ marginTop: 16 }}><AppButton secondary label="Xác thực email" onPress={() => { setError(null); setNotice(null); setPanel('verify'); }} /></View>}
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 24, marginBottom: 12 }}>Bảo mật</Text>
      <AppButton secondary label="Đổi mật khẩu" onPress={() => { setError(null); setNotice(null); setPanel('password'); }} />
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void run(async () => { await logoutAccount(); router.replace('/login'); }); }} style={{ alignSelf: 'center', minHeight: 46, marginTop: 20, backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Đăng xuất</Text></Pressable>
    </ScrollView>
    <Modal visible={!!panel} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 18, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, backgroundColor: '#00000066' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            <Text style={{ fontSize: 21, color: '#111827', fontWeight: '600', textAlign: 'center', marginBottom: 10 }}>{panel === 'password' ? 'Đổi mật khẩu' : 'Xác thực email'}</Text>
            {panel === 'password' ? <>
              <FormField label="Mật khẩu hiện tại" password value={oldPassword} onChangeText={setOld} editable={!busy} />
              <FormField label="Mật khẩu mới" placeholder="Từ 8 đến 100 ký tự" password value={newPassword} onChangeText={setNew} editable={!busy} />
              <FormField label="Xác nhận mật khẩu mới" password value={confirmation} onChangeText={setConfirmation} editable={!busy} />
            </> : <>
              <Text style={{ fontSize: 15, color: '#4B5563', lineHeight: 22 }}>Nhập mã gửi tới {profile.email}. Bạn có thể yêu cầu gửi lại mã bên dưới.</Text>
              <FormField label="Mã xác nhận" value={code} onChangeText={setCode} editable={!busy} keyboardType="number-pad" textContentType="oneTimeCode" />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void run(async () => { await sendRegistrationCode(profile.email); setNotice('Đã yêu cầu gửi mã. Kiểm tra email và thư rác.'); }); }} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}><Text style={{ fontSize: 15, color: '#0877F9' }}>Gửi lại mã xác nhận</Text></Pressable>
            </>}
            {error && <Message>{error}</Message>}{notice && <Message kind="info">{notice}</Message>}
            <View style={{ marginTop: 18, gap: 10 }}>
              <AppButton busy={busy} label={panel === 'password' ? 'Cập nhật mật khẩu' : 'Xác nhận'} onPress={() => { void run(async () => {
                if (panel === 'password') { if (newPassword !== confirmation) throw new Error('Mật khẩu xác nhận chưa khớp.'); await changeAccountPassword(oldPassword, newPassword); router.replace('/login'); }
                else { await verifyRegistrationCode(profile.email, code); setNotice('Email đã được xác thực.'); setPanel(null); resource.reload(); }
              }); }} /><View style={{ alignSelf: 'center' }}><AppButton secondary disabled={busy} label="Đóng" onPress={close} /></View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
