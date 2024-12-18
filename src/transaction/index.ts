import { VersionedTransaction, Connection, VersionedTransactionResponse } from "@solana/web3.js";
import { ConnectionProvider } from "../solana-helper/connection-provider";
import { getSignature } from "../solana-helper/get-signature";
import { logInfo, logger } from "../utils/logger";
import { versionedTransactionSenderAndConfirmationWaiter } from "../solana-helper/transaction-sender";

// Cache for blockhash to avoid redundant requests
let cachedBlockhash: any = null;

export async function executeTransaction(transaction: VersionedTransaction) {

    // Create a new ConnectionProvider object and get the connection and lite connection
    const connectionProvider = new ConnectionProvider();
    const connection = connectionProvider.getTritonConnection();
    const liteConnection = connectionProvider.getLiteConnection();

    // Get the latest blockhash for the transaction
    const blockhashResult = await connection.getLatestBlockhash({ commitment: "confirmed" });

    // Get the transaction signature
    const signature = getSignature(transaction);

    // Simulate the transaction to check if it would be successful
    await simulateTransaction(connection, transaction);

    // Serialize the transaction and get the recent blockhash
    const serializedTransaction = transaction.serialize();

    // Send the transaction and wait for confirmation
    const transactionResponse = await sendTransaction(connection, liteConnection, serializedTransaction, blockhashResult);

    // Handle the transaction response
    const transactionResult = handleTransactionResponse(transactionResponse, signature);

    // Return if the transaction failed or not confirmed
    if (transactionResult === 0) {
        return 'failed';
    }

    return signature;

}

// function for sending batch transactions
export async function executeBatchTransactions(transactions: VersionedTransaction[]) {
    const connectionProvider = new ConnectionProvider();
    const connection = connectionProvider.getTritonConnection();
    const liteConnection = connectionProvider.getLiteConnection();
    const blockhashResult = await refreshBlockhash(connection);

    const results = await Promise.all(
        transactions.map(async (transaction) => {
            const serializedTransaction = transaction.serialize();
            return await sendTransaction(connection,liteConnection, serializedTransaction, blockhashResult);
        })
    );

    logInfo(`Batch Transactions: ${results.length} processed`);
    return results;
}

async function refreshBlockhash(connection: Connection) {
    if (!cachedBlockhash) {
        cachedBlockhash = await connection.getLatestBlockhash({ commitment: "confirmed" });
    }
    return cachedBlockhash;
}

async function simulateTransaction(connection: Connection, transaction: VersionedTransaction) {
    const { value: simulatedTransactionResponse } = await connection.simulateTransaction(transaction, {
        replaceRecentBlockhash: true,
        commitment: "processed",
    });
    const { err, logs } = simulatedTransactionResponse;

    if (err) {
        logger.error("Simulation Error:", JSON.stringify(err));
        console.error(JSON.stringify(err));
        throw new Error("Transaction simulation failed");
    }
}

function handleTransactionResponse(transactionResponse: VersionedTransactionResponse | null, signature: string) {
    // If no response is received, log an error and return
    if (!transactionResponse) {
        logger.error("Transaction not confirmed");
        return 0;
    }

    // If the transaction fails, log the error
    if (transactionResponse.meta?.err) {
        logger.error(`Transaction Failed: ${JSON.stringify(transactionResponse.meta?.err)}`);
        logger.error(`https://solscan.io/tx/${signature}`);
        return 0;
    }

    // If the transaction is successful, increment the successful transactions counter and log the transaction URL
    //incrementSuccessfulTransactions();
    logInfo(`https://solscan.io/tx/${signature}`);
    return 1;
}

async function sendTransaction(connection: Connection, liteConnection: Connection, serializedTransaction: Uint8Array, blockhashResult: Readonly<{ blockhash: import("@solana/web3.js").Blockhash; lastValidBlockHeight: number; }>) {
    return await versionedTransactionSenderAndConfirmationWaiter({
        connection: connection,
        liteConnection: liteConnection,
        serializedTransaction,
        blockhashWithExpiryBlockHeight: {
            blockhash: blockhashResult.blockhash,
            lastValidBlockHeight: blockhashResult.lastValidBlockHeight,
        },
    });
}
