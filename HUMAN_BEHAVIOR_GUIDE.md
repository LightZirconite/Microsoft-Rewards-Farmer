# Human Behavior System - Anti-Detection Enhancement

The Human Behavior System adds realistic human-like patterns to Microsoft Rewards automation to reduce detection risk while maintaining reliability and NOT breaking existing functionality.

## 🛡️ Safety Principles

- **100% Backward Compatible**: All existing code continues to work exactly as before
- **Opt-in Enhancement**: Human behavior is disabled by default
- **Graceful Fallbacks**: If human behavior fails, original behavior is used
- **Performance Conscious**: Minimal overhead when disabled
- **Non-Breaking**: Never interferes with critical functions

## 🚀 Quick Start

### Enable Human Behavior
```bash
# Enable with moderate settings (recommended)
npm run scheduler human-enable

# Check status
npm run scheduler status
```

### Configure Features
```bash
# Enable specific features
npm run scheduler human-config variableTiming true
npm run scheduler human-config readingSimulation true
npm run scheduler human-config taskTransitions true

# Disable risky features (for conservative approach)
npm run scheduler human-config mouseMovement false
npm run scheduler human-config typingPatterns false
```

## 🎛️ Configuration Options

### Intensity Levels
- **minimal**: Slight timing variations only
- **moderate**: Balanced realism vs speed (recommended)
- **high**: Maximum human-like behavior (slower but most realistic)

### Profiles
- **conservative**: Minimal changes, maximum safety
- **balanced**: Good mix of realism and reliability (recommended)
- **aggressive**: Maximum anti-detection, accept some risk

### Features

#### ✅ **variableTiming** (Safe, Recommended)
- Adds natural timing variations
- Replaces fixed delays with context-aware pauses
- **Impact**: Minimal performance impact, good detection reduction

#### ⚠️ **mouseMovement** (Moderate Risk)
- Simulates realistic mouse movements before clicks
- Adds slight overshooting and correction
- **Impact**: Small performance hit, moderate detection reduction

#### ⚠️ **typingPatterns** (Moderate Risk)
- Human-like typing speeds and occasional typos
- Variable delays between keystrokes
- **Impact**: Noticeable performance impact in search typing

#### ✅ **readingSimulation** (Safe, Recommended)
- Pauses to "read" content based on text length
- Simulates scanning vs deep reading
- **Impact**: Increases execution time proportionally to content

#### ✅ **taskTransitions** (Safe, Recommended)
- Natural pauses between different task types
- Context-aware thinking time
- **Impact**: Small time increase, good realism

#### ⚠️ **fatigueSimulation** (Advanced)
- Gradually slows down over long sessions
- Simulates human attention span
- **Impact**: Increases time for long sessions

#### ⚠️ **randomScrolling** (Low Risk)
- Occasional scrolling on pages
- Natural browsing simulation
- **Impact**: Minimal performance impact

## 📊 Recommended Configurations

### 🔰 **Beginner (Conservative)**
```json
{
  "enabled": true,
  "intensity": "minimal",
  "profile": "conservative",
  "features": {
    "variableTiming": true,
    "mouseMovement": false,
    "typingPatterns": false,
    "readingSimulation": true,
    "taskTransitions": true,
    "fatigueSimulation": false,
    "randomScrolling": false
  }
}
```

### ⚖️ **Balanced (Recommended)**
```json
{
  "enabled": true,
  "intensity": "moderate", 
  "profile": "balanced",
  "features": {
    "variableTiming": true,
    "mouseMovement": false,
    "typingPatterns": false,
    "readingSimulation": true,
    "taskTransitions": true,
    "fatigueSimulation": false,
    "randomScrolling": true
  }
}
```

### 🎯 **Advanced (Maximum Realism)**
```json
{
  "enabled": true,
  "intensity": "high",
  "profile": "aggressive", 
  "features": {
    "variableTiming": true,
    "mouseMovement": true,
    "typingPatterns": true,
    "readingSimulation": true,
    "taskTransitions": true,
    "fatigueSimulation": true,
    "randomScrolling": true
  }
}
```

