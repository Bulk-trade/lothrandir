import { VersionedTransaction } from '@solana/web3.js';
import { logger, logInfo } from './utils/logger';
import { executeTransaction } from './transaction';
import client, { Connection, Channel } from 'amqplib';
import dotenv from 'dotenv';
import { setBaseToken, setClientId, setQuoteToken, setSwapFeesPercentage, setVault, setWallet } from './utils/transaction-info';

// Load environment variables
dotenv.config();

async function startRmqConsumer() {
    try {
        const connection: Connection = await client.connect(process.env.RMQ_URL || 'amqp://localhost:5672');
        const channel: Channel = await connection.createChannel();
        const queue = 'transactions';

        await channel.assertQueue(queue, {
            durable: false,
            arguments: {
                'x-message-ttl': 30000 // TTL of 60 seconds
            }
        });

        await channel.prefetch(5);

        await channel.consume(queue, async (msg) => {
            if (msg) {
                try {
                    const message = JSON.parse(msg.content.toString());
                    console.log(" [x] Received '%s'", message);

                    // Set transaction-related information
                    setClientId(message.client);
                    setVault(message.vault);
                    setWallet(message.wallet);
                    setBaseToken(message.baseMint);
                    setQuoteToken(message.quoteMint);
                    setSwapFeesPercentage(message.swapFees);

                    // Deserialize the transaction
                    const uint8ArrayTransaction = Buffer.from(message.txn, 'base64');
                    const transaction = VersionedTransaction.deserialize(uint8ArrayTransaction);

                    if (!transaction) {
                        logger.error('Failed to deserialize transaction');
                    } else {
                        // Execute the transaction
                        const result = await executeTransaction(transaction);
                    }

                } catch (error) {
                    logger.error('Error processing message:', error);
                }

                // Acknowledge the message whether or not processing succeeded
                channel.ack(msg);
            }
        }, {
            noAck: false // Use manual acknowledgment
        });

        logInfo(`Waiting for messages in queue: ${queue}`);
    } catch (error) {
        logger.error('Error in RMQ consumer:', error);
    }
}

// Start the consumer
startRmqConsumer();
