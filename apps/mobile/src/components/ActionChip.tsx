import {Pressable, StyleSheet, Text} from 'react-native';
import {theme} from '../theme';

type ActionChipProps = {
  label: string;
  onPress: () => void;
  icon?: string;
  variant?: 'default' | 'primary' | 'outline';
};

export const ActionChip = ({
  label,
  onPress,
  icon,
  variant = 'default',
}: ActionChipProps) => {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.chip,
        variant === 'primary' && styles.chipPrimary,
        variant === 'outline' && styles.chipOutline,
        pressed && styles.chipPressed,
      ]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text
        style={[
          styles.label,
          variant === 'primary' && styles.labelPrimary,
        ]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.chipBg,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
  },
  chipPrimary: {
    backgroundColor: theme.colors.chipBgActive,
    borderColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  chipOutline: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  chipPressed: {
    opacity: 0.8,
    transform: [{scale: 0.97}],
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  labelPrimary: {
    color: theme.colors.primaryLight,
  },
});
