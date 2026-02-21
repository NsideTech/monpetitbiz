import {Pressable, StyleSheet, Text, ViewStyle} from 'react-native';
import {theme} from '../theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'filled' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
};

export const PrimaryButton = ({
  label,
  onPress,
  disabled,
  variant = 'filled',
  size = 'md',
  style,
}: PrimaryButtonProps) => {
  const sizeStyles = {
    sm: {paddingVertical: 10, paddingHorizontal: 16, fontSize: 14},
    md: {paddingVertical: 14, paddingHorizontal: 24, fontSize: 16},
    lg: {paddingVertical: 18, paddingHorizontal: 32, fontSize: 17},
  };

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        {
          paddingVertical: sizeStyles[size].paddingVertical,
          paddingHorizontal: sizeStyles[size].paddingHorizontal,
        },
        variant === 'filled' && styles.filled,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      disabled={disabled}>
      <Text
        style={[
          styles.label,
          {fontSize: sizeStyles[size].fontSize},
          variant === 'filled' && styles.labelFilled,
          variant === 'outline' && styles.labelOutline,
          variant === 'ghost' && styles.labelGhost,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  filled: {
    backgroundColor: theme.colors.primary,
    ...theme.shadows.md,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
    transform: [{scale: 0.98}],
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelFilled: {
    color: '#FFFFFF',
  },
  labelOutline: {
    color: theme.colors.primaryLight,
  },
  labelGhost: {
    color: theme.colors.textSecondary,
  },
});
