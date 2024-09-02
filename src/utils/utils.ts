
// Fisher-Yates (aka Knuth) Shuffle algorithm to randomize an array
export function shuffleArray(array: any[]) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

export function convertToUnit(amount: number, tokenDecimal: number): number {
    return Math.round(amount * Math.pow(10, tokenDecimal));
}

export function convertToDecimal(amount: number, tokenDecimal: number): number {
    return amount / Math.pow(10, tokenDecimal);
}

interface ErrorWithResponse extends Error {
    response: {
        status: number;
        text: () => Promise<string>;
    };
}

export function isErrorWithResponse(error: any): error is ErrorWithResponse {
    return error.response !== undefined;
}

export function convertToDistPath(tsFilePath: string): string {
    // Extract the file name from the TypeScript file path
    const fileName = tsFilePath.replace('.ts', '.js');

    // Prepend the './dist/worker/' directory
    const distPath = `./dist/worker/${fileName}`;

    return distPath;
}