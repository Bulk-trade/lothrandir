import { Mutex } from "async-mutex";
import { logger, logInfo } from "../utils/logger";
import { wait } from "../utils/wait";
import WebSocket from "ws";

const tokenPriceMap = new Map<string, number>();
const priceMutex = new Mutex();

export async function setTokenPrice(tokenMint: string, price: number) {
    await priceMutex.runExclusive(() => {
        tokenPriceMap.set(tokenMint, price);
    });
}

export async function getTokenPrice(tokenMint: string): Promise<number | undefined> {
    return await priceMutex.runExclusive(() => {
        return tokenPriceMap.get(tokenMint);
    });
}

export async function subscribeToPriceEngineWS(tokenMint: string, tokenDecimal: number) {
    try {
        if (!tokenPriceMap.has(tokenMint)) {
            await connectWebSocket(tokenMint, tokenDecimal);
        } else {
            logInfo(`Already subscribed to WebSocket for mint: ${tokenMint}`);
        }
    } catch (error) {
        logger.error('Error subscribing to WebSocket:', error);
    }
}

export async function connectWebSocket(tokenMint: string, tokenDecimal: number) {

    const wsUrl = `${process.env.PRICE_ENGINE_WS}?token=${tokenMint}&token_decimal=${tokenDecimal}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        logInfo('Price Engine WebSocket connection opened');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data.toString());
        if (data && data.price) {
            setTokenPrice(tokenMint, data.price ?? 0);
        };
    };

    ws.onerror = async (error) => {
        logger.error('Price Engine WebSocket error:', error);
        await wait(1000);
        reconnectWebSocket(ws, tokenMint, tokenDecimal)
    };

    ws.onclose = async () => {
        logInfo('Price Engine WebSocket connection closed');
        await wait(1000);
        reconnectWebSocket(ws, tokenMint, tokenDecimal);
    };
}

function reconnectWebSocket(ws: WebSocket, tokenMint: string, tokenDecimal: number) {
    if (ws) {
        ws.close();
    }
    connectWebSocket(tokenMint, tokenDecimal);
}