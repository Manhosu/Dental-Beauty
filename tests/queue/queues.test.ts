import { describe, it, expect } from 'vitest';
import { QUEUE_NAMES } from '../../src/queue/queues';

describe('queues', () => {
  it('define as filas esperadas', () => {
    expect(QUEUE_NAMES.inbound).toBe('inbound-messages');
    expect(QUEUE_NAMES.outbound).toBe('outbound-dispatch');
  });
});
