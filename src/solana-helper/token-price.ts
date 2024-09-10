import { createJupiterApiClient } from "@jup-ag/api";
import { SOL_MINT, USDC_DECIMAL, USDC_MINT } from "../utils/config.js";
import { logInfo, logger } from "../utils/logger.js";
import { getJupQuote } from "../jupiter/jup-client.js";
import { isErrorWithResponse, convertToUnit, convertToDecimal } from "../utils/utils.js";
import { getTokenDecimals } from "./get-decimal.js";
import { getTokenPrice } from "./price-engine.js";
/**
 * Fetches price data for a given token over a specified number of days.
 * @param tokenMintAddress The mint address of the token.
 * @param sec The number of days to fetch price data for.
 * @returns An array of price values.
 */
export async function fetchHistoricalPriceData(tokenMintAddress: string, days: number): Promise<number[]> {
    const start = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
    const end = Math.floor(Date.now() / 1000);

    const options = {
        method: 'GET',
        headers: { 'x-chain': 'solana', 'X-API-KEY': process.env.Birdeye_Key || '' }
    };

    const MAX_RETRIES = 5;

    for (let retries = 0; retries <= MAX_RETRIES; retries++) {

        try {
            const response = await fetch(`https://public-api.birdeye.so/defi/history_price?address=${tokenMintAddress}&address_type=token&type=15m&time_from=${start}&time_to=${end}`, options);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const prices = await response.json();
            return prices.data.items.map((entry: { value: number }) => entry.value);
        } catch (error) {
            logger.error(`Error fetching historical price data: ${error}`);
            if (isErrorWithResponse(error)) {
                logger.error(`Response status: ${error.response.status}. Body: ${await error.response.text()}`);
            }
        }

    }
    return [];
}

export async function getTokenPriceBirdeye(sourceToken: string): Promise<number> {

    const options = {
        method: 'GET',
        headers: { 'x-chain': 'solana', 'X-API-KEY': process.env.Birdeye_Key || '' }
    };

    try {
        const response = await fetch(`https://public-api.birdeye.so/defi/price?address=${sourceToken}`, options);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const responseData = await response.json();
        const tokenValue: number = responseData.data.value;

        logInfo("Token price: ", tokenValue);

        return tokenValue;

    } catch (error) {
        logger.error(error);
    }

    return -1;
}

export async function getTokenPriceMarketCap(sourceToken: string): Promise<number> {

    const options = {
        method: 'GET',
        headers: { 'accept': 'application/json', 'x-chain': 'solana', 'X-API-KEY': process.env.Birdeye_Key || '' }
    };

    logInfo(options)

    try {
        const response = await fetch(`https://public-api.birdeye.so/defi/token_overview?address=${sourceToken}`, options);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const responseData = await response.json();
        const tokenValue: number = responseData.mc;

        logInfo("Token MarketCap: ", tokenValue);

        return tokenValue;

    } catch (error) {
        logger.error(error);
    }

    return -1;
}