## 🔧 Technical Implementation

### Core Components

#### HumanBehavior Class (`src/util/HumanBehavior.ts`)
- Central coordinator for all human-like behaviors
- Context-aware timing calculations
- Safe fallbacks for all operations

#### Enhanced Utils (`src/util/Utils.ts`)
- Backward-compatible extensions
- `humanizedWait()` method for variable delays
- Original `wait()` method preserved unchanged

#### Search Enhancements (`src/functions/activities/Search.ts`)
- Safe enhancements to most detection-prone area
- Optional human typing and mouse movement
- Reading simulation for search results

### Integration Points

#### Main Bot Class
```typescript
// HumanBehavior is automatically initialized
this.humanBehavior = new HumanBehavior(this, this.config.humanBehavior?.enabled ?? false)

// Used throughout codebase like:
if (this.bot.humanBehavior && this.bot.config.humanBehavior?.features.variableTiming) {
    await this.bot.humanBehavior.humanWait(1000, 3000, 'thinking')
} else {
    await this.bot.utils.wait(2000) // Original behavior preserved
}
```

## 📈 Performance Impact

### Time Increases (Approximate)
- **Minimal**: +5-10% execution time
- **Moderate**: +15-25% execution time  
- **High**: +30-50% execution time

### Detection Risk Reduction
- **variableTiming**: High impact, eliminates robotic timing
- **readingSimulation**: Moderate impact, natural content interaction
- **taskTransitions**: Moderate impact, human-like workflow
- **mouseMovement**: High impact but risky, realistic clicking
- **typingPatterns**: Very high impact but slow, authentic typing

## 🛠️ Management Commands

```bash
# Enable/disable
npm run scheduler human-enable
npm run scheduler human-disable

# Configure individual features
npm run scheduler human-config variableTiming true
npm run scheduler human-config mouseMovement false
npm run scheduler human-config readingSimulation true

# Check status
npm run scheduler status
```

## ⚠️ Important Notes

### What's NOT Changed
- ✅ All existing `await this.bot.utils.wait()` calls work exactly as before
- ✅ No breaking changes to any existing functionality
- ✅ Performance when disabled is identical to original
- ✅ All critical functions (login, point tracking, etc.) unchanged

### What's Enhanced
- ⭐ Search behavior becomes more human-like
- ⭐ Timing patterns lose robotic precision
- ⭐ Content interaction appears natural
- ⭐ Task switching includes thinking time

### Best Practices
1. **Start Conservative**: Begin with minimal settings and gradually increase
2. **Monitor Performance**: Track execution times and adjust accordingly
3. **Test Thoroughly**: Verify all features work in your environment
4. **Account Specific**: Consider different settings for different account risk levels
5. **Update Gradually**: Don't enable all features at once

## 🔍 Troubleshooting

### Human Behavior Not Working
```bash
# Check if enabled
npm run scheduler status

# Enable if needed
npm run scheduler human-enable

# Verify specific features
npm run scheduler human-config variableTiming true
```

### Performance Too Slow
```bash
# Reduce intensity
# Edit config.json: "intensity": "minimal"

# Disable heavy features
npm run scheduler human-config typingPatterns false
npm run scheduler human-config fatigueSimulation false
```

### Unexpected Behavior
```bash
# Disable and test
npm run scheduler human-disable

# Re-enable gradually
npm run scheduler human-enable
npm run scheduler human-config variableTiming true
# Test each feature individually
```

## 🎯 Detection Vectors Addressed

1. **Fixed Timing Patterns** ✅ Eliminated with variableTiming
2. **Robotic Click Patterns** ✅ Reduced with mouseMovement  
3. **Instant Text Entry** ✅ Humanized with typingPatterns
4. **No Reading Time** ✅ Fixed with readingSimulation
5. **Mechanical Task Flow** ✅ Natural with taskTransitions
6. **Unlimited Attention Span** ✅ Realistic with fatigueSimulation

Remember: **The best anti-detection is gradual, consistent, and realistic behavior that matches human patterns without breaking the core functionality.**
