# 🕐 Daily Scheduler System

This project now includes a **fully self-contained daily scheduler** that automatically runs the Microsoft Rewards script at a configured time each day, without requiring external dependencies like cron or Task Scheduler.

## ✨ Features

- **🔧 Self-Contained**: No external dependencies (no cron, Task Scheduler, or Docker required)
- **⚙️ Easy Configuration**: Simple JSON configuration in `config.json`
- **🎯 Precise Timing**: Run daily at your specified time with timezone support
- **🎲 Randomization**: Configurable random delay to avoid detection patterns
- **🔄 Retry Logic**: Automatic retries on failure with configurable limits
- **💾 Persistent State**: Remembers last run status across restarts
- **🛡️ Overlap Prevention**: Prevents multiple instances from running simultaneously
- **🖥️ Cross-Platform**: Works on Windows, macOS, and Linux
- **📊 Status Monitoring**: Easy status checking and management

## 🚀 Quick Setup

### 1. Enable the Scheduler

```bash
# Development mode (TypeScript)
npm run scheduler enable 06:00 UTC

# Production mode (after building)
npm run build
npm run scheduler:built enable 06:00 UTC

# Other timezone examples
npm run scheduler enable 14:30 America/New_York
npm run scheduler enable 09:00 Europe/London
```

### 2. Build and Start

```bash
npm run build
npm run start:scheduler
```

**That's it!** The scheduler will now run your Microsoft Rewards automation daily at the configured time.

## 📋 Configuration

The scheduler adds the following to your `config.json`:

```json
{
  "scheduler": {
    "enabled": true,
    "dailyRunTime": "06:00",
    "timezone": "UTC",
    "randomDelayMinutes": {
      "min": 5,
      "max": 50
    },
    "retryOnFailure": {
      "enabled": true,
      "maxRetries": 3,
      "retryDelayMinutes": 30
    }
  }
}
```

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `enabled` | Enable/disable the scheduler | `false` |
| `dailyRunTime` | Daily execution time (HH:MM format) | `"06:00"` |
| `timezone` | Timezone for scheduling | `"UTC"` |
| `randomDelayMinutes.min` | Minimum random delay in minutes | `5` |
| `randomDelayMinutes.max` | Maximum random delay in minutes | `50` |
| `retryOnFailure.enabled` | Enable retry on failure | `true` |
| `retryOnFailure.maxRetries` | Maximum retry attempts per day | `3` |
| `retryOnFailure.retryDelayMinutes` | Delay between retries in minutes | `30` |

## 🛠️ Management Commands

### Status Check
```bash
# Development mode
npm run scheduler status

# Production mode (after building)
npm run scheduler:built status
```

### Enable/Disable
```bash
# Enable with custom time (development)
npm run scheduler enable 07:30 UTC

# Disable scheduler (development)
npm run scheduler disable

# Production equivalents (after npm run build)
npm run scheduler:built enable 07:30 UTC
npm run scheduler:built disable
```

### Configure Random Delay
```bash
# Set random delay between 10-60 minutes (development)
npm run scheduler delay 10 60

# Production (after building)
npm run scheduler:built delay 10 60
```

### Configure Retry Settings
```bash
# Enable retries: max 5 attempts, 45 minutes between retries (development)
npm run scheduler retry true 5 45

# Disable retries (development)
npm run scheduler retry false 0 0

# Production equivalents
npm run scheduler:built retry true 5 45
npm run scheduler:built retry false 0 0
```

## 🏃‍♂️ Running Modes

### Scheduler Mode (Persistent)
```bash
# Production (after building)
npm run start:scheduler

# Development (TypeScript)
npm run ts-start:scheduler
```

### Immediate Mode (One-time run)
```bash
# Production
npm run start

# Development  
npm run ts-start
```

### Status Check
```bash
npm run scheduler:status
```

## 📊 Monitoring

### Check Status
```bash
npm run scheduler status
```

**Example Output:**
```
📋 Microsoft Rewards Scheduler Status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Configuration:
   Enabled: ✅ Yes
   Daily Run Time: 06:00
   Timezone: UTC
   Random Delay: 5-50 minutes
   Retry on Failure: ✅ Yes
   Max Retries: 3
   Retry Delay: 30 minutes

⚡ Runtime Status:
   Last Run Date: 2025-01-23
   Currently Running: 🔴 No
   Consecutive Failures: 0
   Next Scheduled Run: 1/24/2025, 6:23:45 AM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### State File
The scheduler maintains state in `scheduler-state.json`:
- Last successful run date
- Next scheduled run time
- Failure count and retry information
- Current running status

## 🔧 Advanced Usage

### Running as a Service

#### Windows (using PM2)
```bash
npm install -g pm2
npm run build
pm2 start "npm run start:scheduler" --name "ms-rewards-scheduler"
pm2 save
pm2 startup
```

#### Linux/macOS (using systemd or PM2)
```bash
# Using PM2 (cross-platform)
npm install -g pm2
npm run build
pm2 start "npm run start:scheduler" --name "ms-rewards-scheduler"
pm2 save
pm2 startup

# Or create a systemd service (Linux)
# See systemd documentation for service file creation
```

### Environment Variables
You can override config settings with environment variables:
```bash
# Enable scheduler via environment
SCHEDULER_ENABLED=true npm run start:scheduler

# Set run time via environment  
SCHEDULER_TIME=07:00 npm run start:scheduler
```

## 🐛 Troubleshooting

### Common Issues

**Q: Scheduler doesn't start**
- Check if `scheduler.enabled` is `true` in config.json
- Verify time format is HH:MM (e.g., 06:00, not 6:00)
- Check for syntax errors in config.json

**Q: Script runs multiple times**
- The scheduler includes overlap prevention
- Check `scheduler-state.json` for status
- Ensure only one instance is running

**Q: Missed scheduled time**
- Scheduler will catch up and run immediately if missed
- Check system time and timezone settings
- Review logs for any errors

**Q: Retries not working**
- Verify `retryOnFailure.enabled` is `true`
- Check `maxRetries` hasn't been exceeded
- Review `retryDelayMinutes` setting

### Debug Mode
```bash
# Run with detailed logging
DEBUG=scheduler npm run start:scheduler
```

### Reset State
```bash
# Remove state file to reset scheduler
rm scheduler-state.json
# or on Windows:
del scheduler-state.json
```

## 📚 Integration Examples

### Auto-enable Scheduler on First Run
Add to your setup script:
```bash
#!/bin/bash
npm run build
node scheduler-manager.js enable 06:00 UTC
npm run start:scheduler
```

### Custom Notification on Success/Failure
The scheduler integrates with the existing webhook system in `config.json`:
```json
{
  "webhook": {
    "enabled": true,
    "url": "https://your-webhook-url.com"
  }
}
```

### Multiple Accounts with Different Schedules
Run separate scheduler instances with different config files:
```bash
# Copy config for different schedules
cp src/config.json src/config-morning.json
cp src/config.json src/config-evening.json

# Edit times and start separate instances
# (Implementation would require minor modifications)
```

## 🔒 Security & Best Practices

1. **Randomization**: Always use random delays to avoid detection
2. **Retry Limits**: Set reasonable retry limits to avoid spam
3. **Monitoring**: Regularly check scheduler status
4. **Logs**: Monitor logs for errors or patterns
5. **Updates**: Keep the script updated for reliability

The scheduler system is designed to be reliable, efficient, and undetectable while providing maximum flexibility for your automation needs.
