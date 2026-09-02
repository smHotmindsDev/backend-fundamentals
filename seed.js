import { Client } from "pg";
import validateEnv from "./utils/validateEnv.js";

const AUTHORS = 5_000;
const UNBORROWED_AUTHORS = 200;
const MEMBERS = 10_000;
const UNBORROWED_MEMBERS = 500;
const BOOKS = 50_000;
const UNBORROWED_BOOKS = 2_000;
const LOANS = 500_000;

const FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
    "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Christopher", "Karen", "Charles", "Lisa", "Daniel", "Nancy",
    "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
    "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
    "Timothy", "Deborah",
];

const LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas",
    "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White",
    "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young",
    "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts",
];

const ADJECTIVES = [
    "Silent", "Hidden", "Broken", "Golden", "Empty", "Ancient", "Quiet", "Bright",
    "Forgotten", "Crystal", "Lonely", "Frozen", "Secret", "Narrow", "Wild", "Pale",
    "Distant", "Iron", "Gentle", "Shattered", "Velvet", "Hollow", "Burning", "Still",
    "Endless", "Fading", "Silver", "Crooked", "Deep", "Northern",
];

const NOUNS = [
    "Garden", "River", "Library", "Harbor", "Mirror", "Forest", "Clock", "Window",
    "Bridge", "Lantern", "Sparrow", "Ocean", "Mountain", "Letter", "Shadow", "Orchard",
    "Compass", "Ember", "Meadow", "Passport", "Lighthouse", "Notebook", "Valley", "Crown",
    "Station", "Canvas", "Thunder", "Anchor", "Corridor", "Horizon",
];

const isValidEnv = validateEnv(process.env);
const env = isValidEnv.env ? isValidEnv.env : null;

if (!env) {
    console.error("Invalid environment; refusing to seed.");
    process.exit(1);
}

const client = new Client({
    user: env.POSTGRES_USER,
    host: "localhost",
    database: env.POSTGRES_DB,
    password: env.POSTGRES_PASSWORD,
    port: 5432,
});

function sqlTextArray(values) {
    return `ARRAY[${values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ")}]::text[]`;
}

const borrowableAuthors = AUTHORS - UNBORROWED_AUTHORS;
const borrowableMembers = MEMBERS - UNBORROWED_MEMBERS;
const borrowableBooks = BOOKS - UNBORROWED_BOOKS;

