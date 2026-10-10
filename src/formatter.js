/**
 * fail-guard - Terminal Card Formatter & Error Hint Mapper
 * Zero external dependencies. Uses native ANSI escape codes.
 */

const fs = require('fs');
const path = require('path');
const url = require('url');

// ANSI Color and Style Codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright Foreground
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Backgrounds
  bgRed: '\x1b[41m',
  bgBrightRed: '\x1b[101m',
  bgDarkRed: '\x1b[48;5;52m',
  bgGray: '\x1b[100m',
  bgDarkGray: '\x1b[48;5;236m',
};

/**
 * Check if the terminal supports ANSI colors.
 */
function supportsColor() {
  if (process.env.NO_COLOR !== undefined || process.argv.includes('--no-color')) {
    return false;
  }
  if (process.env.FORCE_COLOR !== undefined || process.argv.includes('--color')) {
    return true;
  }
  return Boolean(process.stdout && (process.stdout.isTTY || process.env.CI));
}

/**
 * Strip ANSI escape codes to measure true printable string width.
 */
function stripAnsi(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Compute printable width of a string.
 * Accounts for 2-column wide emojis used in fail-guard.
 */
function getPrintableWidth(str) {
  const plain = stripAnsi(str);
  let width = 0;
  for (const char of plain) {
    const code = char.codePointAt(0);
    // Common emoji ranges and full-width characters
    if (
      (code >= 0x1f300 && code <= 0x1f9ff) || // Miscellaneous Symbols and Pictographs
      (code >= 0x2600 && code <= 0x27bf) ||   // Misc symbols / Dingbats
      (code >= 0xfe00 && code <= 0xfe0f)      // Variation selectors (zero width)
    ) {
      if (code >= 0xfe00 && code <= 0xfe0f) {
        width += 0;
      } else {
        width += 2;
      }
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Word wrap text into an array of lines that fit within maxWidth.
 */
function wrapText(text, maxWidth) {
  if (!text) return [];
  const lines = [];
  const rawParagraphs = text.split('\n');

  for (const paragraph of rawParagraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (getPrintableWidth(testLine) <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Common beginner error hint database and mapper.
 */
const HINTS = [
  {
    id: 'undefined-or-null-property',
    match: (err) =>
      /Cannot read propert(?:y|ies) of (undefined|null)/i.test(err.message) ||
      /is (undefined|null)/i.test(err.message),
    title: 'Accessing property on undefined or null',
    explanation:
      "You're trying to read a property from a variable that hasn't been assigned or is null.",
    suggestions: [
      'Check if the variable or object was initialized before reading from it.',
      'If fetching from an API or database, ensure the data finished loading first.',
      'Use optional chaining (e.g., `user?.name` instead of `user.name`) to prevent crashing.',
    ],
  },
  {
    id: 'not-a-function',
    match: (err) => /is not a function/i.test(err.message),
    title: 'Attempted to call a non-function',
    explanation:
      "You tried to call something with `()` as a function, but its current value isn't one.",
    suggestions: [
      'Check for typos in the function name.',
      'Verify module imports: e.g., `const { myFunc } = require(...)` instead of `const myFunc = require(...)`.',
      'Make sure you did not accidentally overwrite the function variable with another value.',
    ],
  },
  {
    id: 'is-not-defined',
    match: (err) => /([a-zA-Z0-9_$]+) is not defined/i.test(err.message),
    title: 'Undeclared variable',
    explanation:
      'This variable has not been declared in the current file or scope.',
    suggestions: [
      'Check the spelling of the variable name for typos or capitalization errors.',
      'Declare the variable using `const`, `let`, or `var` before using it.',
      'If the variable is from an external file or package, make sure to import or require it.',
    ],
  },
  {
    id: 'assignment-to-const',
    match: (err) => /Assignment to constant variable/i.test(err.message),
    title: 'Reassigning a constant variable',
    explanation:
      'Variables declared with `const` are immutable and cannot be reassigned with `=`.',
    suggestions: [
      'Change the declaration keyword from `const` to `let` if you plan to reassign it.',
      'Or create a new variable instead of reassigning the existing one.',
    ],
  },
  {
    id: 'econnrefused',
    match: (err) =>
      err.code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(err.message),
    title: 'Connection refused (ECONNREFUSED)',
    explanation:
      'Node.js tried to connect to a server, database, or port, but nothing was listening.',
    suggestions: [
      'Check if your database (MongoDB, PostgreSQL, MySQL, Redis) is currently running.',
      'Verify the port number and host (e.g., `localhost:3000` or `127.0.0.1:5432`).',
      'If connecting to an external API, verify your network connection and URL.',
    ],
  },
  {
    id: 'eaddrinuse',
    match: (err) =>
      err.code === 'EADDRINUSE' || /EADDRINUSE/i.test(err.message),
    title: 'Port already in use (EADDRINUSE)',
    explanation:
      'The network port your app is trying to listen on is already being used by another process.',
    suggestions: [
      'Kill any previously running instance of your app or server.',
      'Change the port number in your code or environment variable (e.g., `PORT=3001`).',
      'On Windows run `netstat -ano | findstr :<port>` or on Mac/Linux `lsof -i :<port>` to find the process.',
    ],
  },
  {
    id: 'enoent',
    match: (err) =>
      err.code === 'ENOENT' || /ENOENT|no such file or directory/i.test(err.message),
    title: 'File or directory not found (ENOENT)',
    explanation:
      'Node.js could not locate the file or folder specified in your file system call.',
    suggestions: [
      'Check the file name and path for spelling errors or missing extensions.',
      'Use `path.join(__dirname, "filename")` to ensure relative paths resolve predictably.',
      'Confirm that the file exists in the directory where your command is running.',
    ],
  },
  {
    id: 'module-not-found',
    match: (err) =>
      err.code === 'MODULE_NOT_FOUND' || /Cannot find module/i.test(err.message),
    title: 'Module or package not found',
    explanation:
      'Node.js was unable to locate the required or imported module.',
    suggestions: [
      'If it is an NPM package, run `npm install <package-name>`.',
      'If it is a local file, ensure the path starts with `./` or `../` (e.g. `./utils.js`).',
      'Check whether the file extension (`.js`, `.json`) is missing or misspelled.',
    ],
  },
  {
    id: 'json-parse',
    match: (err) =>
      /Unexpected token|is not valid JSON|JSON\.parse/i.test(err.message),
    title: 'JSON parsing failure',
    explanation:
      'You tried to parse a string with `JSON.parse()`, but it is not valid JSON.',
    suggestions: [
      'Verify that the data received is not empty, `undefined`, or an HTML error page (e.g., 404/500).',
      'Wrap your `JSON.parse()` call inside a `try { ... } catch (e) { ... }` block.',
      'Log the raw response string with `console.log(response)` before parsing it.',
    ],
  },
  {
    id: 'stack-overflow',
    match: (err) => /Maximum call stack size exceeded/i.test(err.message),
    title: 'Stack overflow (infinite recursion)',
    explanation:
      'A function called itself endlessly without reaching a stopping condition.',
    suggestions: [
      'Check recursive functions for a valid base case that stops execution.',
      'Check for circular dependencies or event listeners triggering themselves in an infinite loop.',
    ],
  },
  {
    id: 'bot-token-invalid',
    match: (err) =>
      /TOKEN_INVALID|An invalid token was provided|unauthorized/i.test(err.message),
    title: 'Invalid Bot / API Token',
    explanation:
      'The API or bot token supplied to your client is invalid or unauthorized.',
    suggestions: [
      'Check your `.env` file and make sure the token is copied accurately.',
      'Ensure there are no accidental spaces or quotation marks around the token string.',
      'If using Discord.js or Telegram, verify your token was not reset in the developer portal.',
    ],
  },
  {
    id: 'network-timeout',
    match: (err) =>
      /ETIMEDOUT|ESOCKETTIMEDOUT|fetch failed/i.test(err.message),
    title: 'Network request timed out',
    explanation:
      'A network request took too long to respond or failed to establish a handshake.',
    suggestions: [
      'Check your internet connection and verify the target server is currently online.',
      'Check if a firewall, VPN, or proxy is blocking outgoing requests.',
      'Increase the request timeout duration if the target API is slow to respond.',
    ],
  },
];

/**
 * Find the most relevant beginner hint for an error.
 */
function getHintForError(error) {
  if (!error) return null;

  for (const hint of HINTS) {
    try {
      if (hint.match(error)) {
        return hint;
      }
    } catch {
      // Ignore errors in hint matcher
    }
  }

  // Generic fallback hint
  return {
    id: 'generic',
    title: 'General Debugging Tip',
    explanation: 'An unexpected runtime error occurred during execution.',
    suggestions: [
      'Review the highlighted code snippet above to inspect variable values.',
      'Use `console.log()` immediately before the failing line to verify inputs.',
      'Check if any asynchronous operations (Promises / async-await) were properly awaited.',
    ],
  };
}

/**
 * Parse stack trace to find the exact user code callsite.
 * Strips Node.js internal lines (node:internal/*, internal/*).
 */
function parseCallSite(error) {
  if (!error || !error.stack) {
    return null;
  }

  const stackLines = error.stack.split('\n');
  const thisFilePath = path.resolve(__filename);
  const thisDir = path.dirname(thisFilePath);

  // Match: at FunctionName (path:line:col) OR at path:line:col
  const callSiteRegex = /^\s*at (?:(?:async\s+)?(?:new\s+)?([^\s(]+)\s+)?\(?(?:file:\/\/)?([a-zA-Z]:[\\/][^:)]+|[\\/][^:)]+|[^:()]+):(\d+):(\d+)\)?$/;

  let fallbackSite = null;

  for (let i = 1; i < stackLines.length; i++) {
    const line = stackLines[i];
    if (!line) continue;

    // Filter Node internal runtime lines
    if (
      line.includes('node:internal') ||
      line.includes('(node:') ||
      line.includes('internal/modules') ||
      line.includes('node:events')
    ) {
      continue;
    }

    const match = line.match(callSiteRegex);
    if (!match) continue;

    const fnName = match[1] && match[1] !== 'Object.<anonymous>' ? match[1] : 'anonymous';
    let rawPath = match[2];
    const lineNumber = parseInt(match[3], 10);
    const colNumber = parseInt(match[4], 10);

    // Convert file:// URL if needed
    if (rawPath.startsWith('file://')) {
      try {
        rawPath = url.fileURLToPath(rawPath);
      } catch {
        // Keep rawPath
      }
    }

    // Normalize path separators
    const resolvedPath = path.resolve(rawPath);

    // Skip fail-guard's own files so we never blame the wrapper
    if (resolvedPath.startsWith(thisDir)) {
      continue;
    }

    const isNodeModule = resolvedPath.includes(`${path.sep}node_modules${path.sep}`);

    const site = {
      filePath: resolvedPath,
      relativePath: path.relative(process.cwd(), resolvedPath) || resolvedPath,
      fileName: path.basename(resolvedPath),
      line: lineNumber,
      column: colNumber,
      functionName: fnName,
      isNodeModule,
    };

    // Prioritize user code over third-party node_modules
    if (!isNodeModule) {
      return site;
    }

    if (!fallbackSite) {
      fallbackSite = site;
    }
  }

  return fallbackSite;
}

/**
 * Extract source code snippet surrounding the error line.
 */
function getCodeSnippet(callSite, snippetRadius = 2) {
  if (!callSite || !callSite.filePath) return null;

  try {
    if (!fs.existsSync(callSite.filePath)) return null;

    const fileContent = fs.readFileSync(callSite.filePath, 'utf8');
    const allLines = fileContent.split(/\r?\n/);
    const targetLineIndex = callSite.line - 1;

    if (targetLineIndex < 0 || targetLineIndex >= allLines.length) {
      return null;
    }

    const startIndex = Math.max(0, targetLineIndex - snippetRadius);
    const endIndex = Math.min(allLines.length - 1, targetLineIndex + snippetRadius);

    const snippetLines = [];
    for (let i = startIndex; i <= endIndex; i++) {
      snippetLines.push({
        lineNum: i + 1,
        content: allLines[i],
        isErrorLine: i === targetLineIndex,
      });
    }

    return {
      lines: snippetLines,
      column: callSite.column,
    };
  } catch {
    return null;
  }
}

/**
 * Render the clean, beautiful ANSI terminal error card.
 *
 * @param {Error|any} error - The unhandled error or rejection reason
 * @param {Object} options - Configuration options
 * @returns {string} The fully formatted ANSI error card string
 */
function formatErrorCard(error, options = {}) {
  const {
    type = 'Uncaught Exception',
    keepAlive = true,
    showHint = true,
    showSnippet = true,
    snippetLines = 2,
    enableColor = supportsColor(),
  } = options;

  // Normalize error
  const normalizedErr =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : JSON.stringify(error));

  const errName = normalizedErr.name || 'Error';
  const rawMessage = normalizedErr.message || String(normalizedErr);

  // Terminal width calculation (clamped between 68 and 88 for optimal card aesthetics)
  const stdoutWidth = process.stdout && process.stdout.columns ? process.stdout.columns : 80;
  const cardWidth = Math.max(68, Math.min(88, stdoutWidth - 2));
  const innerWidth = cardWidth - 4; // 2 border chars + 2 padding spaces

  // Color helper functions
  const c = (code, text) => (enableColor ? `${code}${text}${ANSI.reset}` : text);
  const bold = (text) => c(ANSI.bold, text);
  const dim = (text) => c(ANSI.dim, text);
  const red = (text) => c(ANSI.red, text);
  const brightRed = (text) => c(ANSI.brightRed, text);
  const yellow = (text) => c(ANSI.brightYellow, text);
  const cyan = (text) => c(ANSI.brightCyan, text);
  const green = (text) => c(ANSI.brightGreen, text);
  const gray = (text) => c(ANSI.gray, text);

  // Box drawing characters (modern rounded corners)
  const BOX = {
    tl: '╭',
    tr: '╮',
    bl: '╰',
    br: '╯',
    h: '─',
    v: '│',
    divider: '├',
    dividerR: '┤',
  };

  const outputLines = [];

  // Helper to format a card content row inside borders
  function addRow(content = '') {
    const printableLen = getPrintableWidth(content);
    const spaceToFill = Math.max(0, innerWidth - printableLen);
    const border = gray(BOX.v);
    outputLines.push(`${border}  ${content}${' '.repeat(spaceToFill)}${border}`);
  }

  function addEmptyRow() {
    addRow('');
  }

  function addSectionDivider() {
    const dividerLine = BOX.h.repeat(cardWidth - 2);
    outputLines.push(gray(`${BOX.divider}${dividerLine}${BOX.dividerR}`));
  }

  // --- HEADER ---
  const badgeTitle = ` FAIL-GUARD • ${type.toUpperCase()} `;
  const styledBadge = enableColor
    ? `${ANSI.bold}${ANSI.brightWhite}${ANSI.bgDarkRed}${badgeTitle}${ANSI.reset}`
    : badgeTitle;
  const headerPrefix = `${BOX.tl}${BOX.h}${BOX.h} `;
  const headerRemaining = Math.max(
    0,
    cardWidth - 1 - getPrintableWidth(headerPrefix) - getPrintableWidth(badgeTitle)
  );
  const topBorder = gray(`${headerPrefix}`) + styledBadge + gray(`${BOX.h.repeat(headerRemaining)}${BOX.tr}`);

  outputLines.push('');
  outputLines.push(topBorder);
  addEmptyRow();

  // --- ERROR HEADLINE ---
  const errorBadge = brightRed(bold('✖ '));
  const errorHeader = `${errorBadge}${brightRed(bold(errName))}: ${bold(rawMessage)}`;
  const wrappedError = wrapText(errorHeader, innerWidth);
  for (const line of wrappedError) {
    addRow(line);
  }

  // --- LOCATION ---
  const callSite = parseCallSite(normalizedErr);
  if (callSite) {
    addEmptyRow();
    const locIcon = yellow('📍 Location:');
    addRow(locIcon);

    // Location row
    const relPath = callSite.relativePath || callSite.filePath;
    const locationStr = `   ${cyan(bold(relPath))}${gray(':')}${yellow(bold(callSite.line))}${gray(':')}${dim(callSite.column)}`;
    const funcStr = callSite.functionName ? gray(` (in ${callSite.functionName})`) : '';
    const fullLoc = `${locationStr}${funcStr}`;

    if (getPrintableWidth(fullLoc) > innerWidth) {
      addRow(locationStr);
      if (funcStr) addRow(`   ${funcStr.trim()}`);
    } else {
      addRow(fullLoc);
    }

    // --- CODE SNIPPET ---
    if (showSnippet) {
      const snippet = getCodeSnippet(callSite, snippetLines);
      if (snippet && snippet.lines && snippet.lines.length > 0) {
        addEmptyRow();
        addRow(yellow('📄 Source Code:'));

        const maxLineNumLen = String(snippet.lines[snippet.lines.length - 1].lineNum).length;
        const prefixWidth = 8 + maxLineNumLen; // '   ' + pointer(1) + ' ' + num + ' ' + sep(1) + ' '
        const maxCodeWidth = Math.max(20, innerWidth - prefixWidth);

        for (const item of snippet.lines) {
          const numStr = String(item.lineNum).padStart(maxLineNumLen, ' ');
          let rawCode = item.content.replace(/\t/g, '  ');

          // Truncate code line if it exceeds available box width
          if (getPrintableWidth(rawCode) > maxCodeWidth) {
            rawCode = rawCode.slice(0, maxCodeWidth - 1) + '…';
          }

          if (item.isErrorLine) {
            const pointer = brightRed(bold('>'));
            const lineNumFormatted = brightRed(bold(numStr));
            const sep = brightRed(bold('│'));
            const codeContent = brightRed(rawCode);
            addRow(`   ${pointer} ${lineNumFormatted} ${sep} ${codeContent}`);

            // Caret underline pointer
            if (snippet.column > 0) {
              const caretPad = Math.min(maxCodeWidth - 1, Math.max(0, snippet.column - 1));
              const emptyLineNumPad = ' '.repeat(maxLineNumLen);
              const caret = brightRed(bold('^'));
              addRow(`     ${emptyLineNumPad} ${gray('│')} ${' '.repeat(caretPad)}${caret}`);
            }
          } else {
            const emptyPointer = ' ';
            const lineNumFormatted = gray(numStr);
            const sep = gray('│');
            const codeContent = dim(rawCode);
            addRow(`   ${emptyPointer} ${lineNumFormatted} ${sep} ${codeContent}`);
          }
        }
      }
    }
  }

  // --- BEGINNER HINT ---
  if (showHint) {
    const hint = getHintForError(normalizedErr);
    if (hint) {
      addEmptyRow();
      addSectionDivider();
      addEmptyRow();

      const hintHeader = `${yellow('💡 Hint:')} ${bold(hint.title)}`;
      addRow(hintHeader);

      const explanationLines = wrapText(gray(hint.explanation), innerWidth - 3);
      for (const line of explanationLines) {
        addRow(`   ${line}`);
      }

      if (hint.suggestions && hint.suggestions.length > 0) {
        addEmptyRow();
        for (const suggestion of hint.suggestions) {
          const wrappedSug = wrapText(`• ${suggestion}`, innerWidth - 5);
          for (let i = 0; i < wrappedSug.length; i++) {
            const prefix = i === 0 ? '   ' : '     ';
            addRow(`${prefix}${cyan(wrappedSug[i])}`);
          }
        }
      }
    }
  }

  // --- STATUS FOOTER ---
  addEmptyRow();
  addSectionDivider();
  addEmptyRow();

  let statusMsg = '';
  if (keepAlive) {
    const guardBadge = green('🛡️  Process Guard:');
    statusMsg = `${guardBadge} ${green(bold('Active'))} ${dim('• App kept alive in dev mode (keepAlive: true)')}`;
  } else {
    const exitBadge = red('🛑 Process Guard:');
    statusMsg = `${exitBadge} ${red(bold('Exiting'))} ${dim('• Process terminating with code 1 (keepAlive: false)')}`;
  }
  addRow(statusMsg);

  addEmptyRow();
  const bottomBorder = gray(`${BOX.bl}${BOX.h.repeat(cardWidth - 2)}${BOX.br}`);
  outputLines.push(bottomBorder);
  outputLines.push('');

  return outputLines.join('\n');
}

module.exports = {
  ANSI,
  supportsColor,
  stripAnsi,
  getPrintableWidth,
  wrapText,
  getHintForError,
  parseCallSite,
  getCodeSnippet,
  formatErrorCard,
  HINTS,
};
