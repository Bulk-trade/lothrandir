import { createClient } from "@supabase/supabase-js";
import { logInfo } from "../utils/logger";

/**
 * Get database provider.
 * 
 * @returns {SupabaseClient} - The Supabase client.
 */
const getDatabaseProvider = () => {
    return createClient('https://tvuksudblikykduxkztd.supabase.co', process.env.Supabase_key || '');
}

export interface TransactionInfo {
    client: string;
    vaultPubkey: string;
    tradePubkey: string;
    baseMint: string;
    quoteMint: string;
    signature: string;
    amountIn: number;
    amountOut: number;
    txnFee: number;
    swapFee: number;
    transactionPnL: number;
    transactionLandingTime: number;
    baseTokenPrice: number;
    quoteTokenPrice: number;
}

export async function insertTransactionInfo(transactionInfo: TransactionInfo) {

    // Create a single database client for interacting with your database
    const database = getDatabaseProvider();

    const { data, error } = await database
        .from('transactions')
        .insert(
            {
                client_id: transactionInfo.client,
                vault_pubkey: transactionInfo.vaultPubkey,
                trade_pubkey: transactionInfo.tradePubkey,
                base_mint: transactionInfo.baseMint,
                quote_mint: transactionInfo.quoteMint,
                signature: transactionInfo.signature,
                amountIn: transactionInfo.amountIn,
                amountOut: transactionInfo.amountOut,
                txn_fee: transactionInfo.txnFee,
                swap_fee: transactionInfo.swapFee,
                txn_pnl: transactionInfo.transactionPnL,
                txn_land_time: transactionInfo.transactionLandingTime,
                base_token_price: transactionInfo.baseTokenPrice,
                quote_token_price: transactionInfo.quoteTokenPrice,
            }
        )
        .select();

    if (error) {
        logInfo(JSON.stringify(error));
    }

    if (data && data.length > 0) {
        logInfo('Data Inserted successfully:', data);
    } else {
        logInfo('No data inserted.');
    }
}