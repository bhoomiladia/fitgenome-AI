/**
 * AI Coach chat hook — sends messages to POST /chat.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { chatApi } from '@/lib/api';

interface ChatResult {
  reply: string;
  suggestions: string[];
}

export function useChat() {
  return useMutation<ChatResult, Error, { message: string; history: { role: string; text: string }[] }>({
    mutationFn: async ({ message, history }) => {
      const { data } = await chatApi.send({ message, history });
      return data;
    },
  });
}

export function useChatHistory() {
  return useQuery({
    queryKey: ['chatHistory'],
    queryFn: async () => {
      const { data } = await chatApi.getHistory();
      return data;
    },
  });
}
