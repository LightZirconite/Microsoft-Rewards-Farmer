import { Page } from 'rebrowser-playwright'
import readline from 'readline'
import * as crypto from 'crypto'
import { AxiosRequestConfig } from 'axios'

import { MicrosoftRewardsBot } from '../index'
import { saveSessionData } from '../util/Load'

import { OAuth } from '../interface/OAuth'


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

export class Login {
    private bot: MicrosoftRewardsBot
    private clientId: string = '0000000040170455'
    private authBaseUrl: string = 'https://login.live.com/oauth20_authorize.srf'
    private redirectUrl: string = 'https://login.live.com/oauth20_desktop.srf'
    private tokenUrl: string = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
    private scope: string = 'service::prod.rewardsplatform.microsoft.com::MBI_SSL'

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    async login(page: Page, email: string, password: string) {

        try {
            this.bot.log(this.bot.isMobile, 'LOGIN', 'Starting login process!')

            // Navigate to the Bing login page
            await page.goto('https://rewards.bing.com/signin')

            await page.waitForLoadState('domcontentloaded').catch(() => { })

            await this.bot.browser.utils.reloadBadPage(page)

            // Check if account is locked
            await this.checkAccountLocked(page)

            const isLoggedIn = await page.waitForSelector('html[data-role-name="RewardsPortal"]', { timeout: 10000 }).then(() => true).catch(() => false)

            if (!isLoggedIn) {
                await this.execLogin(page, email, password)
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Logged into Microsoft successfully')
            } else {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Already logged in')

                // Check if account is locked
                await this.checkAccountLocked(page)
            }

            // Check if logged in to bing
            await this.checkBingLogin(page)

            // Save session
            await saveSessionData(this.bot.config.sessionPath, page.context(), email, this.bot.isMobile)

            // We're done logging in
            this.bot.log(this.bot.isMobile, 'LOGIN', 'Logged in successfully, saved login session!')

        } catch (error) {
            // Throw and don't continue
            throw this.bot.log(this.bot.isMobile, 'LOGIN', 'An error occurred:' + error, 'error')
        }
    }

