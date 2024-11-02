import { Connection } from '@solana/web3.js';
import { Agent } from 'https';

// Reuse the agent for HTTP Keep-Alive
const agentOptions = { keepAlive: true, maxSockets: 10 };
const httpsAgent = new Agent(agentOptions);
export class ConnectionProvider{
    private static connectionCache: Map<string, Connection> = new Map();
    getLiteConnection(): Connection {
        return this.getOrCreateConnection(process.env.LITE_RPC_URL || '');
    }

    getTritonConnection(): Connection {
        return this.getOrCreateConnection(process.env.TRITON_PRO_RPC || '');
    }

    private getOrCreateConnection(url: string): Connection {
        if (ConnectionProvider.connectionCache.has(url)) {
            return ConnectionProvider.connectionCache.get(url)!;
        }
        const connection = new Connection(url, { httpAgent: httpsAgent, commitment: 'confirmed' });
        ConnectionProvider.connectionCache.set(url, connection);
        return connection;
    }
}