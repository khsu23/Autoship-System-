import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AutoshipAssistant, InMemoryAgentAudit } from '../agent/assistant.js';

type EvalCase = { id: string; question: string; expectedTool: string | null; mustContain: string };
const cases = JSON.parse(await readFile(join(process.cwd(), 'evals', 'cases.json'), 'utf8')) as EvalCase[];
const assistant = new AutoshipAssistant(new InMemoryAgentAudit());
let passed = 0;
console.log('| Case | Tool | Fact | Result |'); console.log('| --- | --- | --- | --- |');
for (const testCase of cases) {
  const result = await assistant.ask('maya-chen', testCase.question);
  const actualTool = result.tools[0] ?? null;
  const toolOk = actualTool === testCase.expectedTool;
  const factOk = result.answer.toLowerCase().includes(testCase.mustContain.toLowerCase());
  const ok = toolOk && factOk; if (ok) passed += 1;
  console.log(`| ${testCase.id} | ${toolOk ? '✓' : `✗ expected ${testCase.expectedTool ?? 'none'}, got ${actualTool ?? 'none'}`} | ${factOk ? '✓' : `✗ missing “${testCase.mustContain}”`} | ${ok ? 'PASS' : 'FAIL'} |`);
}
console.log(`\nPass rate: ${passed}/${cases.length} (${Math.round(passed / cases.length * 100)}%)`);
process.exitCode = passed === cases.length ? 0 : 1;
