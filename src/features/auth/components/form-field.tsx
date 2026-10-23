import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { AppIcon } from '../../shared/ui';
export function FormField({ label, password, ...props }: TextInputProps & { label: string; password?: boolean }) {
  const [shown, setShown] = useState(false);
  return <View style={{ marginTop: 12 }}>
    <Text style={{ fontSize: 15, color: '#1F2937', fontWeight: '600', marginBottom: 7 }}>{label}</Text>
    <View style={{ minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: '#D9E1EC', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center' }}>
      <TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? label} secureTextEntry={password && !shown} autoCapitalize={props.autoCapitalize ?? 'none'} autoCorrect={false} placeholderTextColor="#7A8595"
        style={{ flex: 1, minWidth: 0, minHeight: 48, fontSize: 16, color: '#111827', paddingHorizontal: 12, paddingVertical: 10 }} />
      {password && <Pressable accessibilityRole="button" accessibilityLabel={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShown(!shown)} style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><AppIcon name={shown ? 'hidden' : 'eye'} size={20} color="#536278" /></Pressable>}
    </View>
  </View>;
}
