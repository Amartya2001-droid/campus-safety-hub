import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { alertsAPI } from '../../src/services/api';
import { COLORS, GRADIENTS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, ALERT_TYPES } from '../../src/constants/theme';
import { format } from 'date-fns';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [latestAlert, setLatestAlert] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchLatestAlert();
    startPulseAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const fetchLatestAlert = async () => {
    try {
      const response = await alertsAPI.getAll();
      if (response.data.length > 0) {
        setLatestAlert(response.data[0]);
      }
    } catch (error) {
      console.log('Error fetching alerts:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLatestAlert();
    setRefreshing(false);
  };

  const firstName = user?.full_name?.split(' ')[0] || 'User';
  const userInitials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const quickActions = [
    { id: 'escort', title: 'Safety Escort', subtitle: 'Request a walk', icon: 'walk', colors: ['#ebf8ff', '#bee3f8'], iconColor: COLORS.info, route: '/escort-request' },
    { id: 'report', title: 'Report Incident', subtitle: 'Submit a report', icon: 'document-text', colors: ['#fffff0', '#fefcbf'], iconColor: COLORS.warning, route: '/incident-report' },
    { id: 'friend', title: 'Friend Walk', subtitle: 'Share location', icon: 'people', colors: ['#f0fff4', '#c6f6d5'], iconColor: COLORS.secondary, route: '/friend-walk' },
    { id: 'map', title: 'Campus Map', subtitle: 'Find resources', icon: 'map', colors: ['#faf5ff', '#e9d8fd'], iconColor: '#805ad5', route: '/(tabs)/map' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Gradient */}
        <LinearGradient
          colors={GRADIENTS.navy}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Decorative circle */}
          <View style={styles.decorativeCircle} />
          
          <SafeAreaView edges={['top']}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Text style={styles.welcomeLabel}>Welcome back,</Text>
                <Text style={styles.userName}>{firstName} 👋</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Campus is safe</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profile')}
                style={styles.avatarContainer}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{userInitials}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* SOS Button - Most Prominent */}
        <View style={styles.sosContainer}>
          <TouchableOpacity
            style={styles.sosButtonWrapper}
            onPress={() => router.push('/sos')}
            activeOpacity={0.9}
          >
            <Animated.View style={[styles.sosOuterRing, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.sosMiddleRing} />
            <LinearGradient
              colors={GRADIENTS.red}
              style={styles.sosButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="warning" size={36} color={COLORS.white} />
              <Text style={styles.sosText}>SOS</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.sosHint}>Tap for emergency assistance</Text>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionCard}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={action.colors}
                  style={styles.actionIconBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={action.icon as any} size={24} color={action.iconColor} />
                </LinearGradient>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Alert */}
        {latestAlert && (
          <View style={styles.alertSection}>
            <View style={styles.alertHeader}>
              <Text style={styles.sectionTitle}>Recent Alert</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/alerts')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={styles.alertCard}
              onPress={() => router.push('/(tabs)/alerts')}
              activeOpacity={0.8}
            >
              <View style={[
                styles.alertBorder,
                { backgroundColor: ALERT_TYPES[latestAlert.alert_type as keyof typeof ALERT_TYPES]?.color || COLORS.warning }
              ]} />
              <View style={styles.alertContent}>
                <View style={styles.alertTop}>
                  <View style={[
                    styles.alertBadge,
                    { backgroundColor: ALERT_TYPES[latestAlert.alert_type as keyof typeof ALERT_TYPES]?.bgColor || '#fefcbf' }
                  ]}>
                    <Ionicons
                      name={ALERT_TYPES[latestAlert.alert_type as keyof typeof ALERT_TYPES]?.icon as any || 'warning'}
                      size={14}
                      color={ALERT_TYPES[latestAlert.alert_type as keyof typeof ALERT_TYPES]?.color || COLORS.warning}
                    />
                    <Text style={[
                      styles.alertBadgeText,
                      { color: ALERT_TYPES[latestAlert.alert_type as keyof typeof ALERT_TYPES]?.color || COLORS.warning }
                    ]}>
                      {latestAlert.alert_type.charAt(0).toUpperCase() + latestAlert.alert_type.slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.alertTime}>
                    {format(new Date(latestAlert.created_at), 'h:mm a')}
                  </Text>
                </View>
                <Text style={styles.alertTitle} numberOfLines={1}>
                  {latestAlert.title}
                </Text>
                <Text style={styles.alertMessage} numberOfLines={2}>
                  {latestAlert.message}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Emergency Contacts Quick Access */}
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => router.push('/emergency-contacts')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={GRADIENTS.navy}
            style={styles.emergencyGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.emergencyIcon}>
              <Ionicons name="call" size={20} color={COLORS.white} />
            </View>
            <Text style={styles.emergencyText}>Emergency Contacts</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    paddingBottom: 80,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  decorativeCircle: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  headerLeft: {
    flex: 1,
  },
  welcomeLabel: {
    fontSize: FONT_SIZE.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  userName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 161, 105, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.secondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  avatarContainer: {
    marginLeft: SPACING.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.navy[800],
  },
  sosContainer: {
    alignItems: 'center',
    marginTop: -50,
  },
  sosButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 160,
  },
  sosOuterRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(229, 62, 62, 0.15)',
  },
  sosMiddleRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(229, 62, 62, 0.08)',
  },
  sosButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.buttonRed,
  },
  sosText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
    marginTop: SPACING.xs,
    letterSpacing: 1,
  },
  sosHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  actionsSection: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: (width - SPACING.md * 3) / 2,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  actionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  actionSubtitle: {
    fontSize: FONT_SIZE.tiny,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  alertSection: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  viewAllText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.navy[800],
    fontWeight: FONT_WEIGHT.medium,
  },
  alertCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  alertBorder: {
    width: 4,
  },
  alertContent: {
    flex: 1,
    padding: SPACING.md,
  },
  alertTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  alertBadgeText: {
    fontSize: FONT_SIZE.tiny,
    fontWeight: FONT_WEIGHT.semibold,
    marginLeft: SPACING.xs,
    textTransform: 'capitalize',
  },
  alertTime: {
    fontSize: FONT_SIZE.tiny,
    color: COLORS.textMuted,
  },
  alertTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  emergencyButton: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.buttonNavy,
  },
  emergencyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  emergencyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.white,
    marginLeft: SPACING.sm,
  },
});
