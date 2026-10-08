import { Router } from 'express';
import { booksQuerySchema } from '../schemas/books.js';
import { createPagination } from '../utils/pagination.js';
import ServerError from '../utils/ServerError.js';
export const booksRouter = Router();

function escape(value) {
    return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

async function baseQuery(db, { limit, offset }) {
    return await db.query(
        `
        SELECT *
        FROM books
        ORDER BY book_id DESC
        LIMIT $1 OFFSET $2;
        `,
        [limit, offset],
    );
}

async function searchQuery(db, { limit, offset, search }) {
    const searchFragment = escape(search);

    return await db.query(
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

booksRouter.get('/', async (req, res) => {
    const queryInput = req.query;
    const validQuery = booksQuerySchema.safeParse(queryInput);
    if (!validQuery.success) throw ServerError.badRequest('invalid query parameter');

    const { page, per_page: perPage, search } = validQuery.data;

    const { limit, offset } = createPagination({ page, perPage });

    const dbRes = search
        ? await searchQuery(req.db, { limit, offset, search })
        : await baseQuery(req.db, { limit, offset });

    return res.status(200).json(dbRes.rows);
});
