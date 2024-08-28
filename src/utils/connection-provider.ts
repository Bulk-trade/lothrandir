import { Connection } from '@solana/web3.js';
export class ConnectionProvider{
    getConnection() {
        return new Connection(process.env.RPC_URL || '', { commitment: 'confirmed' });
    }
    getLiteConnection() {
        return new Connection(process.env.LITE_RPC_URL || '', { commitment: 'confirmed' });
    }
    getTritonConnection() {
        return new Connection(process.env.TRITON_PRO_RPC || '', { commitment: 'confirmed' });
    }
}