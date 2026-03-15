// Design System Constants for Acadia Safe
// Premium Campus Safety App Design

export const COLORS = {
  // Navy Palette
  navy: {
    900: '#0d1b2a',
    800: '#1a365d',
    600: '#2c5282',
    500: '#3182ce',
    400: '#4299e1',
    100: '#e8f0f8',
  },
  // Primary Colors
  primary: '#1a365d',
  primaryDark: '#0d1b2a',
  primaryLight: '#2c5282',
  
  // Status Colors
  accent: '#e53e3e',
  accentDark: '#c53030',
  secondary: '#38a169',
  secondaryDark: '#2f855a',
  warning: '#ecc94b',
  warningDark: '#d69e2e',
  info: '#4299e1',
  
  // Backgrounds
  background: '#f7fafc',
  cardBg: '#ffffff',
  
  // Text
  textPrimary: '#1a202c',
  textSecondary: '#718096',
  textMuted: '#a0aec0',
  
  // Legacy support
  white: '#ffffff',
  black: '#000000',
  danger: '#e53e3e',
  success: '#38a169',
  
  gray: {
    50: '#f7fafc',
    100: '#edf2f7',
    200: '#e2e8f0',
    300: '#cbd5e0',
    400: '#a0aec0',
    500: '#718096',
    600: '#4a5568',
    700: '#2d3748',
    800: '#1a202c',
    900: '#171923',
  },
};

export const GRADIENTS = {
  navy: ['#1a365d', '#2c5282'],
  dark: ['#0d1b2a', '#1a365d'],
  red: ['#e53e3e', '#c53030'],
  green: ['#38a169', '#2f855a'],
  lightBlue: ['#ebf8ff', '#bee3f8'],
  lightYellow: ['#fffff0', '#fefcbf'],
  lightGreen: ['#f0fff4', '#c6f6d5'],
  lightPurple: ['#faf5ff', '#e9d8fd'],
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
  },
  cardLg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonNavy: {
    shadowColor: '#1a365d',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonRed: {
    shadowColor: '#e53e3e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONT_SIZE = {
  tiny: 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 32,
};

export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const CAMPUS_LOCATIONS = {
  center: { latitude: 45.0875, longitude: -64.3665 },
  bounds: {
    north: 45.0920,
    south: 45.0830,
    east: -64.3600,
    west: -64.3730,
  },
};

export const EMERGENCY_CONTACTS = [
  { id: '1', name: 'Acadia Security', phone: '902-585-1103', icon: 'shield', color: COLORS.navy[800] },
  { id: '2', name: 'Emergency (911)', phone: '911', icon: 'alert-circle', color: COLORS.accent },
  { id: '3', name: 'Campus Health', phone: '902-585-1234', icon: 'medkit', color: COLORS.secondary },
  { id: '4', name: 'Crisis Helpline', phone: '1-833-456-4566', icon: 'heart', color: COLORS.info },
  { id: '5', name: 'Wolfville Police', phone: '902-542-3817', icon: 'shield-checkmark', color: COLORS.navy[600] },
];

export const INCIDENT_TYPES = [
  'Suspicious Activity',
  'Theft',
  'Harassment',
  'Property Damage',
  'Safety Hazard',
  'Other',
];

export const ALERT_TYPES = {
  emergency: { color: COLORS.accent, bgColor: '#fed7d7', icon: 'alert-circle' },
  advisory: { color: COLORS.warning, bgColor: '#fefcbf', icon: 'warning' },
  info: { color: COLORS.info, bgColor: '#bee3f8', icon: 'information-circle' },
};
