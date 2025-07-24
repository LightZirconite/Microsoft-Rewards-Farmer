import cluster from 'cluster'
import { Page } from 'rebrowser-playwright'

import Browser from './browser/Browser'
import BrowserFunc from './browser/BrowserFunc'
import BrowserUtil from './browser/BrowserUtil'

import { log } from './util/Logger'
import Util from './util/Utils'
import { loadAccounts, loadConfig, saveSessionData } from './util/Load'
import { DailyScheduler } from './util/Scheduler'
import { sendFinalWebhook, createAccountResult, createFinalSummary } from './util/FinalWebhook'
import { HumanBehavior } from './util/HumanBehavior'

import { Login } from './functions/Login'
import { Workers } from './functions/Workers'
import Activities from './functions/Activities'

import { Account } from './interface/Account'
import { AccountResult } from './interface/FinalSummary'
import Axios from './util/Axios'


// Main bot class
export class MicrosoftRewardsBot {
    public log: typeof log
    public config
    public utils: Util
    public activities: Activities = new Activities(this)
    public humanBehavior: HumanBehavior
    public browser: {
        func: BrowserFunc,
        utils: BrowserUtil
    }
    public isMobile: boolean
    public homePage!: Page

    private pointsCanCollect: number = 0
    private pointsInitial: number = 0
    private accountResults: AccountResult[] = []
    private executionStartTime: Date = new Date()

    private activeWorkers: number
    private mobileRetryAttempts: number
    private browserFactory: Browser = new Browser(this)
    private accounts: Account[]
    private workers: Workers
    private login = new Login(this)
    private accessToken: string = ''

    //@ts-expect-error Will be initialized later
    public axios: Axios

    constructor(isMobile: boolean) {
        this.isMobile = isMobile
        this.log = log

        this.accounts = []
        this.utils = new Util()
        this.workers = new Workers(this)
        this.browser = {
            func: new BrowserFunc(this),
            utils: new BrowserUtil(this)
        }
        this.config = loadConfig()
        this.humanBehavior = new HumanBehavior(this, this.config.humanBehavior?.enabled ?? false)
        this.activeWorkers = this.config.clusters
        this.mobileRetryAttempts = 0
    }

    async initialize() {
        this.accounts = loadAccounts()
    }

    async run() {
        log('main', 'MAIN', `Bot started with ${this.config.clusters} clusters`)

        // Only cluster when there's more than 1 cluster demanded
        if (this.config.clusters > 1) {
            if (cluster.isPrimary) {
                this.runMaster()
            } else {
                this.runWorker()
            }
        } else {
            await this.runTasks(this.accounts)
        }
    }

    private runMaster() {
        log('main', 'MAIN-PRIMARY', 'Primary process started')

        const accountChunks = this.utils.chunkArray(this.accounts, this.config.clusters)

        for (let i = 0; i < accountChunks.length; i++) {
            const worker = cluster.fork()
            const chunk = accountChunks[i]
            worker.send({ chunk })
        }

        cluster.on('exit', (worker, code) => {
            this.activeWorkers -= 1

            log('main', 'MAIN-WORKER', `Worker ${worker.process.pid} destroyed | Code: ${code} | Active workers: ${this.activeWorkers}`, 'warn')

            // Check if all workers have exited
            if (this.activeWorkers === 0) {
                log('main', 'MAIN-WORKER', 'All workers destroyed. Exiting main process!', 'warn')
                process.exit(0)
            }
        })
    }

    private runWorker() {
        log('main', 'MAIN-WORKER', `Worker ${process.pid} spawned`)
        // Receive the chunk of accounts from the master
        process.on('message', async ({ chunk }) => {
            await this.runTasks(chunk)
        })
    }

