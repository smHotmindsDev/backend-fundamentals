import * as z from 'zod';

export const membersQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    per_page: z.coerce.number().int().positive().default(50),
    search: z.string().optional(),
});
