import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { useTheme } from './ThemeProvider';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined' | 'text' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'filled',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const { colors, borderRadius, spacing, typography } = useTheme();

  const getStyles = () => {
    let buttonStyle: ViewStyle = {};
    let textBtnStyle: TextStyle = {};

    // Sizing
    switch (size) {
      case 'sm':
        buttonStyle = { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm };
        textBtnStyle = { fontSize: typography.sizes.bodySmall };
        break;
      case 'lg':
        buttonStyle = { paddingVertical: spacing.md, paddingHorizontal: spacing.xl };
        textBtnStyle = { fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.bold };
        break;
      case 'md':
      default:
        buttonStyle = { paddingVertical: spacing.sm, paddingHorizontal: spacing.md };
        textBtnStyle = { fontSize: typography.sizes.bodyMedium, fontWeight: typography.weights.medium };
        break;
    }

    // Variants
    switch (variant) {
      case 'outlined':
        buttonStyle = {
          ...buttonStyle,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.primary,
        };
        textBtnStyle = { ...textBtnStyle, color: colors.primary };
        break;
      case 'text':
        buttonStyle = {
          ...buttonStyle,
          backgroundColor: 'transparent',
        };
        textBtnStyle = { ...textBtnStyle, color: colors.primary };
        break;
      case 'danger':
        buttonStyle = {
          ...buttonStyle,
          backgroundColor: colors.error,
        };
        textBtnStyle = { ...textBtnStyle, color: colors.onError };
        break;
      case 'success':
        buttonStyle = {
          ...buttonStyle,
          backgroundColor: colors.success,
        };
        textBtnStyle = { ...textBtnStyle, color: colors.onSuccess };
        break;
      case 'filled':
      default:
        buttonStyle = {
          ...buttonStyle,
          backgroundColor: colors.primary,
        };
        textBtnStyle = { ...textBtnStyle, color: colors.onPrimary };
        break;
    }

    // Disabled state overrides
    if (disabled || loading) {
      buttonStyle = {
        ...buttonStyle,
        backgroundColor: variant === 'outlined' || variant === 'text' ? 'transparent' : colors.surfaceVariant,
        borderColor: variant === 'outlined' ? colors.outline : 'transparent',
        opacity: 0.6,
      };
      textBtnStyle = {
        ...textBtnStyle,
        color: colors.outline,
      };
    }

    return { buttonStyle, textBtnStyle };
  };

  const { buttonStyle, textBtnStyle } = getStyles();

  return (
    <TouchableOpacity
      onPress={disabled || loading ? undefined : onPress}
      activeOpacity={0.7}
      style={[
        styles.base,
        { borderRadius: borderRadius.md },
        buttonStyle,
        style,
      ]}
    >
      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ActivityIndicator color={variant === 'outlined' || variant === 'text' ? colors.primary : '#fff'} size="small" />
          <Text style={[styles.text, textBtnStyle, textStyle]}>{title}</Text>
        </View>
      ) : (
        <>
          {icon && <React.Fragment>{icon}</React.Fragment>}
          <Text style={[styles.text, textBtnStyle, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    textAlign: 'center',
  },
});
