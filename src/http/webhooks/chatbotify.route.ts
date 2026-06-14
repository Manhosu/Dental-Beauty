import { inboundMessageSchema, type InboundMessage } from './chatbotify.schema';

export interface IdempotencyStore {
  alreadyProcessed(id: string): Promise<boolean>;
  markProcessed(id: string): Promise<void>;
}

export interface InboundDeps {
  enqueue: (msg: InboundMessage) => Promise<void>;
  idempotency: IdempotencyStore;
}

export type InboundResult =
  | { status: 'enqueued' }
  | { status: 'duplicate' }
  | { status: 'invalid'; issues: unknown };

export async function handleInbound(raw: unknown, deps: InboundDeps): Promise<InboundResult> {
  const parsed = inboundMessageSchema.safeParse(raw);
  if (!parsed.success) return { status: 'invalid', issues: parsed.error.issues };

  const msg = parsed.data;
  if (await deps.idempotency.alreadyProcessed(msg.eventId)) return { status: 'duplicate' };

  await deps.enqueue(msg);
  await deps.idempotency.markProcessed(msg.eventId);
  return { status: 'enqueued' };
}
