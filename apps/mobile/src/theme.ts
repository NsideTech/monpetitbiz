export const theme = {
  colors: {
    // Light base
    bg: '#F8FAF9',
    bgCard: '#FFFFFF',
    bgCardAlt: '#F0F5F2',
    bgGlass: 'rgba(255, 255, 255, 0.85)',

    // Green primary palette
    primary: '#16A34A',
    primaryLight: '#22C55E',
    primaryDark: '#15803D',
    accent: '#059669',
    accentAlt: '#10B981',

    // Surfaces
    surface: '#F8FAF9',
    surfaceAlt: '#FFFFFF',
    surfaceElevated: '#FFFFFF',

    // Text
    text: '#1A2E23',
    textSecondary: '#4B6358',
    textMuted: '#8DA69A',

    // Semantic
    success: '#16A34A',
    successDark: '#15803D',
    error: '#DC2626',
    errorDark: '#B91C1C',
    warning: '#D97706',

    // Borders
    border: 'rgba(22, 163, 74, 0.15)',
    borderLight: 'rgba(22, 163, 74, 0.08)',
    borderGlow: 'rgba(22, 163, 74, 0.35)',

    // Chips
    chipBg: 'rgba(22, 163, 74, 0.08)',
    chipBgActive: 'rgba(22, 163, 74, 0.18)',
    chipBorder: 'rgba(22, 163, 74, 0.22)',

    // Misc
    overlay: 'rgba(0, 0, 0, 0.45)',
    tabBarBg: 'rgba(255, 255, 255, 0.95)',
  },

  radii: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
    full: 9999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  shadows: {
    sm: {
      shadowColor: '#0A3D1F',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#0A3D1F',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.10,
      shadowRadius: 10,
      elevation: 5,
    },
    lg: {
      shadowColor: '#0A3D1F',
      shadowOffset: {width: 0, height: 6},
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    glow: {
      shadowColor: '#16A34A',
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 8,
    },
  },

  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.10)',
  },
};
