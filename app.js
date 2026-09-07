import { Pool } from 'pg';
import validateEnv from "./utils/validateEnv.js";

const isValidEnv = validateEnv(process.env);
const env = isValidEnv.env ? isValidEnv.env : null;

const pool = new Pool({
    user: env.POSTGRES_USER,
    host: 'localhost',
    database: env.POSTGRES_DB,
    password: env.POSTGRES_PASSWORD,
    port: 5432,
});

const placeholderBookId = '6671f051-aca5-40e9-824d-f98cf01f4253';
const placeholderMemberId = '788dc593-c871-4936-8995-3fa915450fe9';

const chkAvailabilitySql = `
    SELECT book_id, available_copies, total_copies
    FROM books
    WHERE book_id = $1
    ;
`;

const chkAvailabilityCopySql = `
    SELECT book_copies.copy_id
    FROM book_copies
    LEFT JOIN loans
        ON loans.copy_id = book_copies.copy_id
            AND loans.returned_at IS NULL
    WHERE book_copies.book_id = $1
      AND loans.loan_id IS NULL;
`;

const insertLoanSql = `
    INSERT INTO loans(loan_id, member, book, copy_id, borrowed_at, due_at)
    VALUES (
        gen_random_uuid(),
        $1, 
        $2, 
        $3,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '2 week'
        );
`;

const decrementAvailableCopiesSql = `
    UPDATE books
    SET available_copies = available_copies-1
    WHERE book_id = $1;    
`;

async function borrowBook() {
    // You MUST check out a specific client instance for a transaction
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const resultChkAvailability = await client.query(chkAvailabilitySql, [placeholderBookId]);

        if (Array.isArray(resultChkAvailability.rows) && resultChkAvailability.rows.length === 1) {
            const book = resultChkAvailability.rows[0];

            const bookId = book.book_id;
            const availableCopies = book.available_copies;

            if (availableCopies >= 1) {
                const chkAvailabilityCopy = await client.query(chkAvailabilityCopySql, [bookId]);

                if (Array.isArray(chkAvailabilityCopy.rows) && chkAvailabilityCopy.rows.length > 0) {
                    const copy = chkAvailabilityCopy.rows[0];
                    const copyId = copy.copy_id;
                    console.log('Check availability:', bookId, copyId);

                    const valuesInsertLoanSql = [placeholderMemberId, bookId, copyId];

                    const resultInsertLoan = await client.query(insertLoanSql, valuesInsertLoanSql);
                    console.log(`Insert loan`, resultInsertLoan)

                    const valuesDecrementAvailableCopiesSql = [bookId];
                    const resultDecrementAvailableCopies = await client.query(decrementAvailableCopiesSql, valuesDecrementAvailableCopiesSql);
                    console.log(`Decrement available copies`, resultDecrementAvailableCopies)
                } else {
                    await client.query('ROLLBACK');
                    return {
                        result: false,
                        message: `Book with id:${placeholderBookId} has no copy available`
                    }
                }
            } else {
                await client.query('ROLLBACK');
                return {
                    result: false,
                    message: `Book with id:${placeholderBookId} has no copy available`
                }
            }
        } else {
            await client.query('ROLLBACK');
            return {
                result: false,
                message: `Book with id:${placeholderBookId} undefined`
            }
        }

        // Commit if all queries succeeded
        await client.query('COMMIT');
        return {
            result: true,
            message: `Book with id:${placeholderBookId} borrowed`
        };

    } catch (error) {
        // Rollback if any query failed
        await client.query('ROLLBACK');

        if (error.code === '23505') {
            return { result: false, message: 'copy already taken, conflict' }
        } else {
            throw error;
        }
    } finally {
        // CRITICAL: Always release the client back to the pool
        client.release();
    }
}

Promise.all([borrowBook(), borrowBook()]).then((values) => {
    console.log(values);
});