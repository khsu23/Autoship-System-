import { describe, expect, it } from 'vitest';
import { contentHash, parsePolicyDocument } from './policyParser.js';

describe('policy parser', () => {
  it('keeps each heading, rule, and exception together with source metadata', () => {
    const chunks = parsePolicyDocument('autoship-discounts.md', '# Autoship Discount Rules\nVersion: 1.2\n\n## First order\nSave 35% up to $20.\n\n**Exception:** Excluded sizes do not qualify.\n\n## Recurring orders\nSave 5% on eligible Autoship orders.');
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ file: 'autoship-discounts.md', version: '1.2', section: 'First order' });
    expect(chunks[0].content).toContain('Exception');
    expect(chunks[1].section).toBe('Recurring orders');
  });

  it('changes the content hash when a policy changes', () => {
    expect(contentHash('Version: 1.0\n## Rule\nSkip before noon.')).not.toBe(contentHash('Version: 1.1\n## Rule\nSkip before noon.'));
  });
});
