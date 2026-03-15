import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { sosAPI } from '../src/services/api';
import { COLORS, GRADIENTS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../src/constants/theme';

const { width, height } = Dimensions.get('window');

type SOSState = 'type' | 'countdown' | 'sent';

const EMERGENCY_TYPES = [
  { id: 'medical', label: 'Medical Emergency', icon: 'medkit', color: '#e53e3e' },
  { id: 'unsafe', label: 'Unsafe Situation', icon: 'warning', color: '#ecc94b' },
  { id: 'crime', label: 'Crime in Progress', icon: 'alert', color: '#805ad5' },
  { id: 'other', label: 'Other Emergency', icon: 'help-circle', color: '#3182ce' },
];

export default function SOSScreen() {
  const router = useRouter();
  const [state, setState] = useState<SOSState>('type');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [location, setLocation] = useState<any>(null);
  const [sosId, setSosId] = useState<string | null>(null);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getLocation();
  }, []);

  useEffect(() => {
    if (state === 'countdown') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();

      const timer = setInterval(() => {
        Animated.sequence([
          Animated.timing(countdownScale, { toValue: 1.2, duration: 100, useNativeDriver: true }),
          Animated.timing(countdownScale, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();

        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            sendSOS();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [state]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const startCountdown = (type?: string) => {
    setSelectedType(type || null);
    setState('countdown');
  };

  const sendSOS = async () => {
    try {
      const response = await sosAPI.create({
        location_lat: location?.lat || 45.0875,
        location_lng: location?.lng || -64.3665,
        alert_type: selectedType || undefined,
      });
      setSosId(response.data.id);
      setState('sent');
    } catch (error) {
      Alert.alert('Error', 'Failed to send SOS alert. Please call security directly.');
      setState('type');
    }
  };

  const cancelSOS = async () => {
    if (sosId) {
      try {
        await sosAPI.cancel(sosId);
      } catch (error) {
        console.log('Error cancelling SOS:', error);
      }
    }
    router.back();
  };

  const callSecurity = () => {
    Linking.openURL('tel:9025851103');
  };

  if (state === 'type') {
    return (
      <LinearGradient colors={GRADIENTS.dark} style={styles.container} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }}>
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.typeContent}>
            <View style={styles.typeIcon}>
              <Ionicons name="warning" size={48} color={COLORS.accent} />
            </View>
            <Text style={styles.typeTitle}>What type of emergency?</Text>
            <Text style={styles.typeSubtitle}>Select for faster response</Text>
            <View style={styles.typeGrid}>
              {EMERGENCY_TYPES.map((type) => (
                <TouchableOpacity key={type.id} style={styles.typeButton} onPress={() => startCountdown(type.id)} activeOpacity={0.8}>
                  <View style={[styles.typeButtonIcon, { backgroundColor: type.color + '20' }]}>
                    <Ionicons name={type.icon as any} size={24} color={type.color} />
                  </View>
                  <Text style={styles.typeLabel}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.sosNowButton} onPress={() => startCountdown()} activeOpacity={0.9}>
              <LinearGradient colors={GRADIENTS.red} style={styles.sosNowGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.sosNowText}>SEND SOS NOW</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (state === 'countdown') {
    return (
      <LinearGradient colors={GRADIENTS.red} style={styles.container} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }], opacity: 0.3 }]} />
        <Animated.View style={[styles.pulseCircle2, { transform: [{ scale: pulseAnim }], opacity: 0.2 }]} />
        <SafeAreaView style={styles.countdownSafeArea}>
          <View style={styles.countdownContent}>
            <View style={styles.countdownCircle}>
              <Animated.Text style={[styles.countdownNumber, { transform: [{ scale: countdownScale }] }]}>{countdown}</Animated.Text>
            </View>
            <Text style={styles.countdownText}>Sending emergency alert...</Text>
            <Text style={styles.countdownSubtext}>{selectedType ? EMERGENCY_TYPES.find(t => t.id === selectedType)?.label : 'SOS Alert'}</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={() => { setState('type'); setCountdown(3); }} activeOpacity={0.8}>
              <Text style={styles.cancelButtonText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={GRADIENTS.green} style={styles.container} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }}>
      <SafeAreaView style={styles.sentSafeArea}>
        <View style={styles.sentContent}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={56} color={COLORS.white} />
          </View>
          <Text style={styles.sentTitle}>Help is on the way!</Text>
          <Text style={styles.sentSubtitle}>Security has been notified</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationIconContainer}>
              <Ionicons name="location" size={24} color={COLORS.accent} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Your Location</Text>
              <Text style={styles.locationText}>{location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Acadia University Campus'}</Text>
            </View>
          </View>
          <View style={styles.sentActions}>
            <TouchableOpacity style={styles.callSecurityButton} onPress={callSecurity} activeOpacity={0.9}>
              <LinearGradient colors={GRADIENTS.red} style={styles.callSecurityGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="call" size={22} color={COLORS.white} />
                <Text style={styles.callSecurityText}>Call Security</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imSafeButton} onPress={cancelSOS} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.secondary} />
              <Text style={styles.imSafeText}>I'm Safe - Cancel Alert</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.securityNumber}>Acadia Security: 902-585-1103</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  closeButton: { alignSelf: 'flex-end', padding: SPACING.md },
  typeContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg },
  typeIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(229, 62, 62, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  typeTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.white, textAlign: 'center' },
  typeSubtitle: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.xs },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: SPACING.xl, gap: SPACING.md },
  typeButton: { width: (width - SPACING.lg * 3) / 2, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, alignItems: 'center', ...SHADOWS.card },
  typeButtonIcon: { width: 48, height: 48, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  typeLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary, textAlign: 'center' },
  sosNowButton: { marginTop: SPACING.xxl, borderRadius: BORDER_RADIUS.full, overflow: 'hidden', ...SHADOWS.buttonRed },
  sosNowGradient: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl },
  sosNowText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.white, letterSpacing: 1 },
  countdownSafeArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pulseCircle: { position: 'absolute', top: height / 2 - 150, left: width / 2 - 150, width: 300, height: 300, borderRadius: 150, backgroundColor: COLORS.white },
  pulseCircle2: { position: 'absolute', top: height / 2 - 200, left: width / 2 - 200, width: 400, height: 400, borderRadius: 200, backgroundColor: COLORS.white },
  countdownContent: { alignItems: 'center' },
  countdownCircle: { width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 4, borderColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  countdownNumber: { fontSize: 80, fontWeight: FONT_WEIGHT.extrabold, color: COLORS.white },
  countdownText: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: COLORS.white, marginTop: SPACING.xl },
  countdownSubtext: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.8)', marginTop: SPACING.xs },
  cancelButton: { backgroundColor: COLORS.white, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl, borderRadius: BORDER_RADIUS.full, marginTop: SPACING.xxl },
  cancelButtonText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.accent, letterSpacing: 1 },
  sentSafeArea: { flex: 1 },
  sentContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg },
  checkCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  sentTitle: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
  sentSubtitle: { fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.9)', marginTop: SPACING.xs },
  locationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginTop: SPACING.xl, width: '100%', ...SHADOWS.card },
  locationIconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fed7d7', alignItems: 'center', justifyContent: 'center' },
  locationInfo: { flex: 1, marginLeft: SPACING.md },
  locationLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  locationText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, color: COLORS.textPrimary, marginTop: 2 },
  sentActions: { width: '100%', marginTop: SPACING.xl, gap: SPACING.md },
  callSecurityButton: { borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', ...SHADOWS.buttonRed },
  callSecurityGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md },
  callSecurityText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.white, marginLeft: SPACING.sm },
  imSafeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, ...SHADOWS.card },
  imSafeText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.secondary, marginLeft: SPACING.sm },
  securityNumber: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.8)', marginTop: SPACING.xl },
});
