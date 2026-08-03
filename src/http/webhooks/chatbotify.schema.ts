import { z } from 'zod';

export const inboundMessageSchema = z
  .object({
    eventId: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    type: z.enum(['text', 'audio', 'image', 'document', 'other']),
    text: z.string().optional(),
    mediaUrl: z.string().url().optional(),
  })
  .passthrough();

export type InboundMessage = z.infer<typeof inboundMessageSchema>;