export async function getVsTokenPrice(sourceToken: string, vsToken: string): Promise<number> {

    try {
        const response = await fetch(`https://price.jup.ag/v6/price?ids=${sourceToken}&vsToken=${vsToken}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const responseData = await response.json();
        const tokenValue: number = responseData.data[sourceToken].price;

        return tokenValue;

    } catch (error) {
        logger.error(error);
    }

    return 0;
}

export async function getTokenPriceFromPriceEngine(sourceToken: string, baseToken: string, baseTokenDecimal: number, quoteToken: string, quoteTokenDecimal: number): Promise<number> {
    const cachedPrice = await getTokenPrice(sourceToken);
    if (cachedPrice !== undefined) {
        logInfo('Using cached price:', cachedPrice);
        return cachedPrice;
    }

    const MAX_RETRIES = 5;

    // Create a new Jupiter API client
    const jupiterQuoteApi = createJupiterApiClient({ basePath: process.env.TRITON_JUP_API });

    let amountIn;
    if (sourceToken === baseToken) {
        amountIn = convertToUnit(1, baseTokenDecimal);
    } else if (sourceToken === quoteToken) {
        amountIn = convertToUnit(1, quoteTokenDecimal);
    } else {
        const tokenDecimal = await getTokenDecimals(sourceToken);
        amountIn = convertToUnit(1, tokenDecimal);
    }

    for (let retries = 0; retries <= MAX_RETRIES; retries++) {
        try {
            // Fetch a quote for the swap
            const quote = await getJupQuote(jupiterQuoteApi, sourceToken, USDC_MINT, amountIn, 10);
            console.log(JSON.stringify(quote, null, 2))
            const price = convertToDecimal(Number(quote.outAmount), USDC_DECIMAL);

            logInfo("Token price: ", price);

            return price;
        } catch (error) {
            logger.error(`Attempt ${retries + 1} failed: ${JSON.stringify(error)}`);
        }
    }

    // Fallback to getTokenPriceFromJupiter if all retries fail
    logInfo('Falling back to getTokenPriceFromJupiter');
    return await getTokenPriceFromJupiter(sourceToken);
}

export async function getTokenPriceFromJupiter(sourceToken: string): Promise<number> {
    const MAX_RETRIES = 5;

    for (let retries = 0; retries <= MAX_RETRIES; retries++) {
        try {
            const response = await fetch(`https://price.jup.ag/v6/price?ids=${sourceToken}`);
            if (!response.ok) {
                logInfo('getTokenPrice() retries: ', retries + 1);
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const responseData = await response.json();
            const tokenValue: number = responseData.data[sourceToken].price;

            logInfo("Token price: ", tokenValue);
            return tokenValue;
        } catch (error) {
            logger.error(`Attempt ${retries + 1} failed: ${error}`);
        }
    }

    return 0;
}

export async function calculateTokenAmountFromMint(tokenMint: string, usdAmount: number) {

    const tokenPrice = await getTokenPriceFromJupiter(tokenMint);

    // Calculate the amount of tokens equivalent to usdAmount
    const tokenAmount: number = usdAmount / tokenPrice;

    logInfo(`${usdAmount} USD are worth ${tokenAmount} tokens.`);

    return tokenAmount;
}

export function calculateTokenAmount(tokenPrice: number, usdAmount: number) {

    // Calculate the amount of tokens equivalent to usdAmount
    const tokenAmount: number = usdAmount / tokenPrice;

    logInfo(`${usdAmount} USD are worth ${tokenAmount} tokens.`);

    return tokenAmount;
}

export async function calculateSolAmount(usdAmount: number) {

    //Get SOL price
    const solPrice = await getTokenPriceFromJupiter(SOL_MINT);

    // Calculate the amount of tokens equivalent to usdAmount
    const solAmount: number = usdAmount / solPrice;

    logInfo(`${usdAmount} USD are worth ${solAmount} tokens.`);

    return solAmount;
}

export function calculateTokenUSDValue(tokenPrice: number, tokenAmount: number) {

    // Calculate the usd amount equivalent to tokens amount
    const usdAmount: number = tokenPrice * tokenAmount;

    logInfo(`${tokenAmount} tokens are worth ${usdAmount} USD.`);

    return usdAmount;
}

export async function calculateTokenUSDValueFromMint(tokenMint: string, tokenAmount: number) {

    const tokenPrice = await getTokenPriceFromJupiter(tokenMint);

    // Calculate the usd amount equivalent to tokens amount
    const usdAmount: number = tokenPrice * tokenAmount;

    logInfo(`${tokenAmount} tokens are worth ${usdAmount} USD.`);

    return usdAmount;
}

export async function calculateSolUSDValue(tokenAmount: number) {

    //Get SOL price
    const solPrice = await getTokenPriceFromJupiter(SOL_MINT);

    // Calculate the usd amount equivalent to tokens amount
    const usdAmount: number = solPrice * tokenAmount;

    logInfo(`${tokenAmount} SOLs are worth ${usdAmount} USD.`);

    return usdAmount;
}
