import {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import {fetchChatHistory, sendChatMessage} from '../api/mobile-api';
import {ChatMessage} from '../api/types';
import {ChatMessageBubble} from '../components/ChatMessageBubble';
import {useAuth} from '../auth/auth-context';
import {theme} from '../theme';

const QUICK_ACTIONS = [
  {label: 'vente pain 1500', icon: '💰'},
  {label: 'dépense 500', icon: '📤'},
  {label: 'stock pain 50', icon: '📦'},
  {label: 'bilan jour', icon: '📊'},
  {label: 'liste produits', icon: '📋'},
];

export const ChatScreen = () => {
  const route = useRoute();
  const prefill = (route.params as {prefill?: string} | undefined)?.prefill;
  const {accessToken} = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');

  const loadHistory = useCallback(async () => {
    if (!accessToken) return;
    try {
      const history = await fetchChatHistory(accessToken, 30);
      setMessages(history.messages);
    } catch {
      Alert.alert('Erreur', "Impossible de charger l'historique.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (prefill) {
      setInput(prefill);
    }
  }, [prefill]);

  const handleSend = async (text?: string) => {
    const toSend = (text ?? input).trim();
    if (!accessToken || !toSend) {
      if (!toSend) Alert.alert('Erreur', 'Veuillez saisir un message.');
      return;
    }

    try {
      setSending(true);
      const result = await sendChatMessage(accessToken, toSend);
      const newMessage: ChatMessage = {
        id: result.messageId,
        message: toSend,
        response: result.response,
        timestamp: result.timestamp,
      };
      setMessages((prev) => [newMessage, ...prev]);
      setInput('');
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer le message.");
    } finally {
      setSending(false);
    }
  };

  const handleQuickAction = (label: string) => {
    handleSend(label);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primaryLight} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      {/* Quick actions bar */}
      <View style={styles.quickActionsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => handleQuickAction(action.label)}
              style={({pressed}) => [
                styles.chip,
                pressed && styles.chipPressed,
              ]}
              disabled={sending}>
              <Text style={styles.chipIcon}>{action.icon}</Text>
              <Text style={styles.chipLabel} numberOfLines={1}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({item}) => <ChatMessageBubble item={item} />}
        contentContainerStyle={styles.list}
        inverted
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{'💬'}</Text>
            <Text style={styles.emptyTitle}>Aucun message</Text>
            <Text style={styles.emptyHint}>
              Tapez une commande ou utilisez les raccourcis ci-dessus
            </Text>
          </View>
        }
      />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ex: vente pain 1500..."
            placeholderTextColor={theme.colors.textMuted}
            value={input}
            onChangeText={setInput}
            editable={!sending}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />
        </View>
        <Pressable
          onPress={() => handleSend()}
          disabled={sending}
          style={({pressed}) => [
            styles.sendBtn,
            sending && styles.sendBtnDisabled,
            pressed && !sending && styles.sendBtnPressed,
          ]}>
          <Text style={styles.sendBtnText}>
            {sending ? '...' : '↑'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },

  quickActionsBar: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bgCard,
  },
  quickActions: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.chipBg,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
  },
  chipPressed: {
    backgroundColor: theme.colors.chipBgActive,
    borderColor: theme.colors.primary,
  },
  chipIcon: {
    fontSize: 18,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },

  list: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    flexGrow: 1,
  },
  empty: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  emptyHint: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bgCard,
  },
  inputContainer: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.lg,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    maxHeight: 48,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnPressed: {
    opacity: 0.85,
    transform: [{scale: 0.95}],
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 20,
  },
});
