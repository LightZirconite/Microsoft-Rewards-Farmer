export interface Config {
    baseURL: string;
    sessionPath: string;
    headless: boolean;
    parallel: boolean;
    runOnZeroPoints: boolean;
    clusters: number;
    saveFingerprint: ConfigSaveFingerprint;
    workers: ConfigWorkers;
    searchOnBingLocalQueries: boolean;
    globalTimeout: number | string;
    searchSettings: ConfigSearchSettings;
    logExcludeFunc: string[];
    webhookLogExcludeFunc: string[];
    proxy: ConfigProxy;
    webhook: ConfigWebhook;
    finalWebhook: ConfigWebhook;
    scheduler: ConfigScheduler;
    dailyRetries: number;
    retryDelayMinutes: number;
    humanBehavior?: ConfigHumanBehavior;
}

export interface ConfigScheduler {
    enabled: boolean;
    dailyRunTime: string;
    timezone: string;
    randomDelayMinutes: {
        min: number;
        max: number;
    };
    retryOnFailure: {
        enabled: boolean;
        maxRetries: number;
        retryDelayMinutes: number;
    };
}

export interface ConfigSaveFingerprint {
    mobile: boolean;
    desktop: boolean;
}

export interface ConfigSearchSettings {
    useGeoLocaleQueries: boolean;
    scrollRandomResults: boolean;
    clickRandomResults: boolean;
    searchDelay: ConfigSearchDelay;
    retryMobileSearchAmount: number;
}

export interface ConfigSearchDelay {
    min: number | string;
    max: number | string;
}

export interface ConfigWebhook {
    enabled: boolean;
    url: string;
}

export interface ConfigProxy {
    proxyGoogleTrends: boolean;
    proxyBingTerms: boolean;
}

export interface ConfigWorkers {
    doDailySet: boolean;
    doMorePromotions: boolean;
    doPunchCards: boolean;
    doDesktopSearch: boolean;
    doMobileSearch: boolean;
    doDailyCheckIn: boolean;
    doReadToEarn: boolean;
}

export interface ConfigHumanBehavior {
    enabled: boolean;
    intensity: 'minimal' | 'moderate' | 'high';  // How human-like to be
    profile: 'conservative' | 'balanced' | 'aggressive';  // Risk vs realism
    features: {
        variableTiming: boolean;        // Use human-like timing variations
        mouseMovement: boolean;         // Simulate mouse movements
        typingPatterns: boolean;        // Human typing with occasional typos
        readingSimulation: boolean;     // Pause to "read" content
        taskTransitions: boolean;       // Natural pauses between tasks
        fatigueSimulation: boolean;     // Slow down over time
        randomScrolling: boolean;       // Occasional scrolling behavior
    };
}
