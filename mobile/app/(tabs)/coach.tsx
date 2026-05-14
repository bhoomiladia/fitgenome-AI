/**
 * Coach Screen — AI chat connected to POST /chat backend.
 */

import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useChat, useChatHistory } from '@/hooks/useChat';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

interface Message {
  id: string;
  role: 'user' | 'coach';
  text: string;
  timestamp: Date;
}

export default function CoachScreen() {
  const chatMutation = useChat();
  const { data: history, isLoading: isHistoryLoading } = useChatHistory();
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  React.useEffect(() => {
    if (history && !hasLoadedHistory) {
      if (history.length === 0) {
        setMessages([
          {
            id: '1',
            role: 'coach',
            text: "Hey! I'm your FitGenome AI coach. I can help with workout adjustments, nutrition advice, and recovery tips. What would you like to know?",
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages(history.map((m: any) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          timestamp: new Date(m.timestamp),
        })));
      }
      setHasLoadedHistory(true);
    }
  }, [history, hasLoadedHistory]);

  const [suggestions, setSuggestions] = useState([
    '💪 Adjust my workout',
    '🥗 What should I eat?',
    '😴 Recovery tips',
    '📈 Track my progress',
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    chatMutation.mutate({
      message: text.trim(),
      history: messages.map(m => ({ role: m.role, text: m.text }))
    }, {
      onSuccess: (data) => {
        const coachMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'coach',
          text: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, coachMsg]);
        if (data.suggestions?.length) setSuggestions(data.suggestions);
        setIsTyping(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      },
      onError: () => {
        const errMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'coach',
          text: "Sorry, I'm having trouble connecting right now. Please try again in a moment! 🔄",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setIsTyping(false);
      },
    });
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <LinearGradient colors={Colors.gradientPurpleCyan} style={s.coachAvatar}>
          <Text style={{ fontSize: 18 }}>🤖</Text>
        </LinearGradient>
        <View>
          <Text style={s.headerTitle}>AI Coach</Text>
          <Text style={s.headerSub}>{isTyping ? 'typing...' : 'Online'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView
          ref={scrollRef}
          style={s.messages}
          contentContainerStyle={{ paddingBottom: 16 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {isHistoryLoading && (
            <View style={{ padding: 20 }}>
              <ActivityIndicator color={Colors.lavender} />
            </View>
          )}

          {messages.map((msg) => (
            <View key={msg.id} style={[s.bubble, msg.role === 'user' ? s.userBubble : s.coachBubble]}>
              {msg.role === 'coach' ? (
                <Markdown style={markdownStyles}>
                  {msg.text}
                </Markdown>
              ) : (
                <Text style={[s.bubbleText, s.userText]}>
                  {msg.text}
                </Text>
              )}
              <Text style={s.timestamp}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))}

          {isTyping && (
            <View style={[s.bubble, s.coachBubble]}>
              <ActivityIndicator size="small" color={Colors.lavender} />
            </View>
          )}
        </ScrollView>

        {/* Suggested prompts */}
        <View style={s.suggestionsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestionsRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {suggestions.map((prompt) => (
              <Pressable key={prompt} onPress={() => sendMessage(prompt)} style={s.chip} disabled={isTyping}>
                <Text style={s.chipText}>{prompt}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask your coach..."
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
            editable={!isTyping}
          />
          <Pressable onPress={() => sendMessage(input)} style={s.sendBtn} disabled={isTyping || !input.trim()}>
            <LinearGradient colors={Colors.gradientPurpleCyan} style={[s.sendGrad, (!input.trim() || isTyping) && { opacity: 0.4 }]}>
              <Ionicons name="send" size={18} color="#000" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  coachAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.xs, color: Colors.mint },
  messages: { flex: 1, paddingHorizontal: Spacing.md },
  bubble: { maxWidth: '80%', padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.sm },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.lavender + '20', borderBottomRightRadius: 4 },
  coachBubble: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceLight, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: FontSize.md, lineHeight: 22 },
  userText: { color: Colors.lavender },
  coachText: { color: Colors.textPrimary },
  timestamp: { fontSize: 10, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  suggestionsContainer: { maxHeight: 50 },
  suggestionsRow: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingVertical: 8 },
  chip: { backgroundColor: Colors.surfaceLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.cardBorder },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 8, borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingBottom: 30 },
  input: { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.full, paddingHorizontal: 16, paddingVertical: 12, fontSize: FontSize.md, color: Colors.textPrimary },
  sendBtn: { borderRadius: 20, overflow: 'hidden' },
  sendGrad: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

const markdownStyles = {
  body: { color: Colors.textPrimary, fontSize: FontSize.md, lineHeight: 22 },
  strong: { fontWeight: 'bold' as const, color: Colors.textPrimary },
  em: { fontStyle: 'italic' as const, color: Colors.textPrimary },
  link: { color: Colors.mint, textDecorationLine: 'underline' as const },
  heading1: { fontSize: FontSize.lg, fontWeight: 'bold' as const, color: Colors.textPrimary, marginVertical: 8 },
  heading2: { fontSize: FontSize.md, fontWeight: 'bold' as const, color: Colors.textPrimary, marginVertical: 8 },
  paragraph: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
};
