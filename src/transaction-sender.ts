import {
    BlockhashWithExpiryBlockHeight,
    Connection,
    TransactionExpiredBlockheightExceededError,
    VersionedTransactionResponse,
} from "@solana/web3.js";
import promiseRetry from "promise-retry";
import { wait } from "./utils/wait";
import { logger, logInfo } from "./utils/logger";

type TransactionSenderAndConfirmationWaiterArgs = {
    connection: Connection;
    serializedTransaction: Buffer | Uint8Array;
    blockhashWithExpiryBlockHeight: BlockhashWithExpiryBlockHeight;
    liteConnection?: Connection;
};

const SEND_OPTIONS = {
    skipPreflight: true,
};

export async function versionedTransactionSenderAndConfirmationWaiter({
    connection,
    liteConnection,
    serializedTransaction,
    blockhashWithExpiryBlockHeight,
}: TransactionSenderAndConfirmationWaiterArgs): Promise<VersionedTransactionResponse | null> {
    const startTime = performance.now(); // Start timing before the function call

    let txnConnection = liteConnection ?? connection;

    const txid = await txnConnection.sendRawTransaction(
        serializedTransaction
    );


    const controller = new AbortController();
    const abortSignal = controller.signal;

    const abortableResender = async () => {
        while (true) {
            await wait(500);
            if (abortSignal.aborted) return;
            try {
                await txnConnection.sendRawTransaction(
                    serializedTransaction,
                    SEND_OPTIONS
                );
            } catch (e) {
                logger.warn(`Failed to resend transaction: ${e}`);
            }
        }
    };

    try {
        abortableResender();
        const lastValidBlockHeight =
            blockhashWithExpiryBlockHeight.lastValidBlockHeight - 150;

        // this would throw TransactionExpiredBlockheightExceededError
        await Promise.race([
            txnConnection.confirmTransaction(
                {
                    ...blockhashWithExpiryBlockHeight,
                    lastValidBlockHeight,
                    signature: txid,
                    abortSignal,
                },
                "confirmed"
            ),
            new Promise(async (resolve) => {
                // in case ws socket died
                while (!abortSignal.aborted) {
                    await wait(500);
                    const tx = await txnConnection.getSignatureStatus(txid, {
                        searchTransactionHistory: false,
                    });
                    if (tx?.value?.confirmationStatus === "confirmed") {
                        resolve(tx);
                    }
                }
            }),
        ]);
    } catch (e) {
        if (e instanceof TransactionExpiredBlockheightExceededError) {
            // we consume this error and getTransaction would return null
            return null;
        } else {
            // invalid state from web3.js
            throw e;
        }
    } finally {
        controller.abort();
    }


    // in case rpc is not synced yet, we add some retries
    const response = promiseRetry(
        async (retry) => {
            const response = await connection.getTransaction(txid, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0,
            });
            if (!response) {
                retry(response);
            }
            return response;
        },
        {
            retries: 5,
            minTimeout: 500,
        }
    );


    const endTime = performance.now(); // Capture the end time after the function execution
    const timeTaken = endTime - startTime; // Calculate the time taken by subtracting the start time from the end time

    logInfo('transactionSenderAndConfirmationWaiter()', `Time taken: ${timeTaken} milliseconds`);

    return response;
}