import type { Conversation } from '../types/conversation';
import type { Message } from '../types/message';

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const conversationDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});

const conversationTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

export const getConversationParticipant = (
  conversation: Conversation,
  loggedUserId: number
): {
  id: number;
  nickname: string;
} => {
  if (conversation.senderId === loggedUserId) {
    return {
      id: conversation.recipientId,
      nickname: conversation.recipientNickname,
    };
  }

  return {
    id: conversation.senderId,
    nickname: conversation.senderNickname,
  };
};

export const sortConversations = (
  conversations: Conversation[]
): Conversation[] => {
  return [...conversations].sort(
    (a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp
  );
};

export const sortMessages = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => a.timestamp - b.timestamp);
};

export const formatTimestamp = (timestamp: number): string => {
  return dateTimeFormatter.format(new Date(timestamp * 1000));
};

export const formatConversationTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  const formattedDate = conversationDateFormatter.format(date);
  const formattedTime = conversationTimeFormatter.format(date);

  return `${formattedDate} ${formattedTime}`;
};
