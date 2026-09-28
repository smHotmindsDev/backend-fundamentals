import * as z from "zod";

export const loansHeaderSchema = z.object({
    idempotencyKey: z.uuidv4()
})

export const loansBodySchema = z.object({
    member: z.uuidv4(),
    book: z.uuidv4()
});