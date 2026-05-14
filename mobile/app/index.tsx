import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ImageBackground, Pressable, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontWeight, FontSize, BorderRadius, Spacing } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

export default function LandingPage() {
  const router = useRouter();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleStart = () => {
    router.push('/(auth)/login');
  };

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      
      <ImageBackground
        source={require('@/assets/images/landing_bg.png')}
        style={s.bg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)', Colors.background]}
          style={s.overlay}
        >
          <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }]}>
            <View style={s.logoContainer}>
              <View style={s.logoIcon}>
                <Ionicons name="fitness" size={32} color={Colors.mint} />
              </View>
              <Text style={s.title}>FitGenome <Text style={{ color: Colors.mint }}>AI</Text></Text>
            </View>

            <Text style={s.tagline}>Unlock Your Genetic Potential</Text>
            
            <Text style={s.description}>
              The world's first AI coach powered by genomic insights. Personalized workouts and nutrition, designed for your DNA.
            </Text>

            <View style={s.featureGrid}>
              <FeatureItem icon="flash" text="Real-time Projections" />
              <FeatureItem icon="nutrition" text="Genomic Nutrition" />
              <FeatureItem icon="trending-up" text="Dynamic Progress" />
            </View>

            <Pressable onPress={handleStart} style={s.btn}>
              <LinearGradient
                colors={Colors.gradientPurpleCyan}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.btnGrad}
              >
                <Text style={s.btnText}>GET STARTED</Text>
                <Ionicons name="arrow-forward" size={20} color="#000" />
              </LinearGradient>
            </Pressable>

            <View style={s.footer}>
              <Text style={s.footerText}>Already part of the elite? </Text>
              <Pressable onPress={() => router.push('/(auth)/login')}>
                <Text style={s.loginLink}>Login</Text>
              </Pressable>
            </View>
          </Animated.View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: any, text: string }) {
  return (
    <View style={s.featureItem}>
      <Ionicons name={icon} size={18} color={Colors.mint} />
      <Text style={s.featureText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bg: { width: width, height: height },
  overlay: { flex: 1, justifyContent: 'flex-end', paddingBottom: 60 },
  content: { paddingHorizontal: Spacing.xl, alignItems: 'center' },
  
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md },
  logoIcon: { width: 50, height: 50, borderRadius: 12, backgroundColor: 'rgba(126,222,196,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(126,222,196,0.2)' },
  title: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  
  tagline: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm },
  description: { fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.xl },
  
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginBottom: 40 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  featureText: { fontSize: 12, color: '#fff', fontWeight: '600' },

  btn: { width: '100%', height: 60, borderRadius: BorderRadius.xl, overflow: 'hidden' },
  btnGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnText: { fontSize: 18, fontWeight: '900', color: '#000', letterSpacing: 1 },

  footer: { flexDirection: 'row', marginTop: Spacing.xl, alignItems: 'center' },
  footerText: { color: Colors.textMuted, fontSize: 14 },
  loginLink: { color: Colors.mint, fontWeight: '700', fontSize: 14 },
});