    private async runTasks(accounts: Account[]) {
        this.executionStartTime = new Date()
        this.accountResults = []
        
        const additionalRetries = this.config.dailyRetries || 0
        const totalPasses = 1 + additionalRetries // 1 initial + additional retries
        const retryDelay = (this.config.retryDelayMinutes || 30) * 60 * 1000 // Convert to milliseconds
        
        log('main', 'MAIN-WORKER', `Starting daily automation with ${totalPasses} total pass${totalPasses > 1 ? 'es' : ''} (1 initial${additionalRetries > 0 ? ` + ${additionalRetries} additional` : ''})`)
        
        // Initial mandatory run (Pass 1)
        log('main', 'MAIN-WORKER', `Pass 1 of ${totalPasses} (Initial Run)`, 'log', 'green')
        try {
            await this.runAllAccounts(accounts, 1, totalPasses)
            log('main', 'MAIN-WORKER', `Pass 1 of ${totalPasses} completed successfully`, 'log', 'green')
        } catch (error) {
            log('main', 'MAIN-WORKER', `Pass 1 of ${totalPasses} failed: ${error}`, 'error')
            // Continue with retries even if initial run fails
        }
        
        // Additional retry passes (if configured)
        for (let retryNum = 1; retryNum <= additionalRetries; retryNum++) {
            const currentPass = retryNum + 1 // Pass 2, 3, 4, etc.
            
            // Wait before retry
            const delayMinutes = Math.round(retryDelay / 60000)
            log('main', 'MAIN-WORKER', `Waiting ${delayMinutes} minutes before retry ${retryNum}/${additionalRetries}...`, 'log', 'cyan')
            await this.utils.wait(retryDelay)
            
            log('main', 'MAIN-WORKER', `Pass ${currentPass} of ${totalPasses} (Retry ${retryNum}/${additionalRetries})`, 'log', 'yellow')
            try {
                await this.runAllAccounts(accounts, currentPass, totalPasses)
                log('main', 'MAIN-WORKER', `Pass ${currentPass} of ${totalPasses} completed successfully`, 'log', 'green')
            } catch (error) {
                log('main', 'MAIN-WORKER', `Pass ${currentPass} of ${totalPasses} failed: ${error}`, 'error')
                // Continue with remaining retries even if this one fails
            }
        }
        
        // Send final webhook notification if enabled
        await this.sendFinalNotification(totalPasses)
        
        log('main', 'MAIN-PRIMARY', `Completed all ${totalPasses} pass${totalPasses > 1 ? 'es' : ''} for ALL accounts`, 'log', 'green')
        process.exit()
    }

    private async sendFinalNotification(retryPassesUsed: number) {
        try {
            if (this.config.finalWebhook?.enabled) {
                const summary = createFinalSummary(
                    this.accountResults,
                    retryPassesUsed,
                    this.executionStartTime,
                    new Date()
                )
                
                await sendFinalWebhook(this.config, summary)
            }
        } catch (error) {
            log('main', 'FINAL-WEBHOOK', `Error sending final webhook: ${error}`, 'error')
        }
    }

    private async runAllAccounts(accounts: Account[], passNumber: number, totalPasses: number) {
        for (const account of accounts) {
            log('main', 'MAIN-WORKER', `[Pass ${passNumber}/${totalPasses}] Started tasks for account ${account.email}`)

            this.axios = new Axios(account.proxy)
            const accountStartTime = Date.now()
            
            let accountSuccess = true
            let errorMessage: string | undefined
            
            try {
                if (this.config.parallel) {
                    await Promise.all([
                        this.Desktop(account, passNumber),
                        (() => {
                            const mobileInstance = new MicrosoftRewardsBot(true)
                            mobileInstance.axios = this.axios

                            return mobileInstance.Mobile(account, passNumber)
                        })()
                    ])
                } else {
                    this.isMobile = false
                    await this.Desktop(account, passNumber)

                    this.isMobile = true
                    await this.Mobile(account, passNumber)
                }
            } catch (error) {
                accountSuccess = false
                errorMessage = String(error)
                log('main', 'MAIN-WORKER', `[Pass ${passNumber}/${totalPasses}] Error processing account ${account.email}: ${error}`, 'error')
            }

            // Track account result for final webhook (only on first pass to avoid duplicates)
            if (passNumber === 1) {
                const accountResult = createAccountResult(
                    account.email,
                    this.pointsInitial || 0,
                    this.pointsInitial || 0, // Will be updated in Desktop/Mobile methods
                    0, // Will be updated in Desktop/Mobile methods
                    Math.round((Date.now() - accountStartTime) / 1000),
                    accountSuccess,
                    errorMessage
                )
                this.accountResults.push(accountResult)
            }

            log('main', 'MAIN-WORKER', `[Pass ${passNumber}/${totalPasses}] Completed tasks for account ${account.email}`, 'log', 'green')
        }
    }

