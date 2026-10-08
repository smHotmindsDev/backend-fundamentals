import { Router } from 'express';
export const topBooksRouter = Router();

topBooksRouter.get('/', async (req, res) => {
    const dbRes = await req.db.query(
        `
        SELECT books.book_id, books.title, COUNT(loans.loan_id)::int AS borrow_count
        FROM books
        LEFT JOIN loans
          ON loans.book = books.book_id
         AND loans.borrowed_at >= CURRENT_DATE - INTERVAL '90 day'
        GROUP BY books.book_id
        ORDER BY borrow_count DESC, books.book_id ASC
        LIMIT 10;
        `,
    );

    return res.status(200).json(dbRes.rows);
});
