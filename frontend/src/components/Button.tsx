import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const getBackgroundColor = () => {
    if (disabled) return COLORS.gray[300];
    switch (variant) {
      case 'primary': return COLORS.primary;
      case 'secondary': return COLORS.secondary;
      case 'danger': return COLORS.danger;
      case 'outline': return 'transparent';
      case 'text': return 'transparent';
      default: return COLORS.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return COLORS.gray[500];
    switch (variant) {
      case 'outline': return COLORS.primary;
      case 'text': return COLORS.primary;
      default: return COLORS.white;
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'small': return { paddingVertical: 8, paddingHorizontal: 16 };
      case 'large': return { paddingVertical: 18, paddingHorizontal: 32 };
      default: return { paddingVertical: 14, paddingHorizontal: 24 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small': return FONT_SIZE.sm;
      case 'large': return FONT_SIZE.lg;
      default: return FONT_SIZE.md;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: variant === 'outline' ? COLORS.primary : 'transparent',
          borderWidth: variant === 'outline' ? 2 : 0,
        },
        getPadding(),
        fullWidth && styles.fullWidth,
        style,
      ]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <Text style={[
          styles.text,
          { color: getTextColor(), fontSize: getFontSize() },
          textStyle,
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontWeight: '600',
  },
});
