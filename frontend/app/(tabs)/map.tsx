import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { locationsAPI } from '../../src/services/api';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS, CAMPUS_LOCATIONS } from '../../src/constants/theme';
import LoadingSpinner from '../../src/components/LoadingSpinner';
import Card from '../../src/components/Card';

const { width, height } = Dimensions.get('window');

const LOCATION_TYPES = [
  { id: 'all', label: 'All', icon: 'apps', color: COLORS.primary },
  { id: 'emergency_phone', label: 'Phones', icon: 'call', color: COLORS.info },
  { id: 'aed', label: 'AEDs', icon: 'heart', color: COLORS.accent },
  { id: 'safe_building', label: 'Safe', icon: 'business', color: COLORS.secondary },
  { id: 'security_office', label: 'Security', icon: 'shield', color: COLORS.primary },
  { id: 'parking', label: 'Parking', icon: 'car', color: COLORS.gray[600] },
];

// Acadia University Campus region
const ACADIA_REGION = {
  latitude: 45.0875,
  longitude: -64.3665,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

export default function MapScreen() {
  // Initialize with mock data to show immediately
  const [locations, setLocations] = useState<any[]>([
    { id: '1', name: 'Acadia Security Office', description: 'Main campus security headquarters. Open 24/7.', location_type: 'security_office', lat: 45.0875, lng: -64.3665 },
    { id: '2', name: 'BAC Emergency Phone', description: 'Emergency phone outside Beveridge Arts Centre', location_type: 'emergency_phone', lat: 45.088, lng: -64.367 },
    { id: '3', name: 'Library Emergency Phone', description: 'Emergency phone at main library entrance', location_type: 'emergency_phone', lat: 45.087, lng: -64.366 },
    { id: '4', name: 'SUB Emergency Phone', description: 'Emergency phone at Student Union Building', location_type: 'emergency_phone', lat: 45.0885, lng: -64.3675 },
    { id: '5', name: 'Patterson Hall AED', description: 'AED located in main lobby of Patterson Hall', location_type: 'aed', lat: 45.0865, lng: -64.3655 },
    { id: '6', name: 'Library AED', description: 'AED located at library front desk', location_type: 'aed', lat: 45.0871, lng: -64.3661 },
    { id: '7', name: 'Athletic Centre AED', description: 'AED located at athletic centre entrance', location_type: 'aed', lat: 45.086, lng: -64.368 },
    { id: '8', name: 'Library', description: 'Vaughan Memorial Library - 24/7 access during exams', location_type: 'safe_building', lat: 45.087, lng: -64.366 },
    { id: '9', name: 'Student Union Building', description: 'SUB - Open until midnight daily', location_type: 'safe_building', lat: 45.0885, lng: -64.3675 },
    { id: '10', name: 'KC Irving Centre', description: 'Environmental Science Centre - Card access after hours', location_type: 'safe_building', lat: 45.0878, lng: -64.3668 },
    { id: '11', name: 'Main Parking Lot', description: 'Main campus parking - Well lit, security patrols', location_type: 'parking', lat: 45.0882, lng: -64.3658 },
    { id: '12', name: 'Residence Parking', description: 'Residence parking lot - Permit required', location_type: 'parking', lat: 45.0868, lng: -64.3672 },
  ]);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [userLocation, setUserLocation] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  useEffect(() => {
    fetchLocations();
    getUserLocation();
  }, []);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await locationsAPI.getAll();
      setLocations(response.data);
    } catch (error) {
      console.log('Error fetching locations:', error);
      // Set mock data if API fails
      setLocations([
        { id: '1', name: 'Acadia Security Office', description: 'Main campus security headquarters. Open 24/7.', location_type: 'security_office', lat: 45.0875, lng: -64.3665 },
        { id: '2', name: 'BAC Emergency Phone', description: 'Emergency phone outside Beveridge Arts Centre', location_type: 'emergency_phone', lat: 45.088, lng: -64.367 },
        { id: '3', name: 'Library Emergency Phone', description: 'Emergency phone at main library entrance', location_type: 'emergency_phone', lat: 45.087, lng: -64.366 },
        { id: '4', name: 'Patterson Hall AED', description: 'AED located in main lobby of Patterson Hall', location_type: 'aed', lat: 45.0865, lng: -64.3655 },
        { id: '5', name: 'Library AED', description: 'AED located at library front desk', location_type: 'aed', lat: 45.0871, lng: -64.3661 },
        { id: '6', name: 'Library', description: 'Vaughan Memorial Library - 24/7 access during exams', location_type: 'safe_building', lat: 45.087, lng: -64.366 },
        { id: '7', name: 'Student Union Building', description: 'SUB - Open until midnight daily', location_type: 'safe_building', lat: 45.0885, lng: -64.3675 },
        { id: '8', name: 'Main Parking Lot', description: 'Main campus parking - Well lit, security patrols', location_type: 'parking', lat: 45.0882, lng: -64.3658 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = selectedFilter === 'all' 
    ? locations 
    : locations.filter(loc => loc.location_type === selectedFilter);

  const getLocationIcon = (type: string) => {
    const locType = LOCATION_TYPES.find(t => t.id === type);
    return locType?.icon || 'location';
  };

  const getLocationColor = (type: string) => {
    const locType = LOCATION_TYPES.find(t => t.id === type);
    return locType?.color || COLORS.primary;
  };

  const calculateDistance = (lat: number, lng: number) => {
    if (!userLocation) return null;
    const R = 6371; // km
    const dLat = (lat - userLocation.latitude) * Math.PI / 180;
    const dLon = (lng - userLocation.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(userLocation.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c * 1000; // meters
    return d < 1000 ? `${Math.round(d)}m` : `${(d/1000).toFixed(1)}km`;
  };

  const openInMaps = (location: any) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${location.lat},${location.lng}`,
      android: `google.navigation:q=${location.lat},${location.lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`,
    });
    Linking.openURL(url as string);
  };

  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/@${ACADIA_REGION.latitude},${ACADIA_REGION.longitude},17z`;
    Linking.openURL(url);
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading map..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Campus Map</Text>
        <Text style={styles.subtitle}>Safety resources at Acadia University</Text>
      </View>

      {/* Filter Chips */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {LOCATION_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.filterChip,
              selectedFilter === type.id && styles.filterChipActive,
            ]}
            onPress={() => {
              setSelectedFilter(type.id);
              setSelectedLocation(null);
            }}
          >
            <Ionicons 
              name={type.icon as any} 
              size={16} 
              color={selectedFilter === type.id ? COLORS.white : COLORS.gray[600]} 
            />
            <Text style={[
              styles.filterLabel,
              selectedFilter === type.id && styles.filterLabelActive,
            ]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map Placeholder with Open Maps Button */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <View style={styles.mapImagePlaceholder}>
            <Ionicons name="map" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.mapTitle}>Acadia University Campus</Text>
          <Text style={styles.mapSubtitle}>Wolfville, Nova Scotia</Text>
          <TouchableOpacity style={styles.openMapsButton} onPress={openGoogleMaps}>
            <Ionicons name="open-outline" size={18} color={COLORS.white} />
            <Text style={styles.openMapsText}>Open in Google Maps</Text>
          </TouchableOpacity>
        </View>
        
        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Safety Resources</Text>
          <View style={styles.legendGrid}>
            {LOCATION_TYPES.filter(t => t.id !== 'all').map((type) => (
              <View key={type.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: type.color }]} />
                <Text style={styles.legendText}>{type.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Locations List */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>
          {filteredLocations.length} {selectedFilter === 'all' ? 'Locations' : LOCATION_TYPES.find(t => t.id === selectedFilter)?.label}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.listScroll}>
          {filteredLocations.map((location) => (
            <TouchableOpacity
              key={location.id}
              onPress={() => setSelectedLocation(selectedLocation?.id === location.id ? null : location)}
              activeOpacity={0.7}
            >
              <Card style={[
                styles.locationCard,
                selectedLocation?.id === location.id && styles.locationCardSelected,
              ]}>
                <View style={styles.locationRow}>
                  <View style={[styles.locationIcon, { backgroundColor: getLocationColor(location.location_type) }]}>
                    <Ionicons 
                      name={getLocationIcon(location.location_type) as any} 
                      size={20} 
                      color={COLORS.white} 
                    />
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>{location.name}</Text>
                    {location.description && (
                      <Text style={styles.locationDesc} numberOfLines={1}>
                        {location.description}
                      </Text>
                    )}
                  </View>
                  {userLocation && (
                    <Text style={styles.locationDistance}>
                      {calculateDistance(location.lat, location.lng)}
                    </Text>
                  )}
                </View>
                {selectedLocation?.id === location.id && (
                  <View style={styles.locationExpanded}>
                    <Text style={styles.locationFullDesc}>{location.description}</Text>
                    <TouchableOpacity 
                      style={styles.directionsButton}
                      onPress={() => openInMaps(location)}
                    >
                      <Ionicons name="navigate" size={16} color={COLORS.white} />
                      <Text style={styles.directionsText}>Get Directions</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[800],
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  filtersContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.sm,
    ...SHADOWS.sm,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[600],
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  filterLabelActive: {
    color: COLORS.white,
  },
  // Map Styles
  mapContainer: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  mapPlaceholder: {
    backgroundColor: COLORS.gray[100],
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.lg,
  },
  mapImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  mapTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  mapSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[500],
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  openMapsText: {
    color: COLORS.white,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  legend: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.sm,
    ...SHADOWS.sm,
  },
  legendTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: SPACING.sm,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING.xs,
  },
  legendText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray[600],
  },
  // List Styles
  listContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  listTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: SPACING.sm,
  },
  listScroll: {
    flex: 1,
  },
  locationCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  locationCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.gray[800],
  },
  locationDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  locationDistance: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  locationExpanded: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  locationFullDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray[600],
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  directionsText: {
    color: COLORS.white,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
});
