export const MAX_PER_PAGE = 100;

export function createPagination({ page, perPage }) {
    const limit = Math.min(perPage, MAX_PER_PAGE);
    const offset = (page - 1) * limit;

    return {
        limit,
        offset,
    };
}