async function seed() {
    const started = Date.now();

    try {
        await client.connect();
        await client.query("BEGIN");
        await client.query("SET LOCAL synchronous_commit = off");

        console.log("Truncating tables...");
        await client.query("TRUNCATE loans, books, members, authors CASCADE");

        console.log(`Inserting ${AUTHORS} authors...`);
        await client.query(`
            CREATE TEMP TABLE seed_authors AS
            SELECT
                n,
                gen_random_uuid() AS author_id,
                (${sqlTextArray(FIRST_NAMES)})[1 + ((n - 1) % ${FIRST_NAMES.length})] AS first_name,
                (${sqlTextArray(LAST_NAMES)})[1 + ((n - 1) % ${LAST_NAMES.length})] AS last_name
            FROM generate_series(1, ${AUTHORS}) AS n;

            INSERT INTO authors (author_id, first_name, last_name)
            SELECT author_id, first_name, last_name FROM seed_authors;
        `);

        console.log(`Inserting ${MEMBERS} members...`);
        await client.query(`
            CREATE TEMP TABLE seed_members AS
            SELECT
                n,
                gen_random_uuid() AS member_id,
                (${sqlTextArray(FIRST_NAMES)})[1 + ((n - 1) % ${FIRST_NAMES.length})] AS first_name,
                (${sqlTextArray(LAST_NAMES)})[1 + (((n - 1) / ${FIRST_NAMES.length}) % ${LAST_NAMES.length})] AS last_name
            FROM generate_series(1, ${MEMBERS}) AS n;

            INSERT INTO members (member_id, first_name, last_name)
            SELECT member_id, first_name, last_name FROM seed_members;
        `);

        console.log(`Inserting ${BOOKS} books...`);
        await client.query(`
            CREATE TEMP TABLE seed_books AS
            SELECT
                n,
                gen_random_uuid() AS book_id,
                CASE
                    WHEN n % 250 = 0 THEN 'Database '
                    WHEN n % 250 = 1 THEN 'Midnight '
                    WHEN n % 250 = 2 THEN 'Quantum '
                    ELSE ''
                END
                || (${sqlTextArray(ADJECTIVES)})[1 + ((n - 1) % ${ADJECTIVES.length})]
                || ' '
                || (${sqlTextArray(NOUNS)})[1 + ((n - 1) % ${NOUNS.length})]
                || ' '
                || n::text AS title,
                CASE
                    WHEN n <= ${borrowableBooks}
                        THEN 1 + ((n - 1) % ${borrowableAuthors})
                    ELSE ${borrowableAuthors} + 1 + ((n - ${borrowableBooks} - 1) % ${UNBORROWED_AUTHORS})
                END AS author_n,
                1 + ((n - 1) % 5) AS total_copies
            FROM generate_series(1, ${BOOKS}) AS n;

            INSERT INTO books (book_id, title, author, available_copies, total_copies)
            SELECT
                sb.book_id,
                sb.title,
                sa.author_id,
                sb.total_copies,
                sb.total_copies
            FROM seed_books sb
            JOIN seed_authors sa ON sa.n = sb.author_n;
        `);

        console.log(`Inserting ${LOANS} loans (this is the slow step)...`);
        await client.query(`
            WITH ids AS (
                SELECT
                    (SELECT array_agg(member_id ORDER BY n) FROM seed_members WHERE n <= ${borrowableMembers}) AS member_ids,
                    (SELECT array_agg(book_id ORDER BY n) FROM seed_books WHERE n <= ${borrowableBooks}) AS book_ids
            )
            INSERT INTO loans (member, book, borrowed_at, due_at, returned_at)
            SELECT
                member_ids[1 + ((i - 1) % ${borrowableMembers})],
                book_ids[1 + (((i - 1) * 17) % ${borrowableBooks})],
                borrowed_at,
                borrowed_at + 14,
                CASE
                    WHEN i % 10 < 8 THEN borrowed_at + (1 + (i % 13))
                    ELSE NULL
                END
            FROM ids,
                 generate_series(1, ${LOANS}) AS g(i),
                 LATERAL (SELECT (CURRENT_DATE - (1 + ((i * 13) % 540)))::date AS borrowed_at) AS d;
        `);

        console.log("Capping open loans to each book's total_copies...");
        await client.query(`
            WITH ranked AS (
                SELECT
                    l.loan_id,
                    b.total_copies,
                    row_number() OVER (PARTITION BY l.book ORDER BY l.borrowed_at DESC) AS rn
                FROM loans l
                JOIN books b ON b.book_id = l.book
                WHERE l.returned_at IS NULL
            )
            UPDATE loans l
            SET returned_at = l.due_at
            FROM ranked r
            WHERE l.loan_id = r.loan_id
              AND r.rn > r.total_copies;
        `);

        console.log("Updating available_copies from open loans...");
        await client.query(`
            UPDATE books b
            SET available_copies = b.total_copies - c.open_count
            FROM (
                SELECT book, COUNT(*)::int AS open_count
                FROM loans
                WHERE returned_at IS NULL
                GROUP BY book
            ) c
            WHERE b.book_id = c.book;
        `);

        await client.query("COMMIT");
        await client.query("ANALYZE authors, members, books, loans");

        const stats = await client.query(`
            SELECT 'authors' AS relation, COUNT(*)::bigint AS n FROM authors
            UNION ALL SELECT 'members', COUNT(*) FROM members
            UNION ALL SELECT 'books', COUNT(*) FROM books
            UNION ALL SELECT 'loans', COUNT(*) FROM loans
            UNION ALL SELECT 'open_loans', COUNT(*) FROM loans WHERE returned_at IS NULL
            UNION ALL SELECT 'overdue_open_loans', COUNT(*) FROM loans
                     WHERE returned_at IS NULL AND due_at < CURRENT_DATE
            UNION ALL SELECT 'loans_last_90_days', COUNT(*) FROM loans
                     WHERE borrowed_at >= CURRENT_DATE - 90
            UNION ALL SELECT 'authors_never_borrowed', COUNT(*) FROM authors a
                     WHERE NOT EXISTS (
                         SELECT 1
                         FROM books b
                         JOIN loans l ON l.book = b.book_id
                         WHERE b.author = a.author_id
                     )
            UNION ALL SELECT 'members_with_no_loans', COUNT(*) FROM members m
                     WHERE NOT EXISTS (
                         SELECT 1 FROM loans l WHERE l.member = m.member_id
                     );
        `);

        console.log("\nSeed complete:");
        for (const row of stats.rows) {
            console.log(`  ${row.relation}: ${row.n}`);
        }
        console.log(`\nTook ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // connection may already be dead
        }
        console.error("Seed failed:", err.stack);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

seed();
