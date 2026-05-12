/**
 * Login Screen — Dark luxury aesthetic with gradient accents.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please fill all fields');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      Alert.alert('Login Failed', e.response?.data?.detail || 'Check your credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <Text style={s.logo}>FitGenome</Text>
        <Text style={s.tagline}>AI-Powered Fitness</Text>

        <View style={s.form}>
          <TextInput style={s.input} placeholder="Email" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={s.input} placeholder="Password" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />

          <Pressable onPress={handleLogin} style={s.btn}>
            <LinearGradient colors={Colors.gradientPurpleCyan} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Sign In</Text>}
            </LinearGradient>
          </Pressable>

          <Link href="/(auth)/register" style={s.link}>
            <Text style={s.linkText}>Don't have an account? <Text style={{ color: Colors.lavender }}>Sign Up</Text></Text>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  logo: { fontSize: 42, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  tagline: { fontSize: FontSize.md, color: Colors.lavender, textAlign: 'center', marginTop: 4, marginBottom: Spacing.xxl },
  form: { gap: Spacing.md },
  input: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, paddingHorizontal: 16, paddingVertical: 14, fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.cardBorder },
  btn: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginTop: Spacing.sm },
  btnGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: BorderRadius.lg },
  btnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#000' },
  link: { marginTop: Spacing.lg, alignSelf: 'center' },
  linkText: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
