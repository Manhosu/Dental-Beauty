export interface OutboundMessage {
  to: string; // número de destino (E.164 dígitos)
  from: string; // número do papel (dispatch/lead/...)
  text?: string;
  mediaUrl?: string;
}

export interface ChatbotifyClient {
  sendMessage(msg: OutboundMessage): Promise<{ messageId: string }>;
  suppressBot(conversationId: string): Promise<void>;
  resumeBot(conversationId: string): Promise<void>;
}
