import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.navy[800],
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 0,
          height: 70,
          paddingTop: SPACING.sm,
          paddingBottom: SPACING.sm,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: FONT_SIZE.tiny,
          fontWeight: FONT_WEIGHT.medium,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: SPACING.xs,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
              <Ionicons name={focused ? 'map' : 'map-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
              <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  iconContainerActive: {
    backgroundColor: COLORS.navy[100],
  },
});
