import ms from 'ms'

export default class Util {

    /**
     * SAFE: Original wait method preserved for backward compatibility
     * All existing code continues to work exactly as before
     */
    async wait(ms: number): Promise<void> {
        return new Promise<void>((resolve) => {
            setTimeout(resolve, ms)
        })
    }

    /**
     * NEW: Enhanced wait with optional human-like variability
     * Only used when explicitly called - doesn't break existing functionality
     */
    async humanizedWait(baseMs: number, variationPercent: number = 20): Promise<void> {
        const variation = baseMs * (variationPercent / 100)
        const actualWait = baseMs + (Math.random() - 0.5) * variation
        const clampedWait = Math.max(100, Math.round(actualWait)) // Never less than 100ms
        
        return this.wait(clampedWait)
    }

    getFormattedDate(ms = Date.now()): string {
        const today = new Date(ms)
        const month = String(today.getMonth() + 1).padStart(2, '0')  // January is 0
        const day = String(today.getDate()).padStart(2, '0')
        const year = today.getFullYear()

        return `${month}/${day}/${year}`
    }

    shuffleArray<T>(array: T[]): T[] {
        return array.map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value)
    }

    randomNumber(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    chunkArray<T>(arr: T[], numChunks: number): T[][] {
        const chunkSize = Math.ceil(arr.length / numChunks)
        const chunks: T[][] = []

        for (let i = 0; i < arr.length; i += chunkSize) {
            const chunk = arr.slice(i, i + chunkSize)
            chunks.push(chunk)
        }

        return chunks
    }

    stringToMs(input: string | number): number {
        const milisec = ms(input.toString())
        if (!milisec) {
            throw new Error('The string provided cannot be parsed to a valid time! Use a format like "1 min", "1m" or "1 minutes"')
        }
        return milisec
    }

}