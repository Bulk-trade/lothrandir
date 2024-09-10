import { LAMPORTS_PER_SOL, ParsedTransactionWithMeta } from "@solana/web3.js";
import { extract } from "@jup-ag/instruction-parser";
import { logInfo } from "../utils/logger.js";
import { wait } from "../utils/wait.js";
import { DefaultApi } from "@jup-ag/api";
import { insertTransactionInfo, TransactionInfo } from "../db/db.js";
import { ConnectionProvider } from "../solana-helper/connection-provider.js";
import { getTokenPriceFromJupiter, calculateSolUSDValue, getTokenPriceFromPriceEngine } from "../solana-helper/token-price.js";

export interface jupParseResult {
    amountIn: number;
    amountOut: number;
    amountInUsd: number;
    amountOutUsd: number;
    transactionFee: number;
    transactionPnL: number;
    totalSpent: number;
    baseTokenPrice: number;
    quoteTokenPrice: number;
}

export async function parseJupiterTransaction(signature: string, baseToken: string, baseTokenDecimal: number, quoteToken: string, quoteTokenDecimal: number): Promise<jupParseResult | number> {
    const startTime = performance.now(); // Start timing before the function call

    try {
        const connprovider = new ConnectionProvider();
        const connection = connprovider.getTritonConnection();

        const maxRetries = 10;
        let response: ParsedTransactionWithMeta | null = null;

        for (let i = 0; i < maxRetries; i++) {
            await wait(1000);
            response = await connection.getParsedTransaction(signature, { "maxSupportedTransactionVersion": 0 });

            if (response) {
                break;
            } else {
                logInfo('getParsedTransaction() response is null, retrying...');
            }
        }

        if (!response) {
            throw new Error('Failed to get response after ' + maxRetries + ' retries');
        }

        let res = await extract(
            signature,
            connection,
            response,
            response.blockTime!
        );


        if (res === undefined) {
            throw new Error('Failed to parse response after ');
        }

        const [result] = res;

        const amountIn = result.inAmountInDecimal ? result.inAmountInDecimal : 0;
        const amountOut = result.outAmountInDecimal ? result.outAmountInDecimal : 0;

        let amountInUsd
        if (result.inAmountInUSD === 0) {
            const amountInTokenPrice = await getTokenPriceFromPriceEngine(result.inMint, baseToken, baseTokenDecimal, quoteToken, quoteTokenDecimal);
            amountInUsd = amountIn * amountInTokenPrice;
        } else {
            amountInUsd = result.inAmountInUSD;
        }

        let amountOutUsd;
        if (result.outAmountInUSD == 0) {
            const amountOutTokenPrice = await getTokenPriceFromPriceEngine(result.outMint, baseToken, baseTokenDecimal, quoteToken, quoteTokenDecimal);
            amountOutUsd = amountOut * amountOutTokenPrice;
        } else {
            amountOutUsd = result.outAmountInUSD;
        }


        let baseTokenPrice, quoteTokenPrice;

        if (result.inMint === baseToken) {
            baseTokenPrice = result.inAmountInUSD / result.inAmountInDecimal!;
            quoteTokenPrice = result.outAmountInUSD / result.outAmountInDecimal!;
        } else {
            baseTokenPrice = result.outAmountInUSD / result.outAmountInDecimal!;
            quoteTokenPrice = result.inAmountInUSD / result.inAmountInDecimal!;
        }

        const transactionFee = response!.meta!.fee / LAMPORTS_PER_SOL;
        const transactionFeesUsd = await calculateSolUSDValue(transactionFee);

        const totalSpent = transactionFeesUsd + amountInUsd;
        const transactionPnL = amountOutUsd - (totalSpent);


        const endTime = performance.now(); // Capture the end time after the function execution
        const timeTaken = endTime - startTime; // Calculate the time taken by subtracting the start time from the end time

        logInfo('parseJupiterTransaction()', `Time taken: ${timeTaken} milliseconds`);
        const parseResult: jupParseResult = {
            amountIn,
            amountOut,
            amountInUsd,
            amountOutUsd,
            transactionFee,
            transactionPnL,
            totalSpent,
            baseTokenPrice,
            quoteTokenPrice,
        };
        return parseResult

    } catch (error) {
        logInfo(error)
        return -1;
    }
}

export async function getJupQuote(jupiterQuoteApi: DefaultApi, baseMint: string, quoteMint: string, amountIn: number, slippageBps: number) {
    return await jupiterQuoteApi.quoteGet({
        inputMint: baseMint,
        outputMint: quoteMint,
        amount: amountIn,
        autoSlippage: true,
        maxAutoSlippageBps: slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
        restrictIntermediateTokens: true,
    });
}

