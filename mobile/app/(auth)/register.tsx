/**
 * Register Screen — Create new account.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) return Alert.alert('Error', 'Please fill all fields');
    if (password.length < 8) return Alert.alert('Error', 'Password must be at least 8 characters');
    setLoading(true);
    try {
      await register(email, password, name);
    } catch (e: any) {
      Alert.alert('Registration Failed', e.response?.data?.detail || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <Text style={s.title}>Create Account</Text>
        <Text style={s.subtitle}>Start your fitness journey with AI</Text>

        <View style={s.form}>
          <TextInput style={s.input} placeholder="Full Name" placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} />
          <TextInput style={s.input} placeholder="Email" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={s.input} placeholder="Password (8+ chars)" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />

          <Pressable onPress={handleRegister} style={s.btn}>
            <LinearGradient colors={Colors.gradientCoralGold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Create Account</Text>}
            </LinearGradient>
          </Pressable>

          <Link href="/(auth)/login" style={s.link}>
            <Text style={s.linkText}>Already have an account? <Text style={{ color: Colors.coral }}>Sign In</Text></Text>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, color: Colors.coral, textAlign: 'center', marginTop: 4, marginBottom: Spacing.xxl },
  form: { gap: Spacing.md },
  input: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, paddingHorizontal: 16, paddingVertical: 14, fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.cardBorder },
  btn: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginTop: Spacing.sm },
  btnGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: BorderRadius.lg },
  btnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#000' },
  link: { marginTop: Spacing.lg, alignSelf: 'center' },
  linkText: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