    // Desktop
    async Desktop(account: Account, passNumber: number = 1) {
        const browser = await this.browserFactory.createBrowser(account.proxy, account.email)
        this.homePage = await browser.newPage()

        log(this.isMobile, 'MAIN', 'Starting browser')

        // Login into MS Rewards, then go to rewards homepage
        await this.login.login(this.homePage, account.email, account.password)

        await this.browser.func.goHome(this.homePage)

        const data = await this.browser.func.getDashboardData()

        this.pointsInitial = data.userStatus.availablePoints

        log(this.isMobile, 'MAIN-POINTS', `Current point count: ${this.pointsInitial}`)

        const browserEnarablePoints = await this.browser.func.getBrowserEarnablePoints()

        // Tally all the desktop points
        this.pointsCanCollect = browserEnarablePoints.dailySetPoints +
            browserEnarablePoints.desktopSearchPoints
            + browserEnarablePoints.morePromotionsPoints

        log(this.isMobile, 'MAIN-POINTS', `You can earn ${this.pointsCanCollect} points today`)

        // If runOnZeroPoints is false and 0 points to earn, don't continue
        if (!this.config.runOnZeroPoints && this.pointsCanCollect === 0) {
            log(this.isMobile, 'MAIN', 'No points to earn and "runOnZeroPoints" is set to "false", stopping!', 'log', 'yellow')

            // Close desktop browser
            await this.browser.func.closeBrowser(browser, account.email)
            return
        }

        // Open a new tab to where the tasks are going to be completed
        const workerPage = await browser.newPage()

        // Go to homepage on worker page
        await this.browser.func.goHome(workerPage)

        let tasksCompleted = 0

        // Complete daily set
        if (this.config.workers.doDailySet) {
            await this.workers.doDailySet(workerPage, data)
            tasksCompleted++
        }

        // Complete more promotions
        if (this.config.workers.doMorePromotions) {
            await this.workers.doMorePromotions(workerPage, data)
            tasksCompleted++
        }

        // Complete punch cards
        if (this.config.workers.doPunchCards) {
            await this.workers.doPunchCard(workerPage, data)
            tasksCompleted++
        }

        // Do desktop searches
        if (this.config.workers.doDesktopSearch) {
            await this.activities.doSearch(workerPage, data)
            tasksCompleted++
        }

        // Get final points
        const pointsAfter = await this.browser.func.getCurrentPoints()
        
        // Update account result if this is the first pass
        if (passNumber === 1) {
            const accountResult = this.accountResults.find(result => result.email === account.email)
            if (accountResult) {
                accountResult.pointsBefore = this.pointsInitial
                accountResult.pointsAfter = pointsAfter
                accountResult.pointsGained = Math.max(0, pointsAfter - this.pointsInitial)
                accountResult.tasksCompleted = tasksCompleted
            }
        }

        // Save cookies
        await saveSessionData(this.config.sessionPath, browser, account.email, this.isMobile)

        // Close desktop browser
        await this.browser.func.closeBrowser(browser, account.email)
        return
    }

