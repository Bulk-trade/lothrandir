export const wait = (time: number) =>
    new Promise((resolve) => setTimeout(resolve, time));

export async function retryWithExponentialBackoff(fn: () => Promise<any>, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            const waitTime = Math.pow(2, i) * 100;
            await wait(waitTime);
        }
    }
    throw new Error("Max retries reached");
}