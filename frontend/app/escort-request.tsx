import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { escortAPI } from '../src/services/api';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../src/constants/theme';
import Button from '../src/components/Button';
import Card from '../src/components/Card';

type EscortState = 'form' | 'waiting' | 'assigned';

export default function EscortRequestScreen() {
  const router = useRouter();
  const [state, setState] = useState<EscortState>('form');
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [pickupLocation, setPickupLocation] = useState<any>(null);
  const [pickupName, setPickupName] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [notes, setNotes] = useState('');
  const [officer, setOfficer] = useState<any>(null);
  const [eta, setEta] = useState(10);

  useEffect(() => {
    getLocation();
    checkActiveRequest();
  }, []);

  useEffect(() => {
    let timer: any;
    if (state === 'waiting') {
      timer = setTimeout(async () => {
        try {
          await escortAPI.assign(requestId);
          setOfficer({ name: 'Officer John', photo: null });
          setEta(5);
          setState('assigned');
        } catch (error) {
          console.log('Error assigning officer:', error);
        }
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [state, requestId]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setPickupLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const checkActiveRequest = async () => {
    try {
      const response = await escortAPI.getActive();
      if (response.data) {
        setRequestId(response.data.id);
        if (response.data.status === 'assigned') {
          setOfficer({ name: response.data.officer_name, photo: response.data.officer_photo });
          setEta(response.data.estimated_wait);
          setState('assigned');
        } else {
          setState('waiting');
        }
      }
    } catch (error) {
      console.log('Error checking active request:', error);
    }
  };

  const handleSubmit = async () => {
    if (!destinationName.trim()) {
      Alert.alert('Required', 'Please enter your destination');
      return;
    }
    setLoading(true);
    try {
      const response = await escortAPI.create({
        pickup_lat: pickupLocation?.lat || 45.0875,
        pickup_lng: pickupLocation?.lng || -64.3665,
        pickup_name: pickupName || 'Current Location',
        destination_lat: 45.0880,
        destination_lng: -64.3670,
        destination_name: destinationName,
        notes: notes || undefined,
      });
      setRequestId(response.data.id);
      setState('waiting');
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to submit request';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this escort request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            await escortAPI.cancel(requestId);
            router.back();
          } catch (error) {
            Alert.alert('Error', 'Failed to cancel request');
          }
        },
      },
    ]);
  };

  if (state === 'waiting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={COLORS.gray[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Safety Escort</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.waitingContent}>
          <View style={styles.waitingAnimation}>
            <Ionicons name="walk" size={64} color={COLORS.primary} />
          </View>
          <Text style={styles.waitingTitle}>Request Submitted!</Text>
          <Text style={styles.waitingSubtitle}>Looking for an available officer...</Text>
          <Card style={styles.etaCard}>
            <Text style={styles.etaLabel}>Estimated Wait</Text>
            <Text style={styles.etaValue}>~{eta} minutes</Text>
          </Card>
          <Button title="Cancel Request" variant="outline" onPress={handleCancel} fullWidth style={styles.cancelButton} />
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'assigned') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={COLORS.gray[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Safety Escort</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.assignedContent}>
          <View style={styles.officerAvatar}>
            <Ionicons name="person" size={48} color={COLORS.white} />
          </View>
          <Text style={styles.officerName}>{officer?.name || 'Officer'} is on the way</Text>
          <Text style={styles.assignedSubtitle}>They will meet you at your pickup location</Text>
          <Card style={styles.etaCard}>
            <Ionicons name="time" size={24} color={COLORS.primary} />
            <Text style={styles.etaLabel}>Arriving in</Text>
            <Text style={styles.etaValue}>~{eta} minutes</Text>
          </Card>
          <View style={styles.assignedActions}>
            <TouchableOpacity style={styles.callOfficerButton}>
              <Ionicons name="call" size={24} color={COLORS.white} />
              <Text style={styles.callOfficerText}>Call Officer</Text>
            </TouchableOpacity>
            <Button title="Cancel Request" variant="outline" onPress={handleCancel} fullWidth />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={COLORS.gray[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Safety Escort</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.description}>Request a security officer to escort you safely across campus.</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Pickup Location</Text>
            <TouchableOpacity style={styles.locationButton}>
              <Ionicons name="location" size={20} color={COLORS.secondary} />
              <Text style={styles.locationButtonText}>{pickupLocation ? 'Current Location' : 'Getting location...'}</Text>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
            <TextInput style={styles.input} placeholder="Or enter location name" value={pickupName} onChangeText={setPickupName} placeholderTextColor={COLORS.gray[400]} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Destination *</Text>
            <TextInput style={styles.input} placeholder="Where do you want to go?" value={destinationName} onChangeText={setDestinationName} placeholderTextColor={COLORS.gray[400]} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Additional Notes (optional)</Text>
            <TextInput style={styles.textArea} placeholder="e.g., I'm wearing a red jacket" value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" placeholderTextColor={COLORS.gray[400]} />
          </View>
          <Card style={styles.infoCard}>
            <Ionicons name="time" size={24} color={COLORS.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Estimated Wait Time</Text>
              <Text style={styles.infoValue}>~10 minutes</Text>
            </View>
          </Card>
          <Button title="Request Escort" onPress={handleSubmit} loading={loading} fullWidth style={styles.submitButton} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[200], backgroundColor: COLORS.white },
  backButton: { padding: 4 },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.gray[800] },
  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  description: { fontSize: FONT_SIZE.md, color: COLORS.gray[600], marginBottom: SPACING.lg, lineHeight: 22 },
  field: { marginBottom: SPACING.md },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.gray[700], marginBottom: SPACING.xs },
  locationButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.secondary, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4, marginBottom: SPACING.sm },
  locationButtonText: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.secondary, marginLeft: SPACING.sm, fontWeight: '500' },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[300], borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4, fontSize: FONT_SIZE.md, color: COLORS.gray[800], minHeight: 48 },
  textArea: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[300], borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4, fontSize: FONT_SIZE.md, color: COLORS.gray[800], minHeight: 80 },
  infoCard: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
  infoTextContainer: { marginLeft: SPACING.md },
  infoTitle: { fontSize: FONT_SIZE.sm, color: COLORS.gray[500] },
  infoValue: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.primary },
  submitButton: { marginTop: SPACING.xl },
  waitingContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  waitingAnimation: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  waitingTitle: { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.gray[800] },
  waitingSubtitle: { fontSize: FONT_SIZE.md, color: COLORS.gray[600], marginTop: SPACING.xs },
  etaCard: { alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.lg },
  etaLabel: { fontSize: FONT_SIZE.sm, color: COLORS.gray[500], marginTop: SPACING.sm },
  etaValue: { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.primary, marginTop: SPACING.xs },
  cancelButton: { marginTop: SPACING.md },
  assignedContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  officerAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  officerName: { fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.gray[800], textAlign: 'center' },
  assignedSubtitle: { fontSize: FONT_SIZE.md, color: COLORS.gray[600], marginTop: SPACING.xs, textAlign: 'center' },
  assignedActions: { width: '100%', marginTop: SPACING.xl, gap: SPACING.md },
  callOfficerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.secondary, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg },
  callOfficerText: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.white, marginLeft: SPACING.sm },
});
