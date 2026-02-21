import {Pressable, StyleSheet, View, ViewStyle} from 'react-native';
import {theme} from '../theme';

type GlassCardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
  glow?: boolean;
};

export const GlassCard = ({children, onPress, style, containerStyle, glow}: GlassCardProps) => {
  const inner = (
    <View style={[styles.card, glow && styles.glow, style]}>{children}</View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({pressed}) => [containerStyle, pressed && styles.pressed]}>
        {inner}
      </Pressable>
    );
  }

  if (containerStyle) {
    return <View style={containerStyle}>{inner}</View>;
  }

  return inner;
};

const styles = StyleSheet.create({
  card: {
    ...theme.glass,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  glow: {
    borderColor: theme.colors.borderGlow,
    ...theme.shadows.glow,
  },
  pressed: {
    opacity: 0.88,
    transform: [{scale: 0.985}],
  },
});
