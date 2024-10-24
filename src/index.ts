import { VersionedTransaction } from '@solana/web3.js';
import { logger, logInfo } from './utils/logger';
import { executeTransaction } from './transaction';
import client, { Connection, Channel, Message } from 'amqplib';
import dotenv from 'dotenv';
import { subscribeToPriceEngineWS } from './solana-helper/price-engine';
import { jupParseResult, parseJupiterTransaction, updateTransactionMetrics } from './jupiter/jup-client';

// Load environment variables
dotenv.config();

const RMQ_URL = process.env.RMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'transactions';
const PREFETCH_COUNT = 5;
const MESSAGE_TTL = 30 * 1000;

async function startRmqConsumer() {
    try {
        const connection: Connection = await client.connect(RMQ_URL);
        const channel: Channel = await setupChannel(connection);

        await consumeMessages(channel);
    } catch (error) {
        logger.error('Error in RMQ consumer startup:', error);
    }
}

async function setupChannel(connection: Connection): Promise<Channel> {
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, {
        durable: false,
        arguments: {
            'x-message-ttl': MESSAGE_TTL // TTL in milliseconds
        }
    });

    await channel.prefetch(PREFETCH_COUNT);
    logInfo(`Connected to RabbitMQ, waiting for messages in queue: ${QUEUE_NAME}`);

    return channel;
}

async function consumeMessages(channel: Channel) {
    await channel.consume(QUEUE_NAME, async (msg: Message | null) => {
        if (msg) {
            if (msg) {
                // Process each message concurrently
                processMessageConcurrently(channel, msg);
            }
        }
    }, { noAck: false });
}

async function processMessageConcurrently(channel: Channel, msg: Message) {
    // Each message is processed in a separate promise
    processTransactionMessage(JSON.parse(msg.content.toString()))
        .then(() => {
            channel.ack(msg); // Acknowledge message after successful processing
        })
        .catch((error) => {
            logger.error('Error processing message:', error);
            channel.ack(msg); // acknowledge the message to discard it
        });
}

async function processTransactionMessage(message: any) {
    try {
        const startTime = performance.now(); // Start timing before the function call

        // Set transaction-related information
        const clientId = message.client;
        const vault = message.vault;
        const wallet = message.wallet;
        const baseToken = message.baseMint;
        const baseTokenDecimal = message.baseDecimal;
        const quoteToken = message.quoteMint;
        const quoteTokenDecimal = message.quoteDecimal;
        const swapFeesPercentage = message.swapFees;

        // Subscribe to the price engine if not already subscribed
        await subscribeToPriceEngineWS(baseToken, baseTokenDecimal);
        await subscribeToPriceEngineWS(quoteToken, quoteTokenDecimal);

        // Deserialize the transaction
        const uint8ArrayTransaction = Buffer.from(message.txn, 'base64');
        const transaction = VersionedTransaction.deserialize(uint8ArrayTransaction);

        if (!transaction) {
            throw new Error('Failed to deserialize transaction');
        }

        // Execute the transaction
        const signature = await executeTransaction(transaction);

        // Return if the transaction failed or not confirmed
        if (signature !== 'failed') {
            return;
        }

        // Parse the transaction result
        const parseResult = await parseJupiterTransaction(signature, baseToken, baseTokenDecimal, quoteToken, quoteTokenDecimal);

        const endTime = performance.now(); // Capture the end time after the function execution
        const timeTaken = endTime - startTime; // Calculate the time taken by subtracting the start time from the end time

        logInfo('JupiterSwap.swap()', `Time taken: ${timeTaken} milliseconds`);

        if (parseResult !== -1) {
            await updateTransactionMetrics(parseResult as jupParseResult, signature, timeTaken, clientId, vault, wallet, baseToken, quoteToken, swapFeesPercentage);
        } else {
            logger.error('Error parsing jup transaction');
        }

    } catch (error) {
        logger.error('Error during transaction processing:', error);
        throw error; // Re-throw to ensure the error is caught by the outer handler
    }
}

process.on('SIGINT', () => {
    logInfo('Received SIGINT. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logInfo('Received SIGTERM. Shutting down gracefully...');
    process.exit(0);
});

// Start the consumer
startRmqConsumer();
