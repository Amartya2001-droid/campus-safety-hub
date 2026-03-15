import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS, EMERGENCY_CONTACTS } from '../src/constants/theme';

export default function EmergencyContactsScreen() {
  const router = useRouter();

  const callNumber = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/[^0-9]/g, '')}`);
  };

  const renderContact = ({ item }: { item: typeof EMERGENCY_CONTACTS[0] }) => (
    <TouchableOpacity
      style={styles.contactCard}
      onPress={() => callNumber(item.phone)}
      activeOpacity={0.7}
    >
      <View style={styles.contactIcon}>
        <Ionicons name={item.icon as any} size={24} color={COLORS.white} />
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPhone}>{item.phone}</Text>
      </View>
      <View style={styles.callButton}>
        <Ionicons name="call" size={24} color={COLORS.secondary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={COLORS.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Contacts</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={COLORS.info} />
          <Text style={styles.infoText}>
            Tap any contact to call directly. For life-threatening emergencies, always call 911.
          </Text>
        </View>

        <FlatList
          data={EMERGENCY_CONTACTS}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.gray[800],
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[600],
    marginLeft: SPACING.sm,
    lineHeight: 20,
  },
  listContent: {
    gap: SPACING.md,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.md,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  contactName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.gray[800],
  },
  contactPhone: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.gray[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
