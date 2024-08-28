import { Connection, VersionedTransaction, VersionedTransactionResponse, Transaction } from '@solana/web3.js';
import express, { Request, Response, NextFunction } from 'express';
import { logger, logInfo } from './utils/logger';
import { config } from './utils/config';
import { executeTransaction } from './transaction';
import { getSignature } from './utils/get-signature';

const port = config.port;

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// POST endpoint to receive Transaction object
app.post('/transactions', async (req: Request, res: Response) => {
    try {
        const { transaction: base64Transaction } = req.body;

        const uint8ArrayTransaction = Buffer.from(base64Transaction, 'base64');

        const transaction = VersionedTransaction.deserialize(uint8ArrayTransaction);

        const sign = getSignature(transaction);

        // Validate the transaction object
        if (!transaction) {
            return res.status(400).json({ error: 'Invalid transaction object' });
        }

        const result = await executeTransaction(transaction);

        res.status(200).json({
            message: 'Transaction received successfully',
            transaction: transaction,
            result: result
        });
    } catch (error) {
        logger.error('Error processing transaction:', error);
        res.status(500).json({ error: 'Failed to process transaction' });
    }
});

app.listen(port, () => {
    console.log(`Transaction Engine listening at http://localhost:${port}`);
})