/**
 * Updates the transaction metrics after a swap operation. This function performs the following steps:
 * 1. Updates the total amount of tokens bought based on the base token.
 * 2. Adds the transaction fee to the total fees.
 * 3. Adds the transaction volume to the total volume.
 * 4. Adds the received amount to the total received.
 * 5. Adds the spent amount to the total spent.
 * 6. Calculates and adds the swap fees.
 * 7. Records the transaction timestamp and calculates the landing time.
 * 8. Constructs a transaction info object with detailed metrics.
 * 9. Inserts the transaction info into the database.
 * 
 * @param {string} baseMint - The mint address of the base token.
 * @param {Object} result - The result object containing transaction details.
 * @param {number} result.amountIn - The amount of the base token input.
 * @param {number} result.amountOut - The amount of the quote token output.
 * @param {number} result.amountInUsd - The USD value of the base token input.
 * @param {number} result.amountOutUsd - The USD value of the quote token output.
 * @param {number} result.transactionFee - The fee for the transaction.
 * @param {number} result.transactionPnL - The profit and loss of the transaction.
 * @param {number} result.averagePnL - The average profit and loss over all transactions.
 * @param {number} result.totalSpent - The total amount spent in the transaction.
 * @param {number} result.baseTokenPrice - The price of the base token.
 * @param {number} result.quoteTokenPrice - The price of the quote token.
 * @param {QuoteResponse} quote - The quote response object from the Jupiter API.
 * @param {Keypair} vault - The keypair representing the vault.
 * @param {Keypair} wallet - The keypair representing the user's wallet.
 * @param {string} signature - The transaction signature.
 */
export async function updateTransactionMetrics(
    result: jupParseResult,
    signature: string,
    landTime: number,
    clientId: string,
    vault: string,
    wallet: string,
    baseToken: string,
    quoteToken: string,
    swapFeesPercentage: number) {

    const transactionInfo: TransactionInfo = {
        client: clientId,
        vaultPubkey: vault,
        tradePubkey: wallet,
        baseMint: baseToken,
        quoteMint: quoteToken,
        signature: signature,
        amountIn: result.amountInUsd,
        amountOut: result.amountOutUsd,
        txnFee: result.transactionFee,
        swapFee: swapFeesPercentage * result.amountInUsd,
        transactionPnL: result.transactionPnL,
        transactionLandingTime: landTime,
        baseTokenPrice: result.baseTokenPrice,
        quoteTokenPrice: result.quoteTokenPrice
    };

    await insertTransactionInfo(transactionInfo);
}

/**
 * Calculates the total swap fees as a percentage of the input amount based on the provided route plan.
 * This function iterates through each swap in the route plan and calculates the fee percentage based on
 * whether the fee is taken from the input amount or the output amount.
 * 
 * @param {number} amountIn - The initial amount of the base token to be swapped.
 * @param {any[]} routePlan - An array of swap objects representing the route plan. Each swap object contains:
 *   - {number} inAmount - The amount of the base token input for the swap.
 *   - {number} outAmount - The amount of the quote token output from the swap.
 *   - {number} feeAmount - The amount of the fee taken for the swap.
 *   - {string} feeMint - The mint address of the token used for the fee.
 *   - {string} inputMint - The mint address of the base token.
 *   - {string} outputMint - The mint address of the quote token.
 * 
 * @returns {number} - The total swap fees as a percentage of the input amount.
 * 
 * @throws {Error} - Throws an error if the fee mint is neither the input mint nor the output mint.
 */
export function calculateSwapFees(amountIn: number, routePlan: any[]): number {
    let remainingAmount = 100; // Start with 100% of the input amount
    let totalFeesPercentage = 0;

    routePlan.forEach(swap => {
        const { inAmount, outAmount, feeAmount, feeMint, inputMint, outputMint } = swap.swapInfo;
        let feePercentage;
        if (feeMint === inputMint) {
            // Fee is taken from the input amount
            feePercentage = (feeAmount / inAmount) * 100;
            totalFeesPercentage += (remainingAmount * feePercentage) / 100;
            remainingAmount -= (remainingAmount * feePercentage) / 100;
        } else if (feeMint === outputMint) {
            // Fee is taken from the output amount
            feePercentage = (feeAmount / outAmount) * 100;
            totalFeesPercentage += (remainingAmount * feePercentage) / 100;
            remainingAmount -= (remainingAmount * feePercentage) / 100;
        } else {
            // Unknown fee mint, handle error or skip this swap
            throw new Error("Unknown fee mint");
        }
    });

    return amountIn * totalFeesPercentage / 100;
}