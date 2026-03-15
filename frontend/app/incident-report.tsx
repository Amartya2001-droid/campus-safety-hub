import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { incidentAPI } from '../src/services/api';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, INCIDENT_TYPES, SHADOWS } from '../src/constants/theme';
import Button from '../src/components/Button';
import Card from '../src/components/Card';

export default function IncidentReportScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [reportId, setReportId] = useState('');
  const [loading, setLoading] = useState(false);

  // Form state
  const [incidentType, setIncidentType] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [wantsContact, setWantsContact] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [location, setLocation] = useState<any>(null);
  const [locationName, setLocationName] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);

  useEffect(() => {
    getLocation();
  }, []);

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

  const pickImage = async () => {
    if (photos.length >= 3) {
      Alert.alert('Limit Reached', 'You can only add up to 3 photos');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhotos([...photos, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const takePhoto = async () => {
    if (photos.length >= 3) {
      Alert.alert('Limit Reached', 'You can only add up to 3 photos');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhotos([...photos, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!incidentType) {
      Alert.alert('Required', 'Please select an incident type');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please provide a description');
      return;
    }

    setLoading(true);
    try {
      const response = await incidentAPI.create({
        incident_type: incidentType,
        location_lat: location?.lat || 45.0875,
        location_lng: location?.lng || -64.3665,
        location_name: locationName || undefined,
        description: description.trim(),
        photos,
        is_anonymous: isAnonymous,
        wants_contact: wantsContact,
        contact_phone: wantsContact ? contactPhone : undefined,
      });
      setReportId(response.data.id);
      setStep('success');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={COLORS.secondary} />
          </View>
          <Text style={styles.successTitle}>Report Submitted!</Text>
          <Text style={styles.successSubtitle}>
            Your incident report has been received
          </Text>
          <Card style={styles.reportIdCard}>
            <Text style={styles.reportIdLabel}>Report ID</Text>
            <Text style={styles.reportIdValue}>{reportId.slice(0, 8).toUpperCase()}</Text>
          </Card>
          <Text style={styles.successNote}>
            Campus security will review your report and take appropriate action.
          </Text>
          <Button
            title="Done"
            onPress={() => router.back()}
            fullWidth
            style={styles.doneButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={COLORS.gray[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Incident</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Incident Type */}
          <View style={styles.field}>
            <Text style={styles.label}>Incident Type *</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowTypePicker(!showTypePicker)}
            >
              <Text style={incidentType ? styles.pickerValue : styles.pickerPlaceholder}>
                {incidentType || 'Select type...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.gray[500]} />
            </TouchableOpacity>
            {showTypePicker && (
              <View style={styles.pickerOptions}>
                {INCIDENT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerOption,
                      incidentType === type && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      setIncidentType(type);
                      setShowTypePicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      incidentType === type && styles.pickerOptionTextSelected,
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={20} color={COLORS.secondary} />
              <Text style={styles.locationStatus}>
                {location ? 'GPS location captured' : 'Getting location...'}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Location name (optional)"
              value={locationName}
              onChangeText={setLocationName}
              placeholderTextColor={COLORS.gray[400]}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe what happened..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholderTextColor={COLORS.gray[400]}
            />
          </View>

          {/* Photos */}
          <View style={styles.field}>
            <Text style={styles.label}>Photos (optional)</Text>
            <View style={styles.photosRow}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri: photo }} style={styles.photoPreview} />
                  <TouchableOpacity
                    style={styles.removePhoto}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close" size={16} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 3 && (
                <View style={styles.addPhotoButtons}>
                  <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
                    <Ionicons name="images" size={24} color={COLORS.primary} />
                    <Text style={styles.addPhotoText}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addPhotoButton} onPress={takePhoto}>
                    <Ionicons name="camera" size={24} color={COLORS.primary} />
                    <Text style={styles.addPhotoText}>Camera</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Anonymous Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="eye-off" size={20} color={COLORS.gray[600]} />
              <Text style={styles.toggleLabel}>Report Anonymously</Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: COLORS.gray[300], true: COLORS.primary }}
            />
          </View>

          {/* Contact Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="call" size={20} color={COLORS.gray[600]} />
              <Text style={styles.toggleLabel}>I want to be contacted</Text>
            </View>
            <Switch
              value={wantsContact}
              onValueChange={setWantsContact}
              trackColor={{ false: COLORS.gray[300], true: COLORS.primary }}
            />
          </View>

          {wantsContact && (
            <TextInput
              style={styles.input}
              placeholder="Your phone number"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
              placeholderTextColor={COLORS.gray[400]}
            />
          )}

          <Button
            title="Submit Report"
            onPress={handleSubmit}
            loading={loading}
            fullWidth
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  field: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: SPACING.xs,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    minHeight: 48,
  },
  pickerValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[800],
  },
  pickerPlaceholder: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[400],
  },
  pickerOptions: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
    ...SHADOWS.md,
  },
  pickerOption: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  pickerOptionSelected: {
    backgroundColor: COLORS.gray[50],
  },
  pickerOptionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[700],
  },
  pickerOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  locationStatus: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.secondary,
    marginLeft: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[800],
    minHeight: 48,
  },
  textArea: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[800],
    minHeight: 120,
  },
  photosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  photoContainer: {
    position: 'relative',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[700],
    marginLeft: SPACING.sm,
  },
  submitButton: {
    marginTop: SPACING.lg,
  },
  // Success styles
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  successIcon: {
    marginBottom: SPACING.md,
  },
  successTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[800],
  },
  successSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[600],
    marginTop: SPACING.xs,
  },
  reportIdCard: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  reportIdLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[500],
  },
  reportIdValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: SPACING.xs,
    letterSpacing: 2,
  },
  successNote: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[500],
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  doneButton: {
    marginTop: SPACING.xl,
  },
});
