import {StyleSheet, Text, View} from 'react-native';
import {ChatMessage} from '../api/types';
import {theme} from '../theme';

type ChatMessageBubbleProps = {
  item: ChatMessage;
};

export const ChatMessageBubble = ({item}: ChatMessageBubbleProps) => {
  return (
    <View style={styles.container}>
      <View style={[styles.bubble, styles.userBubble]}>
        <Text style={styles.userText}>{item.message}</Text>
      </View>
      <View style={[styles.bubble, styles.botBubble]}>
        <Text style={styles.botText}>{item.response}</Text>
      </View>
      <Text style={styles.timestamp}>
        {new Date(item.timestamp).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  bubble: {
    padding: 14,
    borderRadius: theme.radii.lg,
    maxWidth: '88%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
    ...theme.shadows.sm,
  },
  botBubble: {
    alignSelf: 'flex-start',
    ...theme.glass,
    marginTop: 8,
    borderBottomLeftRadius: 4,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  botText: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  timestamp: {
    marginTop: 6,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
});
