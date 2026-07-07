import React from 'react';
import { View, TextInput, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { useTheme } from './ThemeProvider';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'numeric' | 'email-address' | 'phone-pad';
  error?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  error,
  style,
  inputStyle,
  icon,
  autoCapitalize = 'sentences',
}) => {
  const { colors, borderRadius, spacing, typography } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: error ? colors.error : colors.onSurfaceVariant,
              fontSize: typography.sizes.bodySmall,
              fontWeight: typography.weights.medium,
              marginBottom: spacing.xs,
            },
          ]}
        >
          {label}
        </Text>
      )}
      
      <View
        style={[
          styles.inputWrapper,
          {
            borderRadius: borderRadius.md,
            borderColor: error ? colors.error : colors.outline,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {icon && <View style={[styles.iconWrapper, { marginRight: spacing.sm }]}>{icon}</View>}
        
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.outline}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={[
            styles.input,
            {
              color: colors.onSurface,
              fontSize: typography.sizes.bodyMedium,
            },
            inputStyle,
          ]}
        />
      </View>

      {error && (
        <Text
          style={[
            styles.errorText,
            {
              color: colors.error,
              fontSize: typography.sizes.caption,
              marginTop: spacing.xs,
            },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    alignSelf: 'flex-start',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 48,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    padding: 0, // Reset default padding
  },
  errorText: {
    alignSelf: 'flex-start',
  },
});
