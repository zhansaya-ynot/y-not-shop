import { z } from 'zod';

export const NewsletterBroadcastSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
});

export type NewsletterBroadcastInput = z.infer<typeof NewsletterBroadcastSchema>;
