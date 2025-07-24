export interface AccountResult {
    email: string;
    pointsBefore: number;
    pointsAfter: number;
    pointsGained: number;
    tasksCompleted: number;
    executionDuration: number; // in seconds
    success: boolean;
    errorMessage?: string;
}

export interface FinalSummary {
    totalAccounts: number;
    successfulAccounts: number;
    failedAccounts: number;
    totalPointsGained: number;
    retryPassesUsed: number;
    totalExecutionTime: number; // in seconds
    startTime: Date;
    endTime: Date;
    accountResults: AccountResult[];
}
