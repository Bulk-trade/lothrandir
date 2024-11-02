import { PublicKey } from "@solana/web3.js";
import { logInfo, logger } from "../utils/logger.js";
import { ConnectionProvider } from "./connection-provider.js";


const tokenDecimalsCache = new Map<string, number>();
/**
   * Get the number of decimals for a token.
   * 
   * @param {Connection} connection - The connection object.
   * @param {string} address - The token mint address.
   * @returns {Promise<number>} The number of decimals for the token.
   */
export async function getTokenDecimals(address: string) {
    try {
        if (tokenDecimalsCache.has(address)) {
            return tokenDecimalsCache.get(address)!;
        }
        // Create a new ConnectionProvider object and get the connection 
        const connectionProvider = new ConnectionProvider();
        const connection = connectionProvider.getTritonConnection();
        const response = await connection.getParsedAccountInfo(new PublicKey(address));

        // Check if value is not null and 'parsed' exists in data
        if (response.value && 'parsed' in response.value.data) {
            // Extract decimals from the response
            const decimals = response.value.data.parsed.info.decimals;
            tokenDecimalsCache.set(address, Number(decimals));
            return Number(decimals);
        } else {
            logInfo('Data is not of type ParsedAccountData or value is null');
        }
    } catch (error) {
        logger.error('An error occurred:', error);
    }

    return -1;
}