let quoteToken: string;
let quoteTokenDecimal: number;
let baseToken: string;
let baseTokenDecimal: number;
let client: string;
let swapFees: number;
let vault: string;
let wallet: string;


export function getClientId(): string {
    return client;
}

export function setClientId(value: string) {
    client = value;
}


export function getQuoteTokenDecimal(): number {
    return quoteTokenDecimal;
}

export function setQuoteTokenDecimal(value: number) {
    quoteTokenDecimal = value;
}

export function getQuoteToken(): string {
    return quoteToken;
}

export function setQuoteToken(value: string) {
    quoteToken = value;
}

export function getBaseTokenDecimal(): number {
    return baseTokenDecimal;
}

export function setBaseTokenDecimal(value: number) {
    baseTokenDecimal = value;
}

export function getBaseToken(): string {
    return baseToken;
}

export function setBaseToken(value: string) {
    baseToken = value;
}

export function getVault(): string {
    return vault;
}

export function setVault(value: string) {
    vault = value;
}

export function getWallet(): string {
    return wallet;
}

export function setWallet(value: string) {
    wallet = value;
}

export function getSwapFees(): number {
    return swapFees;
}

export function setSwapFees(value: number) {
    swapFees = value;
}