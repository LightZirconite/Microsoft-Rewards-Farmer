import { Page } from 'rebrowser-playwright'
import { MicrosoftRewardsBot } from '../index'

/**
 * HumanBehavior - Adds realistic human-like patterns to automation
 * 
 * SAFETY PRINCIPLES:
 * - Never breaks existing functionality
 * - All methods are ADDITIVE, not replacement
 * - Maintains backward compatibility
 * - Provides opt-in human behavior enhancement
 */
export class HumanBehavior {
    private bot: MicrosoftRewardsBot
    private isEnabled: boolean
    
    // Human behavior configuration
    private config = {
        // Typing patterns
        typing: {
            minWpm: 35,           // Minimum words per minute
            maxWpm: 65,           // Maximum words per minute
            mistakeChance: 0.02,  // 2% chance of typos
            correctionDelay: 300, // Time to realize mistake
        },
        
        // Reading simulation
        reading: {
            wordsPerMinute: 200,  // Average reading speed
            variability: 0.3,     // 30% speed variation
            scanningSpeed: 0.4,   // Quick scanning vs deep reading
        },
        
        // Mouse movement
        mouse: {
            enableMovement: true,
            speed: 'medium',      // slow, medium, fast
            accuracy: 0.85,       // 85% accuracy (some overshoot)
        },
        
        // Thinking patterns
        thinking: {
            beforeClick: [500, 1500],     // Think before clicking
            beforeType: [300, 800],       // Think before typing
            afterRead: [800, 2000],       // Process what was read
            decisionTime: [1000, 3000],   // Complex decisions
        },
        
        // Attention span
        attention: {
            fatigueAfterMinutes: 45,      // Start getting tired
            distractionChance: 0.05,      // 5% chance of distraction
            breakDuration: [30000, 120000], // 30s-2min breaks
        }
    }
    
    constructor(bot: MicrosoftRewardsBot, enabled: boolean = true) {
        this.bot = bot
        this.isEnabled = enabled && (bot.config.humanBehavior?.enabled ?? false)
    }

    /**
     * Human-like wait with context awareness
     * SAFE: Falls back to original wait if disabled
     */
    async humanWait(minMs: number, maxMs: number, context: 'thinking' | 'reading' | 'typing' | 'loading' | 'scanning' = 'thinking'): Promise<void> {
        if (!this.isEnabled) {
            // Fallback to original behavior with slight randomization for safety
            const baseTime = (minMs + maxMs) / 2
            const variance = (maxMs - minMs) * 0.2
            const actualTime = baseTime + (Math.random() - 0.5) * variance
            return this.bot.utils.wait(Math.max(minMs, Math.min(maxMs, actualTime)))
        }

        let waitTime = this.calculateContextualWait(minMs, maxMs, context)
        
        // Apply fatigue if session is long
        waitTime = this.applyFatigue(waitTime)
        
        // Very small chance of distraction
        if (Math.random() < this.config.attention.distractionChance) {
            waitTime += this.randomInRange(2000, 8000) // Brief distraction
        }
        
        return this.bot.utils.wait(waitTime)
    }

    /**
     * Enhanced typing with human patterns
     * SAFE: Only used when explicitly called
     */
    async humanType(page: Page, text: string, selector?: string): Promise<void> {
        if (!this.isEnabled) {
            if (selector) {
                await page.type(selector, text)
            }
            return
        }

        const chars = text.split('')
        const wpm = this.randomInRange(this.config.typing.minWpm, this.config.typing.maxWpm)
        const baseDelay = 60000 / (wpm * 5) // 5 chars per word average

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i]
            
            // Chance of making a typo
            if (Math.random() < this.config.typing.mistakeChance && char.match(/[a-zA-Z]/)) {
                // Type wrong character
                const wrongChar = this.getTypo(char)
                if (selector) {
                    await page.type(selector, wrongChar, { delay: baseDelay * this.randomInRange(0.8, 1.4) })
                } else {
                    await page.keyboard.type(wrongChar)
                }
                
                // Realize mistake and correct
                await this.humanWait(this.config.typing.correctionDelay, this.config.typing.correctionDelay * 2, 'thinking')
                await page.keyboard.press('Backspace')
                await this.humanWait(100, 300, 'thinking')
            }
            
            // Type the correct character
            const charDelay = baseDelay * this.randomInRange(0.7, 1.8)
            if (selector) {
                await page.type(selector, char, { delay: charDelay })
            } else {
                await page.keyboard.type(char)
                await this.bot.utils.wait(charDelay)
            }
            
            // Occasional longer pauses (thinking about next word)
            if (char === ' ' && Math.random() < 0.1) {
                await this.humanWait(200, 600, 'thinking')
            }
        }
    }

    /**
     * Simulate reading time based on content length
     * SAFE: Only adds delay, doesn't break anything
     */
    async simulateReading(page: Page, selector?: string): Promise<void> {
        if (!this.isEnabled) return

        try {
            let textLength = 0
            
            if (selector) {
                const element = await page.$(selector)
                if (element) {
                    const text = await element.textContent()
                    textLength = text?.length || 0
                }
            } else {
                const text = await page.textContent('body')
                textLength = text?.length || 0
            }
            
            // Estimate reading time
            const wordsEstimate = textLength / 5 // Rough words estimate
            const baseReadingTime = (wordsEstimate / this.config.reading.wordsPerMinute) * 60000
            
            // Apply variability
            const variance = baseReadingTime * this.config.reading.variability
            const actualTime = baseReadingTime + (Math.random() - 0.5) * variance
            
            // Clamp to reasonable bounds
            const minTime = Math.max(500, actualTime * 0.3) // Quick scan minimum
            const maxTime = Math.min(30000, actualTime * 1.5) // Deep read maximum
            
            await this.humanWait(minTime, maxTime, 'reading')
            
        } catch (error) {
            // Fallback to default reading time
            await this.humanWait(800, 2000, 'reading')
        }
    }

    /**
     * Add natural mouse movement before clicking
     * SAFE: Optional enhancement, doesn't break existing clicks
     */
    async humanClick(page: Page, selector: string, options?: { timeout?: number }): Promise<void> {
        if (!this.isEnabled) {
            await page.click(selector, options)
            return
        }

        try {
            // Small thinking delay before clicking
            await this.humanWait(...this.config.thinking.beforeClick, 'thinking')
            
            // Get element for mouse movement
            const element = await page.$(selector)
            if (element && this.config.mouse.enableMovement) {
                const box = await element.boundingBox()
                if (box) {
                    // Move to approximate area first (human doesn't click precisely immediately)
                    const roughX = box.x + box.width * this.randomInRange(0.2, 0.8)
                    const roughY = box.y + box.height * this.randomInRange(0.2, 0.8)
                    
                    await page.mouse.move(roughX, roughY)
                    await this.humanWait(100, 300, 'thinking')
                    
                    // Then refine to actual click position
                    const accurateX = box.x + box.width * this.randomInRange(0.3, 0.7)
                    const accurateY = box.y + box.height * this.randomInRange(0.3, 0.7)
                    await page.mouse.move(accurateX, accurateY)
                    await this.humanWait(50, 150, 'thinking')
                }
            }
            
            // Perform the actual click
            await page.click(selector, options)
            
        } catch (error) {
            // Fallback to standard click if enhancement fails
            await page.click(selector, options)
        }
    }

    /**
     * Add random scroll patterns to simulate browsing
     * SAFE: Only adds behavior, doesn't interfere with existing functionality
     */
    async humanScroll(page: Page, direction: 'up' | 'down' | 'random' = 'random'): Promise<void> {
        if (!this.isEnabled) return

        try {
            const scrollDirection = direction === 'random' ? (Math.random() > 0.7 ? 'up' : 'down') : direction
            const scrollAmount = this.randomInRange(100, 400)
            const actualScroll = scrollDirection === 'up' ? -scrollAmount : scrollAmount
            
            // Scroll in small increments to look natural
            const increments = Math.ceil(Math.abs(actualScroll) / 50)
            const increment = actualScroll / increments
            
            for (let i = 0; i < increments; i++) {
                await page.mouse.wheel(0, increment)
                await this.humanWait(50, 150, 'scanning')
            }
            
            // Brief pause after scrolling (looking at content)
            await this.humanWait(300, 800, 'reading')
            
        } catch (error) {
            // Silent fail - scrolling is optional
        }
    }

    /**
     * Simulate natural task switching with breaks
     * SAFE: Only adds pauses between tasks
     */
    async taskTransition(taskName: string): Promise<void> {
        if (!this.isEnabled) return

        // Brief pause between different types of tasks
        if (taskName.includes('search')) {
            await this.humanWait(1000, 3000, 'thinking') // Prepare for search
        } else if (taskName.includes('quiz') || taskName.includes('poll')) {
            await this.humanWait(800, 2000, 'thinking') // Think about answer
        } else {
            await this.humanWait(500, 1500, 'thinking') // General task switch
        }
    }

    // PRIVATE HELPER METHODS

    private calculateContextualWait(minMs: number, maxMs: number, context: string): number {
        let multiplier = 1
        
        switch (context) {
            case 'reading':
                multiplier = this.randomInRange(0.8, 1.4)
                break
            case 'thinking':
                multiplier = this.randomInRange(0.9, 1.6)
                break
            case 'typing':
                multiplier = this.randomInRange(0.7, 1.2)
                break
            case 'scanning':
                multiplier = this.randomInRange(0.5, 0.9)
                break
            case 'loading':
                multiplier = this.randomInRange(1.0, 1.3)
                break
        }
        
        const baseTime = this.randomInRange(minMs, maxMs)
        return Math.round(baseTime * multiplier)
    }

    private applyFatigue(waitTime: number): number {
        // Simple fatigue simulation - this could be enhanced with session tracking
        const now = Date.now()
        const sessionStart = this.bot.executionStartTime?.getTime() || now
        const sessionMinutes = (now - sessionStart) / 60000
        
        if (sessionMinutes > this.config.attention.fatigueAfterMinutes) {
            const fatigueMultiplier = 1 + ((sessionMinutes - this.config.attention.fatigueAfterMinutes) * 0.01)
            return waitTime * Math.min(fatigueMultiplier, 1.5) // Max 50% slower when tired
        }
        
        return waitTime
    }

    private getTypo(char: string): string {
        // Simple typo simulation based on keyboard layout
        const typoMap: { [key: string]: string[] } = {
            'a': ['s', 'q', 'w'],
            'e': ['w', 'r', 'd'],
            'i': ['u', 'o', 'k'],
            'o': ['i', 'p', 'l'],
            // Add more as needed
        }
        
        const alternatives = typoMap[char.toLowerCase()]
        if (alternatives) {
            return alternatives[Math.floor(Math.random() * alternatives.length)]
        }
        
        return char
    }

    private randomInRange(min: number, max: number): number {
        return Math.random() * (max - min) + min
    }
}
