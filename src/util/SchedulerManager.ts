import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { Config } from '../interface/Config'

interface SchedulerState {
    lastRunDate: string;
    nextRunTime: number;
    consecutiveFailures: number;
    isRunning: boolean;
    lastFailureTime?: number;
}

export class SchedulerManager {
    private configPath: string
    private statePath: string

    constructor() {
        this.configPath = join(process.cwd(), 'src', 'config.json')
        this.statePath = join(process.cwd(), 'scheduler-state.json')
    }

    private loadConfig(): Config {
        if (!existsSync(this.configPath)) {
            throw new Error('❌ config.json not found in src/ directory')
        }
        
        try {
            return JSON.parse(readFileSync(this.configPath, 'utf8'))
        } catch (error) {
            throw new Error(`❌ Failed to parse config.json: ${error instanceof Error ? error.message : error}`)
        }
    }

    private saveConfig(config: Config): void {
        try {
            writeFileSync(this.configPath, JSON.stringify(config, null, 4))
            console.log('✅ Configuration saved successfully')
        } catch (error) {
            throw new Error(`❌ Failed to save config.json: ${error instanceof Error ? error.message : error}`)
        }
    }

    private loadState(): SchedulerState | null {
        if (!existsSync(this.statePath)) {
            return null
        }
        
        try {
            return JSON.parse(readFileSync(this.statePath, 'utf8'))
        } catch (error) {
            console.warn(`⚠️ Failed to load scheduler state: ${error instanceof Error ? error.message : error}`)
            return null
        }
    }

