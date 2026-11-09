import { Router } from 'express';
import { z } from 'zod';
import { AutoshipAssistant } from './assistant.js';
const askSchema = z.object({ question: z.string().min(3), customerId: z.literal('maya-chen') }).strict();
const confirmSchema = z.object({ token: z.string().uuid(), customerId: z.literal('maya-chen') }).strict();
export function createAssistantRouter(assistant: AutoshipAssistant): Router { const router = Router(); router.post('/messages', async (req, res) => { try { const input = askSchema.parse(req.body); res.json(await assistant.ask(input.customerId, input.question)); } catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : 'Assistant request failed.' }); } }); router.post('/actions/confirm', async (req, res) => { try { const input = confirmSchema.parse(req.body); res.json(await assistant.confirm(input.customerId, input.token)); } catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : 'Confirmation failed.' }); } }); return router; }
