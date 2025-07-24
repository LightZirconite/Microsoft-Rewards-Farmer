import axios from 'axios'
import { log } from './Logger'
import { Config } from '../interface/Config'
import { FinalSummary, AccountResult } from '../interface/FinalSummary'

/**
 * Sends a comprehensive final webhook notification with execution summary
 * Uses security measures to avoid detection and protect sensitive data
 * @param config - Application configuration containing webhook settings
 * @param summary - Complete execution summary with account results
 */
export async function sendFinalWebhook(config: Config, summary: FinalSummary): Promise<void> {
    const finalWebhook = config.finalWebhook

    // Check if final webhook is enabled and properly configured
    if (!finalWebhook?.enabled || !finalWebhook.url || finalWebhook.url.length < 10) {
        log('main', 'FINAL-WEBHOOK', 'Final webhook disabled or not configured', 'log')
        return
    }

    try {
        log('main', 'FINAL-WEBHOOK', `Preparing secure summary for ${summary.totalAccounts} accounts...`, 'log')

        // Apply security filtering to protect sensitive data
        const secureEmbed = createSecureDiscordEmbed(summary, config)
        
        const requestData = {
            embeds: [secureEmbed]
        }

        // Add random delay before sending webhook to avoid pattern detection
        const security = config.finalWebhook.security
        if (security?.enableDelayRandomization !== false) {
            const randomDelay = Math.floor(Math.random() * 30000) + 10000 // 10-40 seconds
            log('main', 'FINAL-WEBHOOK', `Adding ${Math.round(randomDelay/1000)}s security delay...`, 'log')
            await new Promise(resolve => setTimeout(resolve, randomDelay))
        }

        log('main', 'FINAL-WEBHOOK', 'Sending secure webhook notification...', 'log')
        
        const headers: any = {
            'Content-Type': 'application/json'
        }

        // Add randomized user agent if security is enabled
        if (security?.enableUserAgentRotation !== false) {
            headers['User-Agent'] = getRandomUserAgent()
        }
        
        const response = await axios.post(finalWebhook.url, requestData, {
            headers,
            timeout: 45000 // Extended timeout for security delay
        })
        
        if (response.status >= 200 && response.status < 300) {
            log('main', 'FINAL-WEBHOOK', 'Success: Secure webhook notification sent', 'log', 'green')
        } else {
            log('main', 'FINAL-WEBHOOK', `Webhook request returned status ${response.status}`, 'warn')
        }
        
    } catch (error: any) {
        const errorMessage = error?.response?.data?.message || error?.message || String(error)
        log('main', 'FINAL-WEBHOOK', `Failed to send secure webhook: ${errorMessage}`, 'error')
    }
}

/**
 * Creates a secure Discord embed with the execution summary
 * Masks sensitive information and avoids automation detection patterns
 * @param summary - Execution summary data
 * @param config - Application configuration for security settings
 * @returns Secure Discord embed object
 */
function createSecureDiscordEmbed(summary: FinalSummary, config: Config): any {
    const security = config.finalWebhook?.security
    const enableMasking = security?.enableDataMasking !== false
    const maxAccounts = security?.maxAccountsDisplayed || 8
    const maxFailedAccounts = security?.maxFailedAccountsDisplayed || 3

    const duration = Math.round(summary.totalExecutionTime / 60) // Convert to minutes
    const successRate = summary.totalAccounts > 0 ? 
        Math.round((summary.successfulAccounts / summary.totalAccounts) * 100) : 0

    // Determine embed color based on success rate
    const embedColor = successRate >= 90 ? 0x00ff00 : // Green for 90%+
                      successRate >= 70 ? 0xffa500 : // Orange for 70-89%
                      0xff0000 // Red for <70%

    const embed = {
        title: enableMasking ? "🎯 Daily Task Summary" : "🎯 Microsoft Rewards - Final Execution Summary",
        description: enableMasking ? "Automation execution completed successfully" : undefined,
        color: embedColor,
        timestamp: summary.endTime.toISOString(),
        fields: [
            {
                name: enableMasking ? "📊 Execution Statistics" : "📊 Overall Statistics",
                value: [
                    `**${enableMasking ? 'Accounts Processed' : 'Total Accounts'}:** ${summary.totalAccounts}`,
                    `**${enableMasking ? 'Successful Runs' : 'Successful'}:** ${summary.successfulAccounts} ✅`,
                    `**${enableMasking ? 'Failed Runs' : 'Failed'}:** ${summary.failedAccounts} ❌`,
                    `**Success Rate:** ${successRate}%`,
                    `**${enableMasking ? 'Points Earned' : 'Total Points Gained'}:** ${summary.totalPointsGained.toLocaleString()} 🎁`
                ].join('\n'),
                inline: false
            },
            {
                name: enableMasking ? "⏱️ Performance Metrics" : "⏱️ Execution Details",
                value: [
                    `**Total Duration:** ${duration} minutes`,
                    `**${enableMasking ? 'Execution Cycles' : 'Retry Passes Used'}:** ${summary.retryPassesUsed}`,
                    `**Started:** ${enableMasking ? formatSecureTime(summary.startTime) : summary.startTime.toLocaleString()}`,
                    `**Completed:** ${enableMasking ? formatSecureTime(summary.endTime) : summary.endTime.toLocaleString()}`
                ].join('\n'),
                inline: false
            }
        ],
        footer: {
            text: enableMasking ? `Task Manager • ${getRandomFooter()}` : "Microsoft Rewards Automation",
            icon_url: enableMasking ? "https://img.icons8.com/color/48/checkmark.png" : "https://img.icons8.com/color/48/microsoft.png"
        }
    }

    // Add secure account details if there are successful accounts
    if (summary.successfulAccounts > 0) {
        const accountDetails = summary.accountResults
            .filter(account => account.success)
            .slice(0, maxAccounts)
            .map((account, index) => {
                const duration = Math.round(account.executionDuration / 60)
                const emailDisplay = enableMasking ? `Account ${index + 1}` : account.email
                const maskedEmail = enableMasking ? `(${maskEmail(account.email)})` : ''
                
                return `**${emailDisplay}** ${maskedEmail}\n` +
                       `${enableMasking ? 'Progress' : 'Points'}: ${account.pointsBefore.toLocaleString()} → ${account.pointsAfter.toLocaleString()} (+${account.pointsGained.toLocaleString()})\n` +
                       `Tasks: ${account.tasksCompleted} | ${enableMasking ? 'Time' : 'Duration'}: ${duration}m\n`
            }).join('\n')

        if (accountDetails) {
            embed.fields.push({
                name: `✅ ${enableMasking ? 'Successful Executions' : 'Successful Accounts'} ${summary.successfulAccounts > maxAccounts ? `(showing ${maxAccounts} of ${summary.successfulAccounts})` : ''}`,
                value: accountDetails,
                inline: false
            })
        }
    }

    // Add failed accounts with minimal details for security
    if (summary.failedAccounts > 0) {
        const failedCount = Math.min(summary.failedAccounts, maxFailedAccounts)
        const failedDetails = summary.accountResults
            .filter(account => !account.success)
            .slice(0, failedCount)
            .map((account, index) => {
                const emailDisplay = enableMasking ? `Account ${index + 1}` : account.email
                const maskedEmail = enableMasking ? `(${maskEmail(account.email)})` : ''
                const errorDisplay = enableMasking ? 
                    categorizeError(account.errorMessage || 'Unknown error') : 
                    (account.errorMessage || 'Unknown error')
                
                return `**${emailDisplay}** ${maskedEmail}: ${errorDisplay}`
            }).join('\n')

        if (failedDetails) {
            embed.fields.push({
                name: `❌ ${enableMasking ? 'Failed Executions' : 'Failed Accounts'} ${summary.failedAccounts > maxFailedAccounts ? `(${failedCount} of ${summary.failedAccounts})` : ''}`,
                value: failedDetails,
                inline: false
            })
        }
    }

    return embed
}

/**
 * Legacy function for backward compatibility - redirects to secure version
 */
function createDiscordEmbed(summary: FinalSummary): any {
    // Create default config for backward compatibility
    const defaultConfig: Config = {
        finalWebhook: {
            enabled: true,
            url: '',
            security: {
                enableDelayRandomization: true,
                enableDataMasking: true,
                enableUserAgentRotation: true,
                maxAccountsDisplayed: 8,
                maxFailedAccountsDisplayed: 3
            }
        }
    } as Config
    
    return createSecureDiscordEmbed(summary, defaultConfig)
}