    private async execLogin(page: Page, email: string, password: string) {
        try {
            await this.enterEmail(page, email)
            await this.bot.utils.wait(2000)
            await this.bot.browser.utils.reloadBadPage(page)
            await this.bot.utils.wait(2000)
            await this.enterPassword(page, password)
            await this.bot.utils.wait(2000)

            // Check if account is locked
            await this.checkAccountLocked(page)

            await this.bot.browser.utils.reloadBadPage(page)
            await this.checkLoggedIn(page)
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'LOGIN', 'An error occurred: ' + error, 'error')
        }
    }

    private async enterEmail(page: Page, email: string) {
        const emailInputSelector = 'input[type="email"]'

        try {
            // Wait for email field
            const emailField = await page.waitForSelector(emailInputSelector, { state: 'visible', timeout: 2000 }).catch(() => null)
            if (!emailField) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Email field not found', 'warn')
                return
            }

            await this.bot.utils.wait(1000)

            // Check if email is prefilled
            const emailPrefilled = await page.waitForSelector('#userDisplayName', { timeout: 5000 }).catch(() => null)
            if (emailPrefilled) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Email already prefilled by Microsoft')
            } else {
                // Else clear and fill email
                await page.fill(emailInputSelector, '')
                await this.bot.utils.wait(500)
                await page.fill(emailInputSelector, email)
                await this.bot.utils.wait(1000)
            }

            const nextButton = await page.waitForSelector('button[type="submit"]', { timeout: 2000 }).catch(() => null)
            if (nextButton) {
                await nextButton.click()
                await this.bot.utils.wait(2000)
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Email entered successfully')
            } else {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Next button not found after email entry', 'warn')
            }

        } catch (error) {
            this.bot.log(this.bot.isMobile, 'LOGIN', `Email entry failed: ${error}`, 'error')
        }
    }

    private async enterPassword(page: Page, password: string) {
        const passwordInputSelector = 'input[type="password"]'
        try {
            // Check for Microsoft's new verification code flow first
            const verificationScreen = await page.waitForSelector('#proofConfirmationText, div[data-testid="proofConfirmationTitle"], .verificationTitle, [data-testid="viewFooter"]', { 
                state: 'visible', 
                timeout: 3000 
            }).catch(() => null)

            if (verificationScreen) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Detected verification code screen')
                
                // Look for "Use your password" option or other ways to sign in
                const usePasswordSelectors = [
                    'a[data-testid="usePasswordLink"]',
                    'a[id*="usePassword"]', 
                    'a[href*="password"]',
                    'button[data-testid="usePasswordButton"]',
                    '#usePasswordLink',
                    '[data-value="usePassword"]',
                    'span[role="button"]' // For "Other ways to sign in"
                ]
                
                let usePasswordElement = null
                for (const selector of usePasswordSelectors) {
                    usePasswordElement = await page.waitForSelector(selector, { 
                        state: 'visible', 
                        timeout: 2000 
                    }).catch(() => null)
                    if (usePasswordElement) break
                }

                if (usePasswordElement) {
                    this.bot.log(this.bot.isMobile, 'LOGIN', 'Found "Use your password" or "Other ways" option, clicking it')
                    await usePasswordElement.click()
                    await this.bot.utils.wait(3000)
                    
                    // If we clicked "Other ways", look for password option in the list
                    const passwordOption = await page.waitForSelector('[role="listitem"]', { 
                        state: 'visible', 
                        timeout: 3000 
                    }).catch(() => null)
                    
                    if (passwordOption) {
                        // Try to find the password option (usually second item)
                        const secondListItem = page.locator('[role="listitem"]').nth(1)
                        if (await secondListItem.isVisible()) {
                            this.bot.log(this.bot.isMobile, 'LOGIN', 'Selecting password option from list')
                            await secondListItem.click()
                            await this.bot.utils.wait(2000)
                        }
                    }
                } else {
                    this.bot.log(this.bot.isMobile, 'LOGIN', 'Could not find "Use your password" option, trying standard flow', 'warn')
                }
            }

            const viewFooter = await page.waitForSelector('[data-testid="viewFooter"]', { timeout: 2000 }).catch(() => null)
            if (viewFooter) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Page "Get a code to sign in" found by "viewFooter"')

                const otherWaysButton = await viewFooter.$('span[role="button"]')
                if (otherWaysButton) {
                    await otherWaysButton.click()
                    await this.bot.utils.wait(5000)

                    const secondListItem = page.locator('[role="listitem"]').nth(1)
                    if (await secondListItem.isVisible()) {
                        await secondListItem.click()
                    }

                }
            }

            // Wait for password field
            const passwordField = await page.waitForSelector(passwordInputSelector, { state: 'visible', timeout: 5000 }).catch(() => null)
            if (!passwordField) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Password field not found, possibly 2FA required', 'warn')
                await this.handle2FA(page)
                return
            }

            await this.bot.utils.wait(1000)

            // Clear and fill password
            await page.fill(passwordInputSelector, '')
            await this.bot.utils.wait(500)
            await page.fill(passwordInputSelector, password)
            await this.bot.utils.wait(1000)

            const nextButton = await page.waitForSelector('button[type="submit"]', { timeout: 2000 }).catch(() => null)
            if (nextButton) {
                await nextButton.click()
                await this.bot.utils.wait(2000)
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Password entered successfully')
            } else {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Next button not found after password entry', 'warn')
            }

        } catch (error) {
            this.bot.log(this.bot.isMobile, 'LOGIN', `Password entry failed: ${error}`, 'error')
            await this.handle2FA(page)
        }
    }

    private async handle2FA(page: Page) {
        try {
            const numberToPress = await this.get2FACode(page)
            if (numberToPress) {
                // Authentictor App verification
                await this.authAppVerification(page, numberToPress)
            } else {
                // SMS verification
                await this.authSMSVerification(page)
            }
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'LOGIN', `2FA handling failed: ${error}`)
        }
    }

    private async get2FACode(page: Page): Promise<string | null> {
        try {
            const element = await page.waitForSelector('#displaySign, div[data-testid="displaySign"]>span', { state: 'visible', timeout: 2000 })
            return await element.textContent()
        } catch {
            if (this.bot.config.parallel) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Script running in parallel, can only send 1 2FA request per account at a time!', 'log', 'yellow')
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Trying again in 60 seconds! Please wait...', 'log', 'yellow')

                // eslint-disable-next-line no-constant-condition
                while (true) {
                    const button = await page.waitForSelector('button[aria-describedby="pushNotificationsTitle errorDescription"]', { state: 'visible', timeout: 2000 }).catch(() => null)
                    if (button) {
                        await this.bot.utils.wait(60000)
                        await button.click()

                        continue
                    } else {
                        break
                    }
                }
            }

            await page.click('button[aria-describedby="confirmSendTitle"]').catch(() => { })
            await this.bot.utils.wait(2000)
            const element = await page.waitForSelector('#displaySign, div[data-testid="displaySign"]>span', { state: 'visible', timeout: 2000 })
            return await element.textContent()
        }
    }

    private async authAppVerification(page: Page, numberToPress: string | null) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                this.bot.log(this.bot.isMobile, 'LOGIN', `Press the number ${numberToPress} on your Authenticator app to approve the login`)
                this.bot.log(this.bot.isMobile, 'LOGIN', 'If you press the wrong number or the "DENY" button, try again in 60 seconds')

                await page.waitForSelector('form[name="f1"]', { state: 'detached', timeout: 60000 })

                this.bot.log(this.bot.isMobile, 'LOGIN', 'Login successfully approved!')
                break
            } catch {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'The code is expired. Trying to get a new code...')
                await page.click('button[aria-describedby="pushNotificationsTitle errorDescription"]')
                numberToPress = await this.get2FACode(page)
            }
        }
    }

    private async authSMSVerification(page: Page) {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'SMS 2FA code required. Waiting for user input...')

        const code = await new Promise<string>((resolve) => {
            rl.question('Enter 2FA code:\n', (input) => {
                rl.close()
                resolve(input)
            })
        })

        await page.fill('input[name="otc"]', code)
        await page.keyboard.press('Enter')
        this.bot.log(this.bot.isMobile, 'LOGIN', '2FA code entered successfully')
    }

    async getMobileAccessToken(page: Page, email: string) {
        const authorizeUrl = new URL(this.authBaseUrl)

        authorizeUrl.searchParams.append('response_type', 'code')
        authorizeUrl.searchParams.append('client_id', this.clientId)
        authorizeUrl.searchParams.append('redirect_uri', this.redirectUrl)
        authorizeUrl.searchParams.append('scope', this.scope)
        authorizeUrl.searchParams.append('state', crypto.randomBytes(16).toString('hex'))
        authorizeUrl.searchParams.append('access_type', 'offline_access')
        authorizeUrl.searchParams.append('login_hint', email)

        await page.goto(authorizeUrl.href)

        let currentUrl = new URL(page.url())
        let code: string

        this.bot.log(this.bot.isMobile, 'LOGIN-APP', 'Waiting for authorization...')
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (currentUrl.hostname === 'login.live.com' && currentUrl.pathname === '/oauth20_desktop.srf') {
                code = currentUrl.searchParams.get('code')!
                break
            }

            currentUrl = new URL(page.url())
            await this.bot.utils.wait(5000)
        }

        const body = new URLSearchParams()
        body.append('grant_type', 'authorization_code')
        body.append('client_id', this.clientId)
        body.append('code', code)
        body.append('redirect_uri', this.redirectUrl)

        const tokenRequest: AxiosRequestConfig = {
            url: this.tokenUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: body.toString()
        }

        const tokenResponse = await this.bot.axios.request(tokenRequest)
        const tokenData: OAuth = await tokenResponse.data

        this.bot.log(this.bot.isMobile, 'LOGIN-APP', 'Successfully authorized')
        return tokenData.access_token
    }

    // Utils

    private async checkLoggedIn(page: Page) {
        const targetHostname = 'rewards.bing.com'
        const targetPathname = '/'

        // eslint-disable-next-line no-constant-condition
        while (true) {
            await this.dismissLoginMessages(page)
            const currentURL = new URL(page.url())
            if (currentURL.hostname === targetHostname && currentURL.pathname === targetPathname) {
                break
            }
        }

        // Wait for login to complete
        await page.waitForSelector('html[data-role-name="RewardsPortal"]', { timeout: 10000 })
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Successfully logged into the rewards portal')
    }

    private async dismissLoginMessages(page: Page) {
        // Use Passekey
        if (await page.waitForSelector('[data-testid="biometricVideo"]', { timeout: 2000 }).catch(() => null)) {
            const skipButton = await page.$('[data-testid="secondaryButton"]')
            if (skipButton) {
                await skipButton.click()
                this.bot.log(this.bot.isMobile, 'DISMISS-ALL-LOGIN-MESSAGES', 'Dismissed "Use Passekey" modal')
                await page.waitForTimeout(500)
            }
        }

        // Use Keep me signed in
        if (await page.waitForSelector('[data-testid="kmsiVideo"]', { timeout: 2000 }).catch(() => null)) {
            const yesButton = await page.$('[data-testid="primaryButton"]')
            if (yesButton) {
                await yesButton.click()
                this.bot.log(this.bot.isMobile, 'DISMISS-ALL-LOGIN-MESSAGES', 'Dismissed "Keep me signed in" modal')
                await page.waitForTimeout(500)
            }
        }

    }

    private async checkBingLogin(page: Page): Promise<void> {
        try {
            this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'Verifying Bing login')
            await page.goto('https://www.bing.com/fd/auth/signin?action=interactive&provider=windows_live_id&return_url=https%3A%2F%2Fwww.bing.com%2F')

            const maxIterations = 5

            for (let iteration = 1; iteration <= maxIterations; iteration++) {
                const currentUrl = new URL(page.url())

                if (currentUrl.hostname === 'www.bing.com' && currentUrl.pathname === '/') {
                    await this.bot.browser.utils.tryDismissAllMessages(page)

                    const loggedIn = await this.checkBingLoginStatus(page)
                    // If mobile browser, skip this step
                    if (loggedIn || this.bot.isMobile) {
                        this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'Bing login verification passed!')
                        break
                    }
                }

                await this.bot.utils.wait(1000)
            }

        } catch (error) {
            this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'An error occurred:' + error, 'error')
        }
    }

    private async checkBingLoginStatus(page: Page): Promise<boolean> {
        try {
            await page.waitForSelector('#id_n', { timeout: 5000 })
            return true
        } catch (error) {
            return false
        }
    }

    private async checkAccountLocked(page: Page) {
        await this.bot.utils.wait(2000)
        const isLocked = await page.waitForSelector('#serviceAbuseLandingTitle', { state: 'visible', timeout: 1000 }).then(() => true).catch(() => false)
        if (isLocked) {
            throw this.bot.log(this.bot.isMobile, 'CHECK-LOCKED', 'This account has been locked! Remove the account from "accounts.json" and restart!', 'error')
        }
    }
}