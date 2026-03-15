import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export default function Card({ children, style, padding = SPACING.md }: CardProps) {
  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.md,
  },
});
