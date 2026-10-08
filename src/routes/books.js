import { Router } from 'express';
import { booksQuerySchema } from '../schemas/books.js';
import { createPagination } from '../utils/pagination.js';
import ServerError from '../utils/ServerError.js';
export const booksRouter = Router();

function escape(value) {
    return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

async function baseQuery(client, { limit, offset }) {
    return await client.query(
        `
        SELECT *
        FROM books
        ORDER BY book_id DESC
        LIMIT $1 OFFSET $2;
        `,
        [limit, offset],
    );
}

async function searchQuery(client, { limit, offset, search }) {
    const searchFragment = escape(search);

    return await client.query(
        `
        SELECT *
        FROM books
        WHERE books.title ILIKE '%' || $3 || '%' ESCAPE '\\'
        ORDER BY book_id DESC
        LIMIT $1 OFFSET $2;
        `,
        [limit, offset, searchFragment],
    );
}

booksRouter.get('/', async (req, res, next) => {
    const queryInput = req.query;
    const validQuery = booksQuerySchema.safeParse(queryInput);
    if (!validQuery.success) throw ServerError.badRequest('invalid query parameter');

    const client = await req.db.connect();

    const { page, per_page: perPage, search } = validQuery.data;

    const { limit, offset } = createPagination({ page, perPage });

    try {
        const dbRes = search
            ? await searchQuery(client, { limit, offset, search })
            : await baseQuery(client, { limit, offset });

        return res.status(200).json(dbRes.rows);
    } finally {
        client.release();
    }
});
