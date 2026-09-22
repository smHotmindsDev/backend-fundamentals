import * as z from "zod";

export const loansBodySchema = z.object({
    member: z.uuidv4(),
    book: z.uuidv4(),
    idempotencyKey: z.uuidv4()
});