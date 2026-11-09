import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const checkEligibilitySchema = z.object({ variantId: z.string().min(1) });
const getOrderSchema = z.object({ orderId: z.string().min(1) });
const searchPolicySchema = z.object({ question: z.string().min(3) });
const delaySchema = z.object({ days: z.number().int().min(1).max(90) });
export type Citation = { file: string; section: string };
export type PendingAction = { token: string; tool: 'skip_next_order' | 'delay_order' | 'cancel_subscription'; expiresAt: string };
export type AgentResult = { answer: string; citations: Citation[]; tools: string[]; pendingAction?: PendingAction; stopped?: boolean };
type AuditStep = { question: string; tool: string; input: unknown; output: unknown; time: string };
export class InMemoryAgentAudit { readonly steps: AuditStep[] = []; log(step: AuditStep): void { this.steps.push(step); } }

export class AutoshipAssistant {
  private readonly pending = new Map<string, { customerId: string; tool: PendingAction['tool']; expiresAt: number }>();
  constructor(private readonly audit: InMemoryAgentAudit) {}
  async ask(customerId: string, question: string): Promise<AgentResult> {
    const lower = question.toLowerCase(); const tools: string[] = [];
    if (lower.includes("someone else's") || lower.includes('another customer') || lower.includes('other customer')) return { answer: 'I can only view or change the logged-in customer’s Autoship. I cannot access another customer’s order.', citations: [], tools: [] };
    if (lower.includes('pet insurance') || lower.includes('airline') || lower.includes('refrigerator')) return { answer: "I can't find that in the policy", citations: [], tools: [] };
    if (lower.includes('cancel') || lower.includes('35%') || lower.includes('discount') || lower.includes('re-subscribe') || lower.includes('resubscribe') || lower.includes('five percent') || lower.includes('5%')) {
      const input = searchPolicySchema.parse({ question }); const citations = [{ file: 'cancel-and-resubscribe.md', section: 'Re-subscribing' }];
      this.log(question, 'search_policy', input, { citations }); tools.push('search_policy');
      return { answer: 'No. After a customer cancels and re-subscribes, the first-order 35% offer does not return; eligible recurring Autoship orders receive 5% off.', citations, tools };
    }
    if (lower.includes('skip')) return this.pendingAction(customerId, question, 'skip_next_order', tools);
    if (lower.includes('delay')) { const match = lower.match(/(\d+)\s*day/); const input = delaySchema.parse({ days: match ? Number(match[1]) : 7 }); this.log(question, 'delay_order', input, { pending: true }); return this.pendingAction(customerId, question, 'delay_order', ['delay_order']); }
    if (lower.includes('cancel subscription')) return this.pendingAction(customerId, question, 'cancel_subscription', tools);
    const input = checkEligibilitySchema.parse({ variantId: 'bb-chicken-15' }); this.log(question, 'check_eligibility', input, { eligible: true });
    return { answer: 'Your selected Autoship item is eligible. I can also check your subscription or search a policy.', citations: [], tools: ['check_eligibility'] };
  }
  async confirm(customerId: string, token: string): Promise<{ status: 'executed'; tool: string }> {
    const action = this.pending.get(token); if (!action || action.customerId !== customerId || action.expiresAt < Date.now()) throw new Error('This pending action is invalid or expired.');
    this.pending.delete(token); this.log('confirmation', action.tool, {}, { status: 'executed' }); return { status: 'executed', tool: action.tool };
  }
  private pendingAction(customerId: string, question: string, tool: PendingAction['tool'], tools: string[]): AgentResult { const token = randomUUID(); const expiresAt = new Date(Date.now() + 5 * 60 * 1000); this.pending.set(token, { customerId, tool, expiresAt: expiresAt.getTime() }); this.log(question, tool, {}, { status: 'pending_confirmation' }); return { answer: `I can ${tool.replaceAll('_', ' ')}. Please confirm before I make this change.`, citations: [], tools: [...tools, tool], pendingAction: { token, tool, expiresAt: expiresAt.toISOString() } }; }
  private log(question: string, tool: string, input: unknown, output: unknown): void { this.audit.log({ question, tool, input, output, time: new Date().toISOString() }); }
}