    public showStatus(): void {
        const config = this.loadConfig()
        const state = this.loadState()
        
        console.log('\n📋 Microsoft Rewards Scheduler Status\n')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        
        // Configuration Status
        console.log('📝 Configuration:')
        console.log(`   Enabled: ${config.scheduler?.enabled ? '✅ Yes' : '❌ No'}`)
        console.log(`   Daily Run Time: ${config.scheduler?.dailyRunTime || 'Not set'}`)
        console.log(`   Timezone: ${config.scheduler?.timezone || 'Not set'}`)
        console.log(`   Random Delay: ${config.scheduler?.randomDelayMinutes?.min || 0}-${config.scheduler?.randomDelayMinutes?.max || 0} minutes`)
        console.log(`   Daily Retries: ${config.dailyRetries || 0} additional (${(config.dailyRetries || 0) + 1} total passes)`)
        console.log(`   Retry Delay: ${config.retryDelayMinutes || 30} minutes`)
        console.log(`   Scheduler Retry on Failure: ${config.scheduler?.retryOnFailure?.enabled ? '✅ Yes' : '❌ No'}`)
        
        if (config.scheduler?.retryOnFailure?.enabled) {
            console.log(`   Max Scheduler Retries: ${config.scheduler.retryOnFailure.maxRetries}`)
            console.log(`   Scheduler Retry Delay: ${config.scheduler.retryOnFailure.retryDelayMinutes} minutes`)
        }
        
        // Final Webhook Status
        console.log('\n📡 Final Webhook:')
        const webhook = config.finalWebhook
        console.log(`   Status: ${webhook?.enabled ? '✅ Enabled' : '❌ Disabled'}`)
        if (webhook?.url) {
            const maskedUrl = webhook.url.length > 40 ? 
                webhook.url.substring(0, 40) + '...' : 
                webhook.url
            console.log(`   URL: ${maskedUrl}`)
        } else {
            console.log(`   URL: Not configured`)
        }
        
        // Human Behavior Status
        console.log('\n🤖 Human Behavior:')
        const humanBehavior = config.humanBehavior
        console.log(`   Status: ${humanBehavior?.enabled ? '✅ Enabled' : '❌ Disabled'}`)
        if (humanBehavior?.enabled) {
            console.log(`   Profile: ${humanBehavior.profile || 'balanced'}`)
            console.log(`   Intensity: ${humanBehavior.intensity || 'moderate'}`)
            const enabledFeatures = Object.entries(humanBehavior.features || {})
                .filter(([, enabled]) => enabled)
                .map(([feature]) => feature)
            console.log(`   Active Features: ${enabledFeatures.length > 0 ? enabledFeatures.join(', ') : 'None'}`)
        }
        
        // Runtime Status
        console.log('\n⚡ Runtime Status:')
        if (state) {
            console.log(`   Last Run Date: ${state.lastRunDate || 'Never'}`)
            console.log(`   Currently Running: ${state.isRunning ? '🟢 Yes' : '🔴 No'}`)
            console.log(`   Consecutive Failures: ${state.consecutiveFailures || 0}`)
            
            if (state.nextRunTime) {
                const nextRun = new Date(state.nextRunTime)
                console.log(`   Next Scheduled Run: ${nextRun.toLocaleString()}`)
            } else {
                console.log(`   Next Scheduled Run: Not scheduled`)
            }
            
            if (state.lastFailureTime) {
                const lastFailure = new Date(state.lastFailureTime)
                console.log(`   Last Failure: ${lastFailure.toLocaleString()}`)
            }
        } else {
            console.log('   No runtime data available')
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    }

    public enableScheduler(time: string, timezone: string = 'UTC'): void {
        const config = this.loadConfig()
        
        // Validate time format
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
        if (!timeRegex.test(time)) {
            throw new Error('❌ Invalid time format. Use HH:MM (e.g., 06:00, 14:30)')
        }
        
        // Initialize scheduler config if it doesn't exist
        if (!config.scheduler) {
            config.scheduler = {
                enabled: false,
                dailyRunTime: "06:00",
                timezone: "UTC",
                randomDelayMinutes: {
                    min: 5,
                    max: 50
                },
                retryOnFailure: {
                    enabled: true,
                    maxRetries: 3,
                    retryDelayMinutes: 30
                }
            }
        }
        
        // Initialize daily retries if not set
        if (config.dailyRetries === undefined) {
            config.dailyRetries = 0 // Default to 0 additional retries (1 total pass)
        }
        if (!config.retryDelayMinutes) {
            config.retryDelayMinutes = 30
        }
        
        config.scheduler.enabled = true
        config.scheduler.dailyRunTime = time
        config.scheduler.timezone = timezone
        
        this.saveConfig(config)
        console.log(`✅ Scheduler enabled for daily runs at ${time} (${timezone})`)
        console.log('💡 Use "npm run start:scheduler" to start the scheduler')
    }

    public disableScheduler(): void {
        const config = this.loadConfig()
        
        if (!config.scheduler) {
            console.log('ℹ️ Scheduler is not configured')
            return
        }
        
        config.scheduler.enabled = false
        this.saveConfig(config)
        console.log('✅ Scheduler disabled')
    }

    public setRandomDelay(min: number, max: number): void {
        const config = this.loadConfig()
        
        if (isNaN(min) || isNaN(max) || min < 0 || max <= min) {
            throw new Error('❌ Invalid delay values. Min and max must be positive numbers with min < max')
        }
        
        if (!config.scheduler) {
            throw new Error('❌ Scheduler not configured. Enable it first with the enable command')
        }
        
        config.scheduler.randomDelayMinutes = { min, max }
        this.saveConfig(config)
        console.log(`✅ Random delay set to ${min}-${max} minutes`)
    }

    public setRetryConfig(enabled: boolean, maxRetries: number, delayMinutes: number): void {
        const config = this.loadConfig()
        
        if (!config.scheduler) {
            throw new Error('❌ Scheduler not configured. Enable it first with the enable command')
        }
        
        config.scheduler.retryOnFailure = {
            enabled,
            maxRetries: maxRetries || 3,
            retryDelayMinutes: delayMinutes || 30
        }
        
        this.saveConfig(config)
        console.log(`✅ Scheduler retry configuration updated`)
    }

    public setDailyRetries(retries: number, delayMinutes?: number): void {
        const config = this.loadConfig()
        
        if (retries < 0 || retries > 10) {
            throw new Error('❌ Daily retries must be between 0 and 10 (0 = no additional retries, just initial run)')
        }
        
        config.dailyRetries = retries
        if (delayMinutes !== undefined) {
            if (delayMinutes < 1 || delayMinutes > 240) {
                throw new Error('❌ Retry delay must be between 1 and 240 minutes')
            }
            config.retryDelayMinutes = delayMinutes
        }
        
        const totalPasses = retries + 1
        this.saveConfig(config)
        console.log(`✅ Daily retries set to ${retries} additional (${totalPasses} total pass${totalPasses > 1 ? 'es' : ''}) with ${config.retryDelayMinutes || 30} minutes delay`)
    }

    public enableFinalWebhook(url: string): void {
        const config = this.loadConfig()
        
        // Initialize finalWebhook if it doesn't exist
        if (!config.finalWebhook) {
            config.finalWebhook = { enabled: false, url: '' }
        }
        
        config.finalWebhook.enabled = true
        config.finalWebhook.url = url
        
        this.saveConfig(config)
        console.log(`✅ Final webhook notifications enabled`)
        console.log(`📡 Webhook URL: ${url}`)
        console.log(`ℹ️  Notifications will be sent after all retry passes complete`)
    }

    public disableFinalWebhook(): void {
        const config = this.loadConfig()
        
        if (!config.finalWebhook) {
            config.finalWebhook = { enabled: false, url: '' }
        } else {
            config.finalWebhook.enabled = false
        }
        
        this.saveConfig(config)
        console.log(`❌ Final webhook notifications disabled`)
    }

    public showWebhookStatus(): void {
        const config = this.loadConfig()
        const webhook = config.finalWebhook
        
        console.log(`\n📡 Final Webhook Configuration:`)
        console.log(`   Status: ${webhook?.enabled ? '✅ Enabled' : '❌ Disabled'}`)
        
        if (webhook?.url) {
            // Mask the webhook URL for security (show first 40 chars + ...)
            const maskedUrl = webhook.url.length > 40 ? 
                webhook.url.substring(0, 40) + '...' : 
                webhook.url
            console.log(`   URL: ${maskedUrl}`)
        } else {
            console.log(`   URL: Not configured`)
        }
        
        if (webhook?.enabled) {
            console.log(`   ℹ️  Webhook will send summary after all retry passes complete`)
        }
        console.log()
    }

    public enableHumanBehavior(): void {
        const config = this.loadConfig()
        
        // Initialize humanBehavior if it doesn't exist
        if (!config.humanBehavior) {
            config.humanBehavior = {
                enabled: false,
                intensity: 'moderate',
                profile: 'balanced',
                features: {
                    variableTiming: true,
                    mouseMovement: false,
                    typingPatterns: false,
                    readingSimulation: true,
                    taskTransitions: true,
                    fatigueSimulation: false,
                    randomScrolling: false
                }
            }
        }
        
        config.humanBehavior.enabled = true
        
        this.saveConfig(config)
        console.log(`✅ Human behavior simulation enabled`)
        console.log(`🤖 Profile: ${config.humanBehavior.profile} | Intensity: ${config.humanBehavior.intensity}`)
        console.log(`ℹ️  Features: ${Object.entries(config.humanBehavior.features).filter(([, v]) => v).map(([k]) => k).join(', ')}`)
        console.log(`⚠️  Note: Human behavior may increase execution time but reduces detection risk`)
    }

    public disableHumanBehavior(): void {
        const config = this.loadConfig()
        
        if (!config.humanBehavior) {
            config.humanBehavior = {
                enabled: false,
                intensity: 'moderate',
                profile: 'balanced',
                features: {
                    variableTiming: true,
                    mouseMovement: false,
                    typingPatterns: false,
                    readingSimulation: true,
                    taskTransitions: true,
                    fatigueSimulation: false,
                    randomScrolling: false
                }
            }
        } else {
            config.humanBehavior.enabled = false
        }
        
        this.saveConfig(config)
        console.log(`❌ Human behavior simulation disabled`)
        console.log(`ℹ️  Execution will use original timing patterns`)
    }

    public configureHumanFeature(feature: string, enabled: boolean): void {
        const config = this.loadConfig()
        
        if (!config.humanBehavior) {
            throw new Error('❌ Human behavior is not configured. Run "npm run scheduler human-enable" first')
        }
        
        const validFeatures = [
            'variableTiming', 'mouseMovement', 'typingPatterns', 
            'readingSimulation', 'taskTransitions', 'fatigueSimulation', 'randomScrolling'
        ]
        
        if (!validFeatures.includes(feature)) {
            throw new Error(`❌ Invalid feature. Valid features: ${validFeatures.join(', ')}`)
        }
        
        // @ts-expect-error - Dynamic property access
        config.humanBehavior.features[feature] = enabled
        
        this.saveConfig(config)
        console.log(`✅ Human behavior feature "${feature}" ${enabled ? 'enabled' : 'disabled'}`)
        
        if (enabled && !config.humanBehavior.enabled) {
            console.log(`⚠️  Note: Human behavior is disabled globally. Enable with "npm run scheduler human-enable"`)
        }
    }

    public static showHelp(): void {
        console.log(`
🤖 Microsoft Rewards Scheduler Manager

Usage: npm run scheduler <command> [options]

Commands:
  status                                    Show scheduler status
  enable <time> [timezone]                  Enable scheduler (e.g., enable 06:00 UTC)
  disable                                   Disable scheduler
  delay <min> <max>                         Set random delay in minutes (e.g., delay 5 50)
  retry <enabled> <maxRetries> <delay>      Configure scheduler retry settings (e.g., retry true 3 30)
  daily-retries <count> [delay]             Set additional daily retries for all accounts (e.g., daily-retries 2 30)
  webhook-enable <url>                      Enable final webhook notifications (e.g., webhook-enable https://discord.com/api/webhooks/...)
  webhook-disable                           Disable final webhook notifications
  webhook-status                            Show webhook configuration status
  human-enable                              Enable human behavior simulation
  human-disable                             Disable human behavior simulation
  human-config <feature> <enabled>          Configure human behavior features (e.g., human-config variableTiming true)
  help                                      Show this help message

Examples:
  npm run scheduler enable 06:00 UTC
  npm run scheduler enable 14:30 America/New_York
  npm run scheduler delay 10 60
  npm run scheduler retry true 5 45
  npm run scheduler daily-retries 2 30
  npm run scheduler webhook-enable https://discord.com/api/webhooks/123456/abcdef
  npm run scheduler webhook-disable
  npm run scheduler webhook-status
  npm run scheduler human-enable
  npm run scheduler human-config variableTiming true
  npm run scheduler status
  npm run scheduler disable

Daily Retries Logic:
  - dailyRetries 0: 1 total pass (initial run only, no retries)
  - dailyRetries 1: 2 total passes (initial + 1 additional)  
  - dailyRetries 3: 4 total passes (initial + 3 additional)
  
Daily Retries vs Scheduler Retries:
  - daily-retries: Additional passes through ALL accounts after initial run
  - retry: Retry failed scheduler runs (e.g., if script crashes)

After enabling, start the scheduler with:
  npm run build && npm run start:scheduler

For development:
  npm run ts-start:scheduler
`)
    }
}

// CLI interface when run directly
if (require.main === module) {
    const manager = new SchedulerManager()
    const command = process.argv[2]

    try {
        switch (command) {
            case 'status':
                manager.showStatus()
                break
            case 'enable':
                const time = process.argv[3]
                const timezone = process.argv[4] || 'UTC'
                if (!time) {
                    throw new Error('❌ Time is required. Example: npm run scheduler enable 06:00')
                }
                manager.enableScheduler(time, timezone)
                break
            case 'disable':
                manager.disableScheduler()
                break
            case 'delay':
                const min = parseInt(process.argv[3])
                const max = parseInt(process.argv[4])
                if (!min || !max) {
                    throw new Error('❌ Min and max delay required. Example: npm run scheduler delay 5 50')
                }
                manager.setRandomDelay(min, max)
                break
            case 'retry':
                const enabled = process.argv[3] === 'true'
                const maxRetries = parseInt(process.argv[4]) || 3
                const delayMinutes = parseInt(process.argv[5]) || 30
                manager.setRetryConfig(enabled, maxRetries, delayMinutes)
                break
            case 'daily-retries':
                const dailyRetries = parseInt(process.argv[3])
                const dailyDelay = process.argv[4] ? parseInt(process.argv[4]) : undefined
                if (isNaN(dailyRetries) || dailyRetries < 0) {
                    throw new Error('❌ Daily retries count required (0 or higher). Example: npm run scheduler daily-retries 2 30')
                }
                manager.setDailyRetries(dailyRetries, dailyDelay)
                break
            case 'webhook-enable':
                const webhookUrl = process.argv[3]
                if (!webhookUrl) {
                    throw new Error('❌ Webhook URL is required. Example: npm run scheduler webhook-enable https://discord.com/api/webhooks/...')
                }
                if (!webhookUrl.startsWith('https://')) {
                    throw new Error('❌ Webhook URL must start with https://')
                }
                manager.enableFinalWebhook(webhookUrl)
                break
            case 'webhook-disable':
                manager.disableFinalWebhook()
                break
            case 'webhook-status':
                manager.showWebhookStatus()
                break
            case 'human-enable':
                manager.enableHumanBehavior()
                break
            case 'human-disable':
                manager.disableHumanBehavior()
                break
            case 'human-config':
                const feature = process.argv[3]
                const enabled = process.argv[4] === 'true'
                if (!feature) {
                    throw new Error('❌ Feature name required. Example: npm run scheduler human-config variableTiming true')
                }
                manager.configureHumanFeature(feature, enabled)
                break
            case 'help':
            case undefined:
                SchedulerManager.showHelp()
                break
            default:
                console.error(`❌ Unknown command: ${command}`)
                SchedulerManager.showHelp()
                process.exit(1)
        }
    } catch (error) {
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
    }
}
