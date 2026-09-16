import { Router } from 'express';
export const router = Router();

router.get('/reports/top-books', async (req, res) => {
    res.json({ message: "Hello from a factory-generated route!" });
});
