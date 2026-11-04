import { Router } from 'express';
import { membersQuerySchema } from '../schemas/members.js';
import { escape } from '../utils/escape.js';
import { createPagination } from '../utils/pagination.js';
import ServerError from '../utils/ServerError.js';
export const membersRouter = Router();

async function baseQueryToMembers(db, { limit, offset }) {
    const res = await db.query(
        `
        SELECT members.member_id,
               members.first_name,
               members.last_name
        FROM members
        ORDER BY member_id DESC
        LIMIT $1 OFFSET $2;
        `,
        [limit, offset],
    );

    return res.rows;
}

async function searchQueryToMembers(db, { limit, offset, search }) {
    const searchFragment = escape(search);

    const res = await db.query(
        `
        SELECT members.member_id,
               members.first_name,
               members.last_name
         FROM members
        WHERE members.first_name || ' ' || members.last_name ILIKE '%' || $3 || '%' ESCAPE '\\'
        ORDER BY member_id DESC
        LIMIT $1 OFFSET $2;
        `,
        [limit, offset, searchFragment],
    );

    return res.rows;
}

async function baseQueryToLoans(db, { memberIds }) {
    const res = await db.query(
        `
        SELECT loans.loan_id,
               loans.member,
               loans.book,
               loans.borrowed_at,
               loans.due_at
        FROM loans
        WHERE loans.member = ANY($1) AND loans.returned_at IS NULL
        ORDER BY loans.loan_id DESC
        `,
        [memberIds],
    );

    return res.rows;
}

membersRouter.get('/', async (req, res) => {
    const queryInput = req.query;
    const validQuery = membersQuerySchema.safeParse(queryInput);
    if (!validQuery.success) throw ServerError.badRequest('invalid query parameter');

    const { page, per_page: perPage, search } = validQuery.data;

    const { limit, offset } = createPagination({ page, perPage });

    const members = search
        ? await searchQueryToMembers(req.db, { limit, offset, search })
        : await baseQueryToMembers(req.db, { limit, offset });

    if (members.length === 0) {
        return res.status(200).json([]);
    }

    const memberIds = members.map((m) => m.member_id);

    const loans = await baseQueryToLoans(req.db, { memberIds });

    const loansByMember = new Map();
    for (const loan of loans) {
        if (!loansByMember.has(loan.member)) {
            loansByMember.set(loan.member, []);
        }

        const { member, ...loanData } = loan;
        loansByMember.get(member).push(loanData);
    }

    const result = members.map((member) => ({
        member_id: member.member_id,
        first_name: member.first_name,
        last_name: member.last_name,
        loans: loansByMember.get(member.member_id) || [],
    }));

    return res.status(200).json(result);
});
