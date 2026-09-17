import * as z from "zod";

const urlString = z.preprocess(
    (val) => (typeof val === "string" ? decodeURIComponent(val) : val),
    z.string()
);

export const booksQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    per_page: z.coerce.number().int().positive().default(10),
    search: z.string().optional()
});