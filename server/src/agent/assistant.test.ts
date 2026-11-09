import { describe, expect, it } from 'vitest';
import { InMemoryAgentAudit, AutoshipAssistant } from './assistant.js';

describe('Autoship assistant', () => {
  it('returns a policy citation for the first-offer cancellation question', async () => {
    const assistant = new AutoshipAssistant(new InMemoryAgentAudit());
    const result = await assistant.ask('maya-chen', 'Do I still get 35% off if I cancel and come back?');
    expect(result.answer).toContain('5%');
    expect(result.citations).toContainEqual({ file: 'cancel-and-resubscribe.md', section: 'Re-subscribing' });
  });

  it('creates a pending skip action and only executes after confirmation', async () => {
    const assistant = new AutoshipAssistant(new InMemoryAgentAudit());
    const result = await assistant.ask('maya-chen', 'Skip my next order');
    expect(result.pendingAction?.tool).toBe('skip_next_order');
    expect(await assistant.confirm('maya-chen', result.pendingAction!.token)).toMatchObject({ status: 'executed' });
  });
});
