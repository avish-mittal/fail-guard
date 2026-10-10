<div align="center">

# 🛡️ fail-guard

**Zero-dependency crash protection for beginner Node.js developers and bots.**

Replace the terrifying 60-line red stack trace with clean, actionable terminal cards and keep your server or bot alive during development.

[![npm version](https://img.shields.io/badge/npm-v1.0.0-cb3837.svg?style=flat-square)](https://www.npmjs.com/package/fail-guard)
[![dependencies](https://img.shields.io/badge/dependencies-0-success.svg?style=flat-square)](#)
[![node](https://img.shields.io/badge/node-%3E%3D14.0.0-blue.svg?style=flat-square)](https://nodejs.org)
[![license](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![tests](https://img.shields.io/badge/tests-10%2F10%20passing-brightgreen.svg?style=flat-square)](#)

</div>

---

## ⚡ The Problem

When you are learning Node.js or building your first Discord bot, Express backend, or script, a single typo like `user.profile.name` throws:

```
TypeError: Cannot read properties of undefined (reading 'profile')
    at Timeout._onTimeout (C:\projects\my-bot\bot.js:24:28)
    at listOnTimeout (node:internal/timers:581:17)
    at process.processTimers (node:internal/timers:519:7)
    at node:internal/modules/cjs/loader:1546:14
    at ... 45 more lines of node:internal code ...
```

1. **The app abruptly crashes and terminates**, forcing you to restart your bot or server.
2. **The intimidating 60-line red stack trace** obscures where your actual code broke.
3. **Beginners don't know what to do next.**

---

## ✨ The Solution: `fail-guard`

Drop **one line** into the top of your project:

```javascript
require('fail-guard')();
```

Whenever an unhandled error or rejected promise occurs, `fail-guard`:
- 🛡️ **Keeps your event loop alive** so your server or Discord bot doesn't die.
- 📍 **Strips out all internal Node.js runtime noise** and highlights your exact file, line, and column.
- 📄 **Extracts source code snippets** right in the terminal with line numbers and a caret pointer (`^`).
- 💡 **Provides plain-English hints and auto-fix suggestions** for common beginner pitfalls (`undefined`, `ECONNREFUSED`, `EADDRINUSE`, `not a function`).
- 🪶 **Zero external dependencies** (no `chalk`, no `boxen`, no bloat — built with 100% native Node.js APIs and pure ANSI escape sequences).

---

## 📸 Terminal Card Preview

```
╭──  FAIL-GUARD • UNCAUGHT EXCEPTION ────────────────────────────────────────╮
│                                                                            │
│  ✖ TypeError: Cannot read properties of null (reading 'profile')          |
│                                                                            │
│  📍 Location:                                                              │
│     app.js:23:28 (in Timeout._onTimeout)                                   │
│                                                                            │
│  📄 Source Code:                                                           │
│       21 │   const user = null;                                            |
│       22 │   // This would normally crash your entire server/bot!          │
│     > 23 │   const profileName = user.profile.name;                        │
│          │                            ^                                    │
│       24 │ }, 1000);                                                       │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  💡 Hint: Accessing property on undefined or null                          │
│     You're trying to read a property from a variable that hasn't been      │
│     assigned or is null.                                                   │
│                                                                            │
│     • Check if the variable or object was initialized before reading from  │
│       it.                                                                  │
│     • If fetching from an API or database, ensure the data finished        │
│       loading first.                                                       │
│     • Use optional chaining (e.g., `user?.name` instead of `user.name`)    │
│       to prevent crashing.                                                 │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  🛡️  Process Guard: Active • App kept alive in dev mode (keepAlive: true)  │
│                                                                            │
╰────────────────────────────────────────────────────────────────────────────╯
```

---

## 📦 Installation

```bash
npm install fail-guard
```

---

## 🚀 Quick Start

### CommonJS (Node.js default)
At the very top of your entry file (e.g., `index.js`, `app.js`, `bot.js`):

```javascript
// One-line setup with sensible defaults
require('fail-guard')();

// Or with options:
const { init } = require('fail-guard');
init({
  keepAlive: true, // Keep app alive on unhandled errors (default: true in dev)
  showHint: true,  // Print beginner-friendly auto-fix suggestions
});
```

### ES Modules (ESM)
```javascript
import { init } from 'fail-guard';

init();
```

---

## ⚙️ Configuration Options

Pass an options object to `init(options)`:

```javascript
const { init } = require('fail-guard');

init({
  // Keep event loop alive instead of exiting (default: true in non-production)
  keepAlive: true,

  // Show beginner auto-fix hints (default: true)
  showHint: true,

  // Force process.exit(1) on fatal crashes (default: false)
  exitOnFatal: false,

  // Extract source code snippet around the error (default: true)
  showSnippet: true,

  // Number of source lines before and after to display (default: 2)
  snippetLines: 2,

  // Custom logger function (default: console.error)
  logger: console.error,

  // Callback hook invoked whenever a crash is intercepted
  onCrash: (error, meta) => {
    // meta contains: { type, origin, callSite, hint, keepAlive, card }
    console.log(`[Metric] Intercepted crash in ${meta.callSite?.fileName}`);
  },
});
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `keepAlive` | `boolean` | `true` in dev | Keeps the event loop running so the process does not terminate. Defaults to `process.env.NODE_ENV !== 'production'`. |
| `showHint` | `boolean` | `true` | Prints plain-English suggestions and auto-fix patterns for common beginner errors. |
| `exitOnFatal` | `boolean` | `false` | When `true`, prints the card and immediately exits with status code 1. |
| `showSnippet` | `boolean` | `true` | Reads the offending source file and prints surrounding lines with a highlighted pointer (`>`) and column caret (`^`). |
| `snippetLines` | `number` | `2` | Number of context lines before and after the offending line. |
| `enableColor` | `boolean` | auto | Force enable/disable ANSI colors. Automatically detects terminal TTY and `NO_COLOR`. |
| `logger` | `function` | `console.error` | Function used to output the formatted card string. |
| `onCrash` | `function` | `null` | Optional callback `(error, meta) => {}` for Discord webhooks, error tracking, or logging. |

---

## 🎯 Manual Error Capture

You can also use `fail-guard` manually inside `try/catch` blocks or framework middleware:

```javascript
const { capture } = require('fail-guard');

try {
  database.riskyOperation();
} catch (error) {
  // Renders the same beautiful card without throwing
  capture(error);
}
```

### Express Middleware Example:
```javascript
const { capture } = require('fail-guard');

app.use((err, req, res, next) => {
  capture(err);
  res.status(500).json({ error: 'Internal Server Error' });
});
```

---

## 💡 Supported Beginner Error Hints

`fail-guard` includes built-in recognition for frequent issues beginners encounter:

| Error Pattern | Plain-English Explanation & Suggestions |
| :--- | :--- |
| **`Cannot read properties of undefined/null`** | Suggests checking variable initialization, promises, and shows `?.` optional chaining syntax. |
| **`... is not a function`** | Identifies import mistakes (`require` vs `{ destructuring }`) or overwritten variable names. |
| **`... is not defined`** | Checks for typos, missing `const`/`let` declaration, or missing imports. |
| **`Assignment to constant variable`** | Suggests switching `const` to `let` or creating a new variable. |
| **`ECONNREFUSED`** | Explains that the target database/server (MongoDB, PostgreSQL, Redis) is not running locally. |
| **`EADDRINUSE`** | Explains that another process is already occupying the port, and how to change ports or kill the zombie process. |
| **`ENOENT`** | Warns that the path is incorrect and recommends `path.join(__dirname, ...)`. |
| **`MODULE_NOT_FOUND`** | Reminds developer to run `npm install <package>` or check `./` relative paths. |
| **`Unexpected token < in JSON`** | Explains that HTML was returned instead of JSON (common in 404/500 API responses). |
| **`Maximum call stack size exceeded`** | Diagnoses infinite recursion and missing base conditions. |
| **`TOKEN_INVALID`** | Spots invalid Discord/Telegram bot tokens or `.env` configuration issues. |

---

## 🧪 Testing

Run the included test suite (zero test dependencies required):

```bash
npm test
```

Try the interactive demo:

```bash
npm run example
```

---

## 🏗️ Architecture & Guarantees

- **Zero External Dependencies:** Built using native Node.js APIs (`process`, `path`, `fs`, `url`) and direct ANSI escape codes.
- **Dual CJS & ESM Support:** Works effortlessly with both `require()` and `import`.
- **TypeScript Ready:** Ships with comprehensive `index.d.ts` definitions.
- **Re-entrancy Guard:** Prevents infinite recursive crash loops if an error occurs while handling an error.
- **Node.js 14+ Compatible:** Runs cleanly across all modern Node.js versions.

---

## 📄 License

[MIT](LICENSE) © 2026 Avish Mittal
