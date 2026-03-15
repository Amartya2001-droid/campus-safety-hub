import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { friendWalkAPI, contactsAPI } from '../src/services/api';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../src/constants/theme';
import Button from '../src/components/Button';
import Card from '../src/components/Card';
import Input from '../src/components/Input';

type FriendWalkState = 'setup' | 'active' | 'add-contact';

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 0, label: 'Until I stop' },
];

export default function FriendWalkScreen() {
  const router = useRouter();
  const [state, setState] = useState<FriendWalkState>('setup');
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState<any>(null);
  const [activeWalk, setActiveWalk] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Add contact form
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');

  useEffect(() => {
    fetchContacts();
    getLocation();
    checkActiveWalk();
  }, []);

  useEffect(() => {
    let timer: any;
    if (state === 'active' && activeWalk) {
      timer = setInterval(() => {
        const end = new Date(activeWalk.end_time).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((end - now) / 1000));
        setTimeRemaining(remaining);
        
        if (remaining === 0 && activeWalk.duration_minutes > 0) {
          handleComplete();
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [state, activeWalk]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      }
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await contactsAPI.getAll();
      setContacts(response.data);
    } catch (error) {
      console.log('Error fetching contacts:', error);
    }
  };

  const checkActiveWalk = async () => {
    try {
      const response = await friendWalkAPI.getActive();
      if (response.data) {
        setActiveWalk(response.data);
        setState('active');
      }
    } catch (error) {
      console.log('Error checking active walk:', error);
    }
  };

  const toggleContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleStartWalk = async () => {
    if (selectedContacts.length === 0) {
      Alert.alert('Select Contacts', 'Please select at least one contact to share your location with');
      return;
    }

    setLoading(true);
    try {
      const response = await friendWalkAPI.start({
        contact_ids: selectedContacts,
        duration_minutes: duration,
        location_lat: location?.lat || 45.0875,
        location_lng: location?.lng || -64.3665,
      });
      setActiveWalk(response.data);
      setState('active');
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to start Friend Walk';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async () => {
    try {
      await friendWalkAPI.extend(activeWalk.id, 15);
      const response = await friendWalkAPI.getActive();
      setActiveWalk(response.data);
      Alert.alert('Extended', 'Walk extended by 15 minutes');
    } catch (error) {
      Alert.alert('Error', 'Failed to extend walk');
    }
  };

  const handleComplete = async () => {
    try {
      await friendWalkAPI.complete(activeWalk.id);
      setActiveWalk(null);
      setState('setup');
      Alert.alert('Safe!', 'Your contacts have been notified that you arrived safely.');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to complete walk');
    }
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      Alert.alert('Required', 'Please enter name and phone number');
      return;
    }

    setLoading(true);
    try {
      await contactsAPI.add({
        name: newContactName.trim(),
        phone: newContactPhone.trim(),
        relationship: newContactRelation || undefined,
      });
      await fetchContacts();
      setNewContactName('');
      setNewContactPhone('');
      setNewContactRelation('');
      setState('setup');
    } catch (error) {
      Alert.alert('Error', 'Failed to add contact');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Add Contact Screen
  if (state === 'add-contact') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setState('setup')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.gray[700]} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Contact</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Input
              label="Name *"
              placeholder="Contact name"
              value={newContactName}
              onChangeText={setNewContactName}
            />
            <Input
              label="Phone Number *"
              placeholder="902-555-0000"
              value={newContactPhone}
              onChangeText={setNewContactPhone}
              keyboardType="phone-pad"
            />
            <Input
              label="Relationship (optional)"
              placeholder="e.g., Mom, Friend, Roommate"
              value={newContactRelation}
              onChangeText={setNewContactRelation}
            />
            <Button
              title="Save Contact"
              onPress={handleAddContact}
              loading={loading}
              fullWidth
              style={styles.saveButton}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Active Walk Screen
  if (state === 'active' && activeWalk) {
    return (
      <SafeAreaView style={styles.containerActive}>
        <View style={styles.activeContent}>
          <View style={styles.mapPlaceholder}>
            <Ionicons name="location" size={48} color={COLORS.primary} />
            <Text style={styles.mapText}>Sharing your location</Text>
          </View>

          <Card style={styles.timerCard}>
            <Ionicons name="time" size={28} color={COLORS.primary} />
            <Text style={styles.timerLabel}>
              {activeWalk.duration_minutes === 0 ? 'Sharing until stopped' : 'Time remaining'}
            </Text>
            {activeWalk.duration_minutes > 0 && (
              <Text style={styles.timerValue}>{formatTime(timeRemaining)}</Text>
            )}
          </Card>

          <View style={styles.activeActions}>
            <TouchableOpacity style={styles.arrivedButton} onPress={handleComplete}>
              <Ionicons name="checkmark-circle" size={28} color={COLORS.white} />
              <Text style={styles.arrivedButtonText}>I've Arrived Safely</Text>
            </TouchableOpacity>

            {activeWalk.duration_minutes > 0 && (
              <TouchableOpacity style={styles.extendButton} onPress={handleExtend}>
                <Ionicons name="add-circle" size={24} color={COLORS.primary} />
                <Text style={styles.extendButtonText}>Extend Time (+15 min)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.stopButton}
              onPress={() => {
                Alert.alert(
                  'Stop Sharing',
                  'Are you sure you want to stop sharing your location?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Stop', style: 'destructive', onPress: handleComplete },
                  ]
                );
              }}
            >
              <Text style={styles.stopButtonText}>Stop Sharing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Setup Screen
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={COLORS.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friend Walk</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.description}>
          Share your live location with trusted contacts while walking.
        </Text>

        {/* Contacts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Select Contacts</Text>
            <TouchableOpacity onPress={() => setState('add-contact')}>
              <Ionicons name="add-circle" size={28} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {contacts.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="people" size={40} color={COLORS.gray[300]} />
              <Text style={styles.emptyText}>No trusted contacts yet</Text>
              <Button
                title="Add Contact"
                size="small"
                onPress={() => setState('add-contact')}
                style={styles.addButton}
              />
            </Card>
          ) : (
            <View style={styles.contactsList}>
              {contacts.map((contact) => (
                <TouchableOpacity
                  key={contact.id}
                  style={[
                    styles.contactItem,
                    selectedContacts.includes(contact.id) && styles.contactItemSelected,
                  ]}
                  onPress={() => toggleContact(contact.id)}
                >
                  <View style={styles.contactInfo}>
                    <Ionicons
                      name="person-circle"
                      size={40}
                      color={selectedContacts.includes(contact.id) ? COLORS.primary : COLORS.gray[400]}
                    />
                    <View style={styles.contactText}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactPhone}>{contact.phone}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={selectedContacts.includes(contact.id) ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={selectedContacts.includes(contact.id) ? COLORS.primary : COLORS.gray[400]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Duration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration</Text>
          <View style={styles.durationOptions}>
            {DURATION_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.durationOption,
                  duration === option.value && styles.durationOptionSelected,
                ]}
                onPress={() => setDuration(option.value)}
              >
                <Text style={[
                  styles.durationLabel,
                  duration === option.value && styles.durationLabelSelected,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button
          title="Start Friend Walk"
          onPress={handleStartWalk}
          loading={loading}
          disabled={contacts.length === 0}
          fullWidth
          style={styles.startButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  containerActive: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  keyboardView: {
    flex: 1,
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
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  description: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[600],
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.gray[700],
  },
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[500],
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  addButton: {
    paddingHorizontal: SPACING.lg,
  },
  contactsList: {
    gap: SPACING.sm,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  contactItemSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactText: {
    marginLeft: SPACING.sm,
  },
  contactName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.gray[800],
  },
  contactPhone: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[500],
  },
  durationOptions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  durationOption: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.gray[200],
  },
  durationOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  durationLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.gray[700],
  },
  durationLabelSelected: {
    color: COLORS.white,
  },
  startButton: {
    marginTop: SPACING.lg,
  },
  saveButton: {
    marginTop: SPACING.lg,
  },
  // Active styles
  activeContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  mapText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.white,
    marginTop: SPACING.sm,
  },
  timerCard: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  timerLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[500],
    marginTop: SPACING.sm,
  },
  timerValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  activeActions: {
    gap: SPACING.md,
  },
  arrivedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  arrivedButtonText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.white,
    marginLeft: SPACING.sm,
  },
  extendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  extendButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  stopButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  stopButtonText: {
    fontSize: FONT_SIZE.md,
    color: 'rgba(255,255,255,0.8)',
  },
});
