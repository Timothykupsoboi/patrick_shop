import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, StyleProp } from 'react-native';
import { useTheme } from './ThemeProvider';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  elevation?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  elevation = 'sm',
}) => {
  const { colors, borderRadius, shadows } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: colors.outline ? 1 : 0,
    borderColor: colors.surfaceVariant,
    padding: 16,
    ...shadows[elevation],
  };

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={[cardStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};

const styles = StyleSheet.create({});
