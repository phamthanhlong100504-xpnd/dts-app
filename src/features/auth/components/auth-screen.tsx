import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { signInLearner } from '../../session/session-service';
import { useLearnerSession } from '../../session/session-store';
import { AppButton, Message } from '../../shared/ui';
import { parseBirthDate, registerAccount, requestPasswordReset, resetAccountPassword, signedInDestination } from '../account-service';
import { AuthFrame } from './auth-frame';
import { FormField } from './form-field';
export default function AuthScreen({ kind }: { kind: 'login' | 'register' | 'forgot' }) {
  const [values, setValues] = useState({ username: '', password: '', email: '', fullName: '', birth: '', phone: '', code: '', confirmation: '' });
  const [phase, setPhase] = useState<'request' | 'reset' | 'done'>('request');
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const lock = useRef(false), alive = useRef(true), pendingVersion = useRef<number | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; const state = useLearnerSession.getState(); if (lock.current && !state.session && state.version === pendingVersion.current) state.clear(); }; }, []);
  const field = (key: keyof typeof values) => ({ value: values[key], onChangeText: (value: string) => setValues((current) => ({ ...current, [key]: value })), editable: !busy });
  async function submit() {
    if (lock.current) return; lock.current = true; setBusy(true); setError(null);
    try {
      if (kind !== 'forgot') pendingVersion.current = useLearnerSession.getState().version + 1;
      if (kind === 'login') { await signInLearner(values.username, values.password); if (useLearnerSession.getState().session) router.replace(signedInDestination()); }
      if (kind === 'register') {
        await registerAccount({ username: values.username, password: values.password, email: values.email, fullName: values.fullName, birthOfDate: parseBirthDate(values.birth), phoneNumber: values.phone });
        if (useLearnerSession.getState().session) router.replace(signedInDestination());
      }
      if (kind === 'forgot' && phase === 'request') { await requestPasswordReset(values.username); if (alive.current) setPhase('reset'); }
      else if (kind === 'forgot' && phase === 'reset') {
        if (values.password !== values.confirmation) throw new Error('Mật khẩu xác nhận chưa khớp.');
        await resetAccountPassword(values.username, values.code, values.password); if (alive.current) { setValues((current) => ({ ...current, password: '', confirmation: '', code: '' })); setPhase('done'); }
      }
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : 'Không thực hiện được yêu cầu.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const title = kind === 'register' ? 'ĐĂNG KÝ' : kind === 'forgot' ? 'QUÊN MẬT KHẨU' : 'ĐĂNG NHẬP';
  return <AuthFrame title={title} kind={kind} subtitle={kind === 'forgot' ? 'Đặt lại mật khẩu bằng mã xác nhận gửi tới email tài khoản.' : undefined}>
    {kind === 'forgot' && phase === 'done' ? <>
      <Message kind="info">Mật khẩu đã được cập nhật. Đăng nhập lại để tiếp tục.</Message>
      <AppButton label="Về đăng nhập" onPress={() => router.replace('/login')} />
    </> : <>
      {kind === 'forgot' && phase === 'reset' && <Message kind="info">Nếu tài khoản tồn tại, mã đã được gửi qua email. Kiểm tra cả thư rác.</Message>}
      <FormField label={kind === 'forgot' ? 'Tên đăng nhập hoặc email' : 'Tên đăng nhập'} placeholder={kind === 'forgot' ? 'Nhập tài khoản cần khôi phục' : 'Nhập tên đăng nhập'} {...field('username')} editable={!busy && phase !== 'reset'} autoComplete="username" />
      {kind === 'register' && <FormField label="Email" placeholder="Nhập email của bạn" keyboardType="email-address" {...field('email')} autoComplete="email" />}
      {(kind !== 'forgot' || phase === 'reset') && <>
        {kind === 'forgot' && <FormField label="Mã xác nhận" placeholder="Mã nhận được qua email" {...field('code')} keyboardType="number-pad" textContentType="oneTimeCode" />}
        <FormField label={kind === 'forgot' ? 'Mật khẩu mới' : 'Mật khẩu'} placeholder={kind === 'login' ? 'Nhập mật khẩu' : 'Từ 8 đến 100 ký tự'} password {...field('password')} autoComplete={kind === 'login' ? 'current-password' : 'new-password'} />
        {kind === 'forgot' && <FormField label="Xác nhận mật khẩu mới" placeholder="Nhập lại mật khẩu mới" password {...field('confirmation')} />}
      </>}
      {kind === 'register' && <>
        <FormField label="Họ và tên" placeholder="Nhập họ và tên" {...field('fullName')} autoCapitalize="words" autoComplete="name" />
        <FormField label="Ngày sinh (dd/mm/yyyy)" placeholder="Ví dụ: 20/10/2000" {...field('birth')} keyboardType="numbers-and-punctuation" maxLength={10} />
        <FormField label="Số điện thoại" placeholder="Nhập số điện thoại liên hệ" {...field('phone')} keyboardType="phone-pad" autoComplete="tel" />
      </>}
      {error && <Message context={kind === 'login' ? 'login' : kind === 'register' ? 'register' : 'password'}>{error}</Message>}
      {kind === 'login' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.push('/forgot-password')} style={{ alignSelf: 'flex-end', paddingVertical: 12, minHeight: 44 }}><Text style={{ color: '#0877F9', fontSize: 15, fontWeight: '500' }}>Quên mật khẩu?</Text></Pressable>}
      <View style={{ marginTop: kind === 'login' ? 6 : 20 }}><AppButton label={kind === 'login' ? 'Đăng nhập' : kind === 'register' ? 'Đăng ký' : phase === 'request' ? 'Gửi mã xác nhận' : 'Đặt lại mật khẩu'} busy={busy} onPress={() => { void submit(); }} /></View>
      {kind === 'forgot' && phase === 'reset' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setPhase('request'); setError(null); }} style={{ alignSelf: 'center', padding: 12 }}><Text style={{ fontSize: 15, color: '#0877F9' }}>Thay tài khoản hoặc gửi lại mã</Text></Pressable>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
        <Text style={{ fontSize: 14, color: '#4B5563' }}>{kind === 'login' ? 'Bạn chưa có tài khoản?' : kind === 'register' ? 'Bạn đã có tài khoản?' : 'Nhớ mật khẩu rồi?'}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.replace(kind === 'login' ? '/register' : '/login')} style={{ padding: 10, minHeight: 44, justifyContent: 'center' }}><Text style={{ fontSize: 14, fontWeight: '600', color: '#0877F9' }}>{kind === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}</Text></Pressable>
      </View>
    </>}
  </AuthFrame>;
}
