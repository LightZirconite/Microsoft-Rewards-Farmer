# Microsoft Rewards Automation Script

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Maintenance](https://img.shields.io/badge/maintained-yes-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)
![Node](https://img.shields.io/badge/Node-14+-green.svg)
[![Website](https://img.shields.io/badge/website-git.justw.tf-blue.svg)](https://git.justw.tf/Light-Zirconite/Microsoft-Rewards-Farmer)

A powerful, feature-rich automation tool for Microsoft Rewards built with TypeScript, Cheerio, and Playwright. This script automates earning points by completing searches, quizzes, polls, and other activities.

**Project Website:** [https://git.justw.tf/Light-Zirconite/Microsoft-Rewards-Farmer](https://git.justw.tf)

## Overview

This project aims to simplify the process of earning Microsoft Rewards points through automated task completion. The script handles various activities including desktop and mobile searches, daily tasks, promotions, polls, and quizzes.

## Key Features

- **Multi-Account Support**: Run multiple Microsoft accounts either sequentially or in parallel
- **Authentication Support**: Works with standard login, 2FA, and passwordless authentication
- **Search Automation**: Completes desktop and mobile search requirements
- **Comprehensive Activity Completion**:
  - Daily set tasks
  - Promotional activities
  - Various quiz types (Multiple choice, This-or-That, ABC)
  - Polls and one-click rewards
  - Punchcards
  - Daily check-in and Read-to-Earn activities
- **Advanced Browsing Simulation**:
  - Realistic scrolling behavior
  - Random result clicking
  - Configurable delays between actions
- **Robust Infrastructure**:
  - Session persistence between runs
  - Docker support with scheduling
  - Proxy configuration options
  - Discord webhook integration
  - Clustering for efficient account handling

## Getting Started

### Prerequisites

- Node.js 14+ and npm
- Docker (optional, for container deployment)
- Microsoft Rewards account(s)

### Installation

1. Clone or download the repository
2. Install dependencies:
```bash
npm install
```

3. Set up your accounts:
```bash
cp accounts.example.json accounts.json
```
Then edit the `accounts.json` file with your Microsoft account details.

4. Build the project:
```bash
npm run build
```

### Usage

Run the script with:
```bash
npm run start
```

### Docker Setup

For containerized deployment:

1. Prepare your environment:
   - If you've run the script locally before, remove the `/node_modules` and `/dist` folders
   - For upgrades from previous Docker versions, remove persistent `config.json` and session folders

2. Configure Docker:
   - Set your timezone in the `TZ` environment variable
   - Configure storage mappings for config and session data
   - Set your desired schedule with `CRON_SCHEDULE`
   - Use `RUN_ON_START=true` to execute immediately upon container start

3. Launch the container:
```bash
docker compose up -d
```

4. View logs:
```bash
docker logs microsoft-rewards-script
```

## Configuration

The `config.json` file allows customization of various script behaviors:

| Setting                          | Description                                       |
| :------------------------------- | :------------------------------------------------ |
| `headless`                       | Run browsers invisibly (true/false)               |
| `parallel`                       | Run mobile/desktop tasks simultaneously           |
| `clusters`                       | Number of simultaneous browser instances          |
| `searchSettings.searchDelay`     | Delay between searches                            |
| `searchSettings.clickRandomResults` | Visit random websites from search results      |
| `webhook.enabled`                | Enable Discord notifications                      |

See the full configuration documentation in the source files.

## Troubleshooting

- **Lingering Browser Instances**: If you end the script without closing browser windows:
  - Windows: Run `npm run kill-chrome-win`
  - Linux/Mac: Use `pkill -f "chrome"`

- **Login Issues**: If experiencing authentication problems:
  - Delete session data
  - Verify account credentials
  - Check for security verification requirements

## Best Practices

- Run 1-2 times daily for optimal results
- For troubleshooting, set `headless: false` to observe the automation
- Avoid running too many accounts from a single IP
- Maintain default search delays to mimic human behavior

## Warning

**USE AT YOUR OWN RISK**: This script is provided for educational purposes only. Using automation tools violates Microsoft Rewards' terms of service and may result in account penalties. The developers accept no responsibility for any consequences resulting from the use of this script.

---

This project is not affiliated with Microsoft or Microsoft Rewards.