/**
 * Creates an AccountResult object for tracking individual account execution
 * @param email - Account email
 * @param pointsBefore - Points before execution
 * @param pointsAfter - Points after execution  
 * @param tasksCompleted - Number of tasks completed
 * @param executionDuration - Duration in seconds
 * @param success - Whether execution was successful
 * @param errorMessage - Error message if failed
 * @returns AccountResult object
 */
export function createAccountResult(
    email: string,
    pointsBefore: number = 0,
    pointsAfter: number = 0,
    tasksCompleted: number = 0,
    executionDuration: number = 0,
    success: boolean = true,
    errorMessage?: string
): AccountResult {
    return {
        email,
        pointsBefore,
        pointsAfter,
        pointsGained: Math.max(0, pointsAfter - pointsBefore),
        tasksCompleted,
        executionDuration,
        success,
        errorMessage
    }
}

/**
 * Creates a FinalSummary object for tracking overall execution
 * @param accountResults - Array of individual account results
 * @param retryPassesUsed - Number of retry passes used
 * @param startTime - Execution start time
 * @param endTime - Execution end time
 * @returns FinalSummary object
 */
export function createFinalSummary(
    accountResults: AccountResult[],
    retryPassesUsed: number,
    startTime: Date,
    endTime: Date = new Date()
): FinalSummary {
    const successfulAccounts = accountResults.filter(account => account.success).length
    const failedAccounts = accountResults.length - successfulAccounts
    const totalPointsGained = accountResults.reduce((sum, account) => sum + account.pointsGained, 0)
    const totalExecutionTime = Math.round((endTime.getTime() - startTime.getTime()) / 1000)

    return {
        totalAccounts: accountResults.length,
        successfulAccounts,
        failedAccounts,
        totalPointsGained,
        retryPassesUsed,
        totalExecutionTime,
        startTime,
        endTime,
        accountResults
    }
}

/**
 * Security utility functions for anti-detection
 */

/**
 * Masks email addresses to prevent exposure of sensitive account information
 * @param email - Original email address
 * @returns Masked email (e.g., "user***@gmail.com")
 */
function maskEmail(email: string): string {
    const [localPart, domain] = email.split('@')
    if (!localPart || !domain) return '***@***.com'
    
    const maskedLocal = localPart.length > 3 ? 
        localPart.substring(0, 2) + '***' : 
        '***'
    
    return `${maskedLocal}@${domain}`
}

/**
 * Categorizes error messages to avoid exposing automation patterns
 * @param errorMessage - Original error message
 * @returns Generic categorized error
 */
function categorizeError(errorMessage: string): string {
    const msg = errorMessage.toLowerCase()
    
    if (msg.includes('login') || msg.includes('auth') || msg.includes('credential')) {
        return 'Authentication issue'
    }
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('connection')) {
        return 'Connection timeout'
    }
    if (msg.includes('captcha') || msg.includes('verify') || msg.includes('security')) {
        return 'Security verification required'
    }
    if (msg.includes('rate') || msg.includes('limit') || msg.includes('quota')) {
        return 'Service temporarily limited'
    }
    if (msg.includes('browser') || msg.includes('page') || msg.includes('element')) {
        return 'Interface interaction issue'
    }
    
    return 'Temporary service issue'
}

/**
 * Formats timestamps to avoid revealing exact execution patterns
 * @param date - Date to format
 * @returns Generalized time format
 */
function formatSecureTime(date: Date): string {
    const hours = date.getHours()
    const timeOfDay = hours < 12 ? 'Morning' : hours < 18 ? 'Afternoon' : 'Evening'
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
    
    return `${dayName} ${timeOfDay}`
}

/**
 * Returns random footer text to vary webhook appearance
 * @returns Random footer text
 */
function getRandomFooter(): string {
    const footers = [
        'System Check Complete',
        'Daily Tasks Processed',
        'Routine Maintenance Done',
        'Background Service Update',
        'Scheduled Operations Complete',
        'Task Queue Processed',
        'System Status: Normal'
    ]
    
    return footers[Math.floor(Math.random() * footers.length)]
}

/**
 * Returns random user agent for webhook requests to avoid pattern detection
 * @returns Random user agent string
 */
function getRandomUserAgent(): string {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
    
    return userAgents[Math.floor(Math.random() * userAgents.length)]
}
