import { Router } from 'express';
export const topBooksRouter = Router();

topBooksRouter.get('/', async (req, res) => {
    res.json({ message: 'Hello from a factory-generated route!' });
});
