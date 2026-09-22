import { Router } from 'express';
import ServerError from "../utils/ServerError.js";
import {loansBodySchema} from "../schemas/loans.js";
export const loansRouter = Router();

const valueAt = (input, path) => path.reduce((current, key) => current?.[key], input);

const detailCode = (issue, input) => {
    if (issue.code === 'invalid_format') return 'invalid_format';
    if (issue.code === 'too_small' || issue.code === 'too_big') return 'out_of_range';
    if (issue.code === 'unrecognized_keys') return 'unknown_field';
    if (issue.code === 'invalid_type' && valueAt(input, issue.path) === undefined) return 'required';
    return 'invalid_type';
};

const validationDetails = (issues, input) => issues.map((issue) => ({
    field: issue.path.join('.') === 'idempotencyKey' ? 'Idempotency-Key' : (issue.path.join('.') || 'body'),
    code: detailCode(issue, input),
    message: issue.message,
}));

async function findByIdempotencyKey(client, idempotencyKey){
    // Check for the existence of the Idempotency Key
    const existingKey = await client.query(
        `SELECT loan_id, member, book, borrowed_at, due_at
            FROM loans
            WHERE idempotency_key = $1`,
        [idempotencyKey]
    );

   return existingKey.rows[0];
}

async function borrow(client, {member, book, idempotencyKey}) {
    const existing = await findByIdempotencyKey(client, idempotencyKey);
    if (existing) return existing;

    // Check for the existence of the member
    const existingMember = await client.query(
        `SELECT member_id
             FROM members
             WHERE members.member_id = $1;`,
        [member]
    );

    if (existingMember.rowCount === 0) {
        throw ServerError.notFound(`Member with id:${member} undefined`);
    }

    // Check for the existence of the book
    const existingBook = await client.query(
        `SELECT book_id
             FROM books
             WHERE books.book_id = $1;`,
        [book]
    );

    if (existingBook.rowCount === 0) {
        throw ServerError.notFound(`Book with id:${book} undefined`)
    }

    // Check for the available copies of book
    const availableCopies = await client.query(`
            SELECT book_copies.copy_id
            FROM book_copies
                LEFT JOIN loans
                    ON loans.copy_id = book_copies.copy_id
                    AND loans.returned_at IS NULL
            WHERE book_copies.book_id = $1
              AND loans.loan_id IS NULL
            ORDER BY book_copies.copy_id;
        `, [book]);

    if (availableCopies.rows.length === 0) {
        throw ServerError.conflict('copy already taken, conflict');
    }

    // Create the loan
    const created = await client.query(`
            INSERT INTO loans(loan_id, member, book, copy_id, borrowed_at, due_at, idempotency_key)
            VALUES (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                CURRENT_DATE,
                CURRENT_DATE + INTERVAL '2 week',
                $4
            )
            RETURNING loan_id, member, book, borrowed_at, due_at;
        `, [member, book, availableCopies.rows[0]['copy_id'], idempotencyKey]);

    return created.rows[0];
}

loansRouter.post('/', async (req, res, next) => {
    // The data sent from the client lives inside req.body
    const member = req.body.member;
    const book = req.body.book;
    const idempotencyKey = req.headers['idempotency-key'];
    const bodyData = { member, book, idempotencyKey };

    const validBodyData = loansBodySchema.safeParse(bodyData);

    if (!validBodyData.success) {
        throw ServerError.validation('Validation failed', validationDetails(validBodyData.error.issues, bodyData));
    }

    const client = await req.db.connect();

    try {
        // Start the transaction
        await client.query('BEGIN');
        const loan = await borrow(client, {member, book, idempotencyKey});
        await client.query('COMMIT');
        return res.status(201).json(loan);
    } catch(err) {
        // Rollback if any query failed
        await client.query('ROLLBACK');

        if (err.code === '23505' && err.constraint === 'uidx_borrowed_book_copy') {
            throw ServerError.conflict('copy already taken, conflict');
        } else if (err.code === '23505' && err.constraint === 'uidx_loans_idempotency_key') {
            const existing = await findByIdempotencyKey(client, idempotencyKey);
            if (existing) return  res.status(201).json(existing);
        }

        // ServerError passes through the error handler as is; anything else becomes 500.
        throw err;
    } finally {
            // CRITICAL: Always release the client back to the pool
            client.release();
        }
});