    // Mobile
    async Mobile(account: Account, passNumber: number = 1) {
        const browser = await this.browserFactory.createBrowser(account.proxy, account.email)
        this.homePage = await browser.newPage()

        log(this.isMobile, 'MAIN', 'Starting browser')

        // Login into MS Rewards, then go to rewards homepage
        await this.login.login(this.homePage, account.email, account.password)
        this.accessToken = await this.login.getMobileAccessToken(this.homePage, account.email)

        await this.browser.func.goHome(this.homePage)

        const data = await this.browser.func.getDashboardData()

        const browserEnarablePoints = await this.browser.func.getBrowserEarnablePoints()
        const appEarnablePoints = await this.browser.func.getAppEarnablePoints(this.accessToken)

        this.pointsCanCollect = browserEnarablePoints.mobileSearchPoints + appEarnablePoints.totalEarnablePoints

        log(this.isMobile, 'MAIN-POINTS', `You can earn ${this.pointsCanCollect} points today (Browser: ${browserEnarablePoints.mobileSearchPoints} points, App: ${appEarnablePoints.totalEarnablePoints} points)`)

        // If runOnZeroPoints is false and 0 points to earn, don't continue
        if (!this.config.runOnZeroPoints && this.pointsCanCollect === 0) {
            log(this.isMobile, 'MAIN', 'No points to earn and "runOnZeroPoints" is set to "false", stopping!', 'log', 'yellow')

            // Close mobile browser
            await this.browser.func.closeBrowser(browser, account.email)
            return
        }

        let tasksCompleted = 0

        // Do daily check in
        if (this.config.workers.doDailyCheckIn) {
            await this.activities.doDailyCheckIn(this.accessToken, data)
            tasksCompleted++
        }

        // Do read to earn
        if (this.config.workers.doReadToEarn) {
            await this.activities.doReadToEarn(this.accessToken, data)
            tasksCompleted++
        }

        // Do mobile searches
        if (this.config.workers.doMobileSearch) {
            // If no mobile searches data found, stop (Does not always exist on new accounts)
            if (data.userStatus.counters.mobileSearch) {
                // Open a new tab to where the tasks are going to be completed
                const workerPage = await browser.newPage()

                // Go to homepage on worker page
                await this.browser.func.goHome(workerPage)

                await this.activities.doSearch(workerPage, data)
                tasksCompleted++

                // Fetch current search points
                const mobileSearchPoints = (await this.browser.func.getSearchPoints()).mobileSearch?.[0]

                if (mobileSearchPoints && (mobileSearchPoints.pointProgressMax - mobileSearchPoints.pointProgress) > 0) {
                    // Increment retry count
                    this.mobileRetryAttempts++
                }

                // Exit if retries are exhausted
                if (this.mobileRetryAttempts > this.config.searchSettings.retryMobileSearchAmount) {
                    log(this.isMobile, 'MAIN', `Max retry limit of ${this.config.searchSettings.retryMobileSearchAmount} reached. Exiting retry loop`, 'warn')
                } else if (this.mobileRetryAttempts !== 0) {
                    log(this.isMobile, 'MAIN', `Attempt ${this.mobileRetryAttempts}/${this.config.searchSettings.retryMobileSearchAmount}: Unable to complete mobile searches, bad User-Agent? Increase search delay? Retrying...`, 'log', 'yellow')

                    // Close mobile browser
                    await this.browser.func.closeBrowser(browser, account.email)

                    // Create a new browser and try
                    await this.Mobile(account, passNumber)
                    return
                }
            } else {
                log(this.isMobile, 'MAIN', 'Unable to fetch search points, your account is most likely too "new" for this! Try again later!', 'warn')
            }
        }

        const afterPointAmount = await this.browser.func.getCurrentPoints()

        log(this.isMobile, 'MAIN-POINTS', `The script collected ${afterPointAmount - this.pointsInitial} points today`)

        // Update account result if this is the first pass (mobile runs after desktop, so we add to existing data)
        if (passNumber === 1) {
            const accountResult = this.accountResults.find(result => result.email === account.email)
            if (accountResult) {
                // Add mobile tasks to the count
                accountResult.tasksCompleted += tasksCompleted
                // Update final points after mobile execution
                accountResult.pointsAfter = afterPointAmount
                accountResult.pointsGained = Math.max(0, afterPointAmount - accountResult.pointsBefore)
            }
        }

        // Close mobile browser
        await this.browser.func.closeBrowser(browser, account.email)
        return
    }

}

async function main() {
    // Check command line arguments
    const args = process.argv.slice(2)
    const isSchedulerMode = args.includes('--scheduler')
    const isStatusMode = args.includes('--status')
    
    const rewardsBot = new MicrosoftRewardsBot(false)

    try {
        await rewardsBot.initialize()
        
        // Handle scheduler status request
        if (isStatusMode) {
            const scheduler = new DailyScheduler(rewardsBot.config)
            console.log('Scheduler Status:', JSON.stringify(scheduler.getStatus(), null, 2))
            return
        }
        
        // Handle scheduler mode
        if (isSchedulerMode || rewardsBot.config.scheduler?.enabled) {
            log('main', 'MAIN', 'Starting in scheduler mode', 'log', 'green')
            const scheduler = new DailyScheduler(rewardsBot.config)
            scheduler.start()
            
            // Keep the process alive
            process.on('SIGINT', () => {
                log('main', 'MAIN', 'Received SIGINT, stopping scheduler...', 'warn')
                scheduler.stop()
                process.exit(0)
            })
            
            return // Don't run immediately in scheduler mode
        }
        
        // Normal immediate execution
        await rewardsBot.run()
    } catch (error) {
        log(false, 'MAIN-ERROR', `Error running desktop bot: ${error}`, 'error')
    }
}

// Start the bots
main().catch(error => {
    log('main', 'MAIN-ERROR', `Error running bots: ${error}`, 'error')
    process.exit(1)
})