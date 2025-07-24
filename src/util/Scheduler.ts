import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { log } from './Logger'
import { MicrosoftRewardsBot } from '../index'
import { Config } from '../interface/Config'

interface SchedulerState {
    lastRunDate: string;
    nextRunTime: number;
    consecutiveFailures: number;
    isRunning: boolean;
    lastFailureTime?: number;
}

export class DailyScheduler {
    private config: Config
    private state: SchedulerState
    private stateFilePath: string
    private schedulerTimer?: NodeJS.Timeout
    private isShuttingDown = false

    constructor(config: Config) {
        this.config = config
        this.stateFilePath = join(process.cwd(), 'scheduler-state.json')
        this.state = this.loadState()
        
        // Handle graceful shutdown
        process.on('SIGINT', () => this.shutdown())
        process.on('SIGTERM', () => this.shutdown())
        process.on('beforeExit', () => this.shutdown())
    }

    /**
     * Start the daily scheduler
     */
    public start(): void {
        if (!this.config.scheduler?.enabled) {
            log('main', 'SCHEDULER', 'Scheduler is disabled in config', 'warn')
            return
        }

        log('main', 'SCHEDULER', 'Starting daily scheduler system', 'log', 'green')
        
        // Validate configuration
        if (!this.validateConfig()) {
            log('main', 'SCHEDULER', 'Invalid scheduler configuration. Scheduler disabled.', 'error')
            return
        }

        // Check if we should run immediately
        if (this.shouldRunNow()) {
            log('main', 'SCHEDULER', 'Immediate run required', 'log', 'yellow')
            this.executeWithRetry()
        } else {
            this.scheduleNext()
        }
    }

    /**
     * Stop the scheduler
     */
    public stop(): void {
        log('main', 'SCHEDULER', 'Stopping scheduler', 'warn')
        if (this.schedulerTimer) {
            clearTimeout(this.schedulerTimer)
            this.schedulerTimer = undefined
        }
        this.saveState()
    }

    /**
     * Check if the script should run immediately
     */
    private shouldRunNow(): boolean {
        const today = this.getTodayDateString()
        const now = Date.now()
        
        // Never ran before
        if (!this.state.lastRunDate) {
            return true
        }
        
        // Different day and past scheduled time
        if (this.state.lastRunDate !== today) {
            const todayScheduledTime = this.getTodayScheduledTime()
            if (now >= todayScheduledTime) {
                return true
            }
        }

        // Retry logic for failed runs
        if (this.config.scheduler.retryOnFailure.enabled && 
            this.state.consecutiveFailures > 0 && 
            this.state.lastFailureTime) {
            
            const retryDelay = this.config.scheduler.retryOnFailure.retryDelayMinutes * 60 * 1000
            if (now >= this.state.lastFailureTime + retryDelay) {
                return true
            }
        }

        return false
    }

    /**
     * Schedule the next run
     */
    private scheduleNext(): void {
        if (this.isShuttingDown) return

        const nextRunTime = this.calculateNextRunTime()
        const delay = nextRunTime - Date.now()
        
        if (delay <= 0) {
            // Should run now
            this.executeWithRetry()
            return
        }

        const nextRunDate = new Date(nextRunTime)
        log('main', 'SCHEDULER', `Next run scheduled for: ${nextRunDate.toLocaleString()} (${this.config.scheduler.timezone})`)

        this.schedulerTimer = setTimeout(() => {
            this.executeWithRetry()
        }, delay)

        this.state.nextRunTime = nextRunTime
        this.saveState()
    }

    /**
     * Calculate the next run time with randomization
     */
    private calculateNextRunTime(): number {
        const todayScheduledTime = this.getTodayScheduledTime()
        
        let targetTime = todayScheduledTime
        
        // If today's time has passed, schedule for tomorrow
        if (Date.now() >= todayScheduledTime) {
            targetTime = this.getTomorrowScheduledTime()
        }

        // Add random delay
        const randomDelayMs = this.getRandomDelay()
        return targetTime + randomDelayMs
    }

    /**
     * Get today's scheduled time in milliseconds
     */
    private getTodayScheduledTime(): number {
        return this.getScheduledTimeForDate(new Date())
    }

    /**
     * Get tomorrow's scheduled time in milliseconds
     */
    private getTomorrowScheduledTime(): number {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        return this.getScheduledTimeForDate(tomorrow)
    }

    /**
     * Get scheduled time for a specific date
     */
    private getScheduledTimeForDate(date: Date): number {
        const [hours, minutes] = this.config.scheduler.dailyRunTime.split(':').map(Number)
        
        // Create the target time using the configured timezone
        const scheduledDate = new Date(date)
        scheduledDate.setHours(hours, minutes, 0, 0)
        
        // Apply timezone offset based on config
        const timezoneOffsetMs = this.getConfiguredTimezoneOffset()
        return scheduledDate.getTime() + timezoneOffsetMs
    }

    /**
     * Get timezone offset in milliseconds based on configuration
     */
    private getConfiguredTimezoneOffset(): number {
        const configuredTz = this.config.scheduler.timezone
        
        // For common timezones, calculate offset
        // This is a simplified implementation - in production you'd use a proper timezone library
        switch (configuredTz) {
            case 'UTC':
                return 0
            case 'Europe/Paris':
            case 'CET':
                // Paris is UTC+1 (winter) or UTC+2 (summer)
                const now = new Date()
                const isJuly = now.getMonth() === 6 // July (0-indexed)
                const isDST = isJuly || (now.getMonth() >= 2 && now.getMonth() <= 9) // Rough DST check
                return isDST ? -2 * 60 * 60 * 1000 : -1 * 60 * 60 * 1000 // Negative because we want local time
            case 'America/New_York':
            case 'EST':
                const isNYDST = now.getMonth() >= 2 && now.getMonth() <= 10
                return isNYDST ? 4 * 60 * 60 * 1000 : 5 * 60 * 60 * 1000
            default:
                // Fallback to system timezone
                log('main', 'SCHEDULER', `Unknown timezone ${configuredTz}, using system timezone`, 'warn')
                return -new Date().getTimezoneOffset() * 60 * 1000
        }
    }

    /**
     * Get random delay in milliseconds
     */
    private getRandomDelay(): number {
        const { min, max } = this.config.scheduler.randomDelayMinutes
        const randomMinutes = Math.floor(Math.random() * (max - min + 1)) + min
        return randomMinutes * 60 * 1000
    }

    /**
     * Execute the main script with retry logic
     */
    private async executeWithRetry(): Promise<void> {
        if (this.state.isRunning) {
            log('main', 'SCHEDULER', 'Script is already running, skipping execution', 'warn')
            return
        }

        const today = this.getTodayDateString()
        
        // Check if already ran successfully today
        if (this.state.lastRunDate === today && this.state.consecutiveFailures === 0) {
            log('main', 'SCHEDULER', 'Script already completed successfully today', 'log', 'green')
            this.scheduleNext()
            return
        }

        // Check retry limits
        if (this.config.scheduler.retryOnFailure.enabled && 
            this.state.consecutiveFailures >= this.config.scheduler.retryOnFailure.maxRetries) {
            log('main', 'SCHEDULER', `Max retries (${this.config.scheduler.retryOnFailure.maxRetries}) exceeded for today`, 'error')
            this.scheduleNext()
            return
        }

        this.state.isRunning = true
        this.saveState()

        const startTime = Date.now()
        log('main', 'SCHEDULER', 'Starting scheduled Microsoft Rewards automation', 'log', 'green')

        try {
            await this.executeMainScript()
            
            // Success
            this.state.lastRunDate = today
            this.state.consecutiveFailures = 0
            this.state.lastFailureTime = undefined
            
            const duration = Math.round((Date.now() - startTime) / 1000)
            log('main', 'SCHEDULER', `Scheduled run completed successfully in ${duration}s`, 'log', 'green')
            
        } catch (error) {
            // Failure
            this.state.consecutiveFailures++
            this.state.lastFailureTime = Date.now()
            
            log('main', 'SCHEDULER', `Scheduled run failed (attempt ${this.state.consecutiveFailures}): ${error}`, 'error')
            
            // Schedule retry if enabled
            if (this.config.scheduler.retryOnFailure.enabled && 
                this.state.consecutiveFailures < this.config.scheduler.retryOnFailure.maxRetries) {
                
                const retryDelay = this.config.scheduler.retryOnFailure.retryDelayMinutes
                log('main', 'SCHEDULER', `Retry scheduled in ${retryDelay} minutes`, 'warn')
                
                setTimeout(() => {
                    this.executeWithRetry()
                }, retryDelay * 60 * 1000)
            }
        } finally {
            this.state.isRunning = false
            this.saveState()
            
            // Schedule next day's run (only if not retrying)
            if (this.state.consecutiveFailures === 0 || 
                this.state.consecutiveFailures >= this.config.scheduler.retryOnFailure.maxRetries) {
                this.scheduleNext()
            }
        }
    }

    /**
     * Execute the main Microsoft Rewards script
     */
    private async executeMainScript(): Promise<void> {
        const rewardsBot = new MicrosoftRewardsBot(false)
        
        try {
            await rewardsBot.initialize()
            await rewardsBot.run()
        } catch (error) {
            throw new Error(`Microsoft Rewards bot execution failed: ${error}`)
        }
    }

    /**
     * Get today's date as string (YYYY-MM-DD)
     */
    private getTodayDateString(): string {
        const dateStr = new Date().toISOString().split('T')[0]
        if (!dateStr) {
            throw new Error('Failed to get current date string')
        }
        return dateStr
    }

    /**
     * Validate scheduler configuration
     */
    private validateConfig(): boolean {
        const { scheduler } = this.config
        
        if (!scheduler) {
            log('main', 'SCHEDULER', 'No scheduler configuration found', 'error')
            return false
        }

        // Validate time format
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
        if (!timeRegex.test(scheduler.dailyRunTime)) {
            log('main', 'SCHEDULER', `Invalid dailyRunTime format: ${scheduler.dailyRunTime}. Use HH:MM format`, 'error')
            return false
        }

        // Validate random delay
        if (scheduler.randomDelayMinutes.min >= scheduler.randomDelayMinutes.max) {
            log('main', 'SCHEDULER', 'Invalid randomDelayMinutes: min must be less than max', 'error')
            return false
        }

        return true
    }

    /**
     * Load scheduler state from file
     */
    private loadState(): SchedulerState {
        const defaultState: SchedulerState = {
            lastRunDate: '',
            nextRunTime: 0,
            consecutiveFailures: 0,
            isRunning: false
        }

        if (!existsSync(this.stateFilePath)) {
            return defaultState
        }

        try {
            const stateData = readFileSync(this.stateFilePath, 'utf8')
            return { ...defaultState, ...JSON.parse(stateData) }
        } catch (error) {
            log('main', 'SCHEDULER', `Failed to load scheduler state: ${error}`, 'warn')
            return defaultState
        }
    }

    /**
     * Save scheduler state to file
     */
    private saveState(): void {
        try {
            writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2))
        } catch (error) {
            log('main', 'SCHEDULER', `Failed to save scheduler state: ${error}`, 'error')
        }
    }

    /**
     * Graceful shutdown
     */
    private shutdown(): void {
        if (this.isShuttingDown) return
        
        this.isShuttingDown = true
        log('main', 'SCHEDULER', 'Shutting down scheduler gracefully')
        this.stop()
    }

    /**
     * Get scheduler status
     */
    public getStatus(): object {
        return {
            enabled: this.config.scheduler?.enabled || false,
            isRunning: this.state.isRunning,
            lastRunDate: this.state.lastRunDate,
            nextRunTime: this.state.nextRunTime ? new Date(this.state.nextRunTime).toLocaleString() : 'Not scheduled',
            consecutiveFailures: this.state.consecutiveFailures,
            dailyRunTime: this.config.scheduler?.dailyRunTime || 'Not set'
        }
    }
}
