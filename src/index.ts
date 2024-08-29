import { VersionedTransaction, VersionedTransactionResponse, Transaction } from '@solana/web3.js';
import express, { Request, Response, NextFunction } from 'express';
import { logger, logInfo } from './utils/logger';
import { config } from './utils/config';
import { executeTransaction } from './transaction';
import client, { Connection, Channel, ConsumeMessage } from "amqplib";

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

async function startConsumer() {
    try {
        const conn: Connection = await client.connect('amqp://localhost:5672');
        const channel: Channel = await conn.createChannel();
        const queue = 'transactions';

        await channel.assertQueue(queue, { durable: false });

        await channel.consume(queue, (msg) => {
            if (msg) {
                console.log('yes');
                try {
                    console.log(" [x] Received %s", msg.content.toString());
                    // Process the parsed message here
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
                // Acknowledge the message
                channel.ack(msg);
            }
        });

        console.log(`Waiting for messages in queue: ${queue}`);
    } catch (error) {
        console.error('Error in consumer:', error);
    }
}

// Start the consumer
startConsumer();

