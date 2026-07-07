export type ThemeMode = 'light' | 'dark';

export const COLORS = {
  light: {
    primary: '#6750A4',       // Material 3 Purple
    onPrimary: '#FFFFFF',
    primaryContainer: '#EADDFF',
    onPrimaryContainer: '#21005D',
    
    secondary: '#625B71',     // Slate Grey
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E8DEF8',
    onSecondaryContainer: '#1D192B',
    
    tertiary: '#7D5260',      // Soft Rose
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFD8E4',
    onTertiaryContainer: '#31111D',
    
    background: '#F8F9FA',    // Premium light gray background
    onBackground: '#1C1B1F',
    
    surface: '#FFFFFF',       // Card surface
    onSurface: '#1C1B1F',
    surfaceVariant: '#E7E0EC',
    onSurfaceVariant: '#49454F',
    outline: '#79747E',
    
    error: '#B3261E',         // Red warning
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',
    
    success: '#2E7D32',       // Green success
    onSuccess: '#FFFFFF',
    
    shadow: 'rgba(0, 0, 0, 0.1)',
    cardShadow: 'rgba(0, 0, 0, 0.05)',
  },
  dark: {
    primary: '#D0BCFF',       // Lighter purple for dark mode contrast
    onPrimary: '#381E72',
    primaryContainer: '#4F378B',
    onPrimaryContainer: '#EADDFF',
    
    secondary: '#CCC2DC',
    onSecondary: '#332D41',
    secondaryContainer: '#4A4458',
    onSecondaryContainer: '#E8DEF8',
    
    tertiary: '#EFB8C8',
    onTertiary: '#492532',
    tertiaryContainer: '#633B48',
    onTertiaryContainer: '#FFD8E4',
    
    background: '#121212',    // Deep slate background
    onBackground: '#E6E1E5',
    
    surface: '#1E1E1E',       // Dark card surface
    onSurface: '#E6E1E5',
    surfaceVariant: '#49454F',
    onSurfaceVariant: '#CAC4D0',
    outline: '#938F99',
    
    error: '#F2B8B5',
    onError: '#601410',
    errorContainer: '#8C1D18',
    onErrorContainer: '#F9DEDC',
    
    success: '#81C784',
    onSuccess: '#1B5E20',
    
    shadow: 'rgba(0, 0, 0, 0.5)',
    cardShadow: 'rgba(0, 0, 0, 0.3)',
  }
};

export const GRADIENTS = {
  primary: ['#6750A4', '#8462E0'],
  accent: ['#03DAC6', '#018786'],
  warning: ['#FFA726', '#FB8C00'],
  danger: ['#EF5350', '#E53935'],
  success: ['#66BB6A', '#43A047'],
  darkCard: ['#1E1E1E', '#2A2A2A']
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 7.49,
    elevation: 6,
  }
};

export const TYPOGRAPHY = {
  fontFamily: 'System', // Uses standard high-quality system font scaling
  sizes: {
    h1: 32,
    h2: 24,
    h3: 20,
    bodyLarge: 16,
    bodyMedium: 14,
    bodySmall: 12,
    caption: 10,
  },
  weights: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    bold: '700' as const,
  }
};
