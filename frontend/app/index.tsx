import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { COLORS, GRADIENTS, FONT_SIZE, FONT_WEIGHT, SPACING, BORDER_RADIUS } from '../src/constants/theme';
import { seedData } from '../src/services/api';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [seeding, setSeeding] = useState(true);
  const loadingWidth = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo animation
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Loading bar animation
    Animated.timing(loadingWidth, {
      toValue: width * 0.6,
      duration: 2000,
      useNativeDriver: false,
    }).start();

    initApp();
  }, []);

  useEffect(() => {
    if (!isLoading && !seeding) {
      setTimeout(() => {
        if (user) {
          router.replace('/(tabs)');
        } else {
          router.replace('/login');
        }
      }, 500);
    }
  }, [isLoading, seeding, user]);

  const initApp = async () => {
    try {
      await seedData();
    } catch (error) {
      console.log('Seed error (may already exist):', error);
    }
    setTimeout(() => {
      setSeeding(false);
    }, 1500);
  };

  return (
    <LinearGradient
      colors={GRADIENTS.dark}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Decorative circles */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />
      
      <Animated.View 
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: logoScale }],
            opacity: logoOpacity,
          }
        ]}
      >
        <View style={styles.logoBox}>
          <Ionicons name="shield-checkmark" size={48} color={COLORS.navy[800]} />
        </View>
        <Text style={styles.title}>Acadia Safe</Text>
        <Text style={styles.subtitle}>Campus Safety Companion</Text>
      </Animated.View>

      {/* Loading bar */}
      <View style={styles.loadingContainer}>
        <View style={styles.loadingTrack}>
          <Animated.View 
            style={[
              styles.loadingBar,
              { width: loadingWidth }
            ]} 
          />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: FONT_WEIGHT.extrabold,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.info,
    marginTop: SPACING.xs,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  loadingTrack: {
    width: width * 0.6,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 2,
  },
});
