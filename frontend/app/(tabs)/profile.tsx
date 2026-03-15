import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import Input from '../../src/components/Input';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [emergencyName, setEmergencyName] = useState(user?.emergency_contact_name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergency_contact_phone || '');
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [locationServices, setLocationServices] = useState(true);

  const handleLogout = () => {
    console.log('Logout button pressed');
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            console.log('Logout confirmed, calling logout...');
            try {
              await logout();
              console.log('Logout success, navigating...');
              router.replace('/login');
              console.log('Navigation called');
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
              console.log('Logout error:', error);
            }
          }
        },
      ]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser({
        full_name: fullName,
        phone: phone,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
      });
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      try {
        await updateUser({
          profile_photo: `data:image/jpeg;base64,${result.assets[0].base64}`,
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to update profile photo');
      }
    }
  };

  const menuItems = [
    { id: 'reports', title: 'My Reports', icon: 'document-text', onPress: () => {} },
    { id: 'contacts', title: 'Emergency Contacts', icon: 'call', onPress: () => router.push('/emergency-contacts') },
    { id: 'tips', title: 'Safety Tips', icon: 'bulb', onPress: () => {} },
    { id: 'about', title: 'About Acadia Safe', icon: 'information-circle', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editButton}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={pickImage} style={styles.photoContainer}>
            {user?.profile_photo ? (
              <Image source={{ uri: user.profile_photo }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={48} color={COLORS.gray[400]} />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color={COLORS.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{user?.full_name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Profile Info */}
        <Card style={styles.infoCard}>
          {editing ? (
            <View>
              <Input
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
              />
              <Input
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>Emergency Contact</Text>
              <Input
                label="Contact Name"
                value={emergencyName}
                onChangeText={setEmergencyName}
                placeholder="e.g., Mom, Dad"
              />
              <Input
                label="Contact Phone"
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                keyboardType="phone-pad"
              />
              <View style={styles.editButtons}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => {
                    setEditing(false);
                    setFullName(user?.full_name || '');
                    setPhone(user?.phone || '');
                    setEmergencyName(user?.emergency_contact_name || '');
                    setEmergencyPhone(user?.emergency_contact_phone || '');
                  }}
                  style={{ flex: 1, marginRight: SPACING.sm }}
                />
                <Button
                  title="Save"
                  onPress={handleSave}
                  loading={saving}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.infoRow}>
                <Ionicons name="call" size={20} color={COLORS.gray[500]} />
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{user?.phone}</Text>
              </View>
              {user?.emergency_contact_name && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionLabel}>Emergency Contact</Text>
                  <View style={styles.infoRow}>
                    <Ionicons name="person" size={20} color={COLORS.gray[500]} />
                    <Text style={styles.infoLabel}>Name</Text>
                    <Text style={styles.infoValue}>{user.emergency_contact_name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="call" size={20} color={COLORS.gray[500]} />
                    <Text style={styles.infoLabel}>Phone</Text>
                    <Text style={styles.infoValue}>{user.emergency_contact_phone}</Text>
                  </View>
                </>
              )}
            </View>
          )}
        </Card>

        {/* Settings */}
        <Card style={styles.settingsCard}>
          <Text style={styles.cardTitle}>Settings</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications" size={20} color={COLORS.gray[600]} />
              <Text style={styles.settingLabel}>Push Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: COLORS.gray[300], true: COLORS.primary }}
            />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="location" size={20} color={COLORS.gray[600]} />
              <Text style={styles.settingLabel}>Location Services</Text>
            </View>
            <Switch
              value={locationServices}
              onValueChange={setLocationServices}
              trackColor={{ false: COLORS.gray[300], true: COLORS.primary }}
            />
          </View>
        </Card>

        {/* Menu Items */}
        <Card style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && styles.menuItemBorder,
              ]}
              onPress={item.onPress}
            >
              <Ionicons name={item.icon as any} size={22} color={COLORS.gray[600]} />
              <Text style={styles.menuLabel}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray[400]} />
            </TouchableOpacity>
          ))}
        </Card>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color={COLORS.accent} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.version}>Acadia Safe v1.0.0</Text>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[800],
  },
  editButton: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  userName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    color: COLORS.gray[800],
    marginTop: SPACING.md,
  },
  userEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[500],
    marginTop: 4,
  },
  infoCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  infoLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[500],
    marginLeft: SPACING.sm,
    flex: 1,
  },
  infoValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[800],
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.gray[200],
    marginVertical: SPACING.md,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.gray[600],
    marginBottom: SPACING.sm,
  },
  editButtons: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  settingsCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  cardTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: SPACING.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[700],
    marginLeft: SPACING.sm,
  },
  menuCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  menuLabel: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.gray[700],
    marginLeft: SPACING.sm,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    padding: SPACING.md,
  },
  logoutText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.accent,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  version: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray[400],
  },
});
