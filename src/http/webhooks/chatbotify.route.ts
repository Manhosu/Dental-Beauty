import { inboundMessageSchema, type InboundMessage } from './chatbotify.schema';

export interface IdempotencyStore {
  alreadyProcessed(id: string): Promise<boolean>;
  markProcessed(id: string): Promise<void>;
}

// IMPORTANTE (constraint para a implementação concreta — ver Spike/Fase pós-spike):
// `alreadyProcessed` + `markProcessed` NÃO são atômicos juntos. Entregas concorrentes
// do mesmo eventId podem passar ambas pela checagem antes de qualquer marcação,
// causando duplo-enqueue. A implementação real (ex: Redis) DEVE usar uma operação
// atômica de "claim" — ex: `SET <eventId> 1 NX EX <ttl>` retornando se foi o primeiro —
// em vez de um get-then-set ingênuo. Considerar trocar por um único `claim(id): boolean`.

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
