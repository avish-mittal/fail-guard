/**
 * fail-guard Test Suite
 * Zero external dependencies. Tests uncaughtException, unhandledRejection,
 * stack trace parsing, snippet extraction, beginner hints, and process keepAlive.
 */

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const failGuard = require('../src/index');
const {
  formatErrorCard,
  parseCallSite,
  getHintForError,
  stripAnsi,
  wrapText,
  getPrintableWidth,
} = require('../src/formatter');

console.log('\n🧪 Running fail-guard Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// Test 1: Module exports and API interface
// -------------------------------------------------------------
test('Exports primary API functions and properties', () => {
  assert.strictEqual(typeof failGuard, 'function');
  assert.strictEqual(typeof failGuard.init, 'function');
  assert.strictEqual(typeof failGuard.capture, 'function');
  assert.strictEqual(typeof failGuard.uninstall, 'function');
  assert.strictEqual(typeof failGuard.isInitialized, 'function');
  assert.strictEqual(typeof failGuard.formatErrorCard, 'function');
  assert.strictEqual(typeof failGuard.parseCallSite, 'function');
  assert.strictEqual(typeof failGuard.getHintForError, 'function');
});

// -------------------------------------------------------------
// Test 2: Formatting card structure & ANSI strip
// -------------------------------------------------------------
test('Renders terminal error card with valid box borders and components', () => {
  const err = new TypeError("Cannot read properties of undefined (reading 'username')");
  const card = formatErrorCard(err, { keepAlive: true, showHint: true });

  assert.ok(card.includes('FAIL-GUARD'), 'Card contains FAIL-GUARD header');
  assert.ok(card.includes('TypeError'), 'Card includes error name');
  assert.ok(card.includes("Cannot read properties of undefined"), 'Card includes error message');
  assert.ok(card.includes('Hint:'), 'Card includes Hint section');
  assert.ok(card.includes('Process Guard: Active'), 'Card displays keepAlive status');

  // Verify all non-empty lines have identical printable width
  const lines = card.split('\n').filter((l) => l.trim().length > 0);
  const targetWidth = getPrintableWidth(lines[0]);
  assert.ok(targetWidth >= 68 && targetWidth <= 88, 'Card width is within standard bounds');

  for (let i = 0; i < lines.length; i++) {
    const lineWidth = getPrintableWidth(lines[i]);
    assert.strictEqual(
      lineWidth,
      targetWidth,
      `Line ${i} width (${lineWidth}) does not match expected width (${targetWidth}): ${lines[i]}`
    );
  }
});

// -------------------------------------------------------------
// Test 3: Beginner Hint Mapper for common errors
// -------------------------------------------------------------
test('Matches appropriate beginner hints for common errors', () => {
  // Undefined property access
  const undefinedErr = new TypeError("Cannot read properties of undefined (reading 'id')");
  const h1 = getHintForError(undefinedErr);
  assert.strictEqual(h1.id, 'undefined-or-null-property');
  assert.ok(h1.suggestions.some((s) => s.includes('optional chaining')));

  // Not a function
  const notAFnErr = new TypeError('db.connectUser is not a function');
  const h2 = getHintForError(notAFnErr);
  assert.strictEqual(h2.id, 'not-a-function');

  // Not defined (ReferenceError)
  const notDefErr = new ReferenceError('authToken is not defined');
  const h3 = getHintForError(notDefErr);
  assert.strictEqual(h3.id, 'is-not-defined');

  // ECONNREFUSED
  const connErr = new Error('connect ECONNREFUSED 127.0.0.1:27017');
  connErr.code = 'ECONNREFUSED';
  const h4 = getHintForError(connErr);
  assert.strictEqual(h4.id, 'econnrefused');
  assert.ok(h4.suggestions.some((s) => s.includes('MongoDB')));

  // EADDRINUSE
  const portErr = new Error('listen EADDRINUSE: address already in use :::3000');
  portErr.code = 'EADDRINUSE';
  const h5 = getHintForError(portErr);
  assert.strictEqual(h5.id, 'eaddrinuse');

  // ENOENT
  const fileErr = new Error("ENOENT: no such file or directory, open './config.json'");
  fileErr.code = 'ENOENT';
  const h6 = getHintForError(fileErr);
  assert.strictEqual(h6.id, 'enoent');

  // JSON parse
  const jsonErr = new SyntaxError('Unexpected token < in JSON at position 0');
  const h7 = getHintForError(jsonErr);
  assert.strictEqual(h7.id, 'json-parse');
});

// -------------------------------------------------------------
// Test 4: Call Site Parsing & Source Code Snippet
// -------------------------------------------------------------
test('Parses exact file, line, and column from error stack and extracts snippet', () => {
  function triggerInnerError() {
    return new Error('Simulated inside function');
  }

  const err = triggerInnerError();
  const callSite = parseCallSite(err);

  assert.ok(callSite, 'Call site was successfully parsed');
  assert.ok(callSite.filePath.endsWith('test.js'), 'Pinpoints test.js');
  assert.ok(callSite.line > 0, 'Line number is positive');
  assert.ok(callSite.column > 0, 'Column number is positive');
  assert.strictEqual(callSite.functionName, 'triggerInnerError');

  // Check card contains the code snippet from test.js
  const card = formatErrorCard(err, { showSnippet: true });
  assert.ok(card.includes('Source Code:'), 'Card contains Source Code section');
  assert.ok(card.includes('triggerInnerError'), 'Snippet contains function text');
  assert.ok(card.includes('>'), 'Snippet contains error pointer >');
});

// -------------------------------------------------------------
// Test 5: Manual error capture via failGuard.capture()
// -------------------------------------------------------------
test('failGuard.capture() formats error and calls onCrash callback', () => {
  let hookCalled = false;
  let loggedOutput = '';

  const err = new RangeError('Maximum call stack size exceeded');
  const card = failGuard.capture(err, {
    logger: (msg) => {
      loggedOutput = msg;
    },
    onCrash: (error, meta) => {
      hookCalled = true;
      assert.strictEqual(meta.type, 'Captured Error');
      assert.strictEqual(meta.hint.id, 'stack-overflow');
    },
  });

  assert.ok(hookCalled, 'onCrash callback was executed');
  assert.ok(loggedOutput.includes('Maximum call stack size exceeded'));
  assert.strictEqual(card, loggedOutput);
});

// -------------------------------------------------------------
// Test 6: Text wrapping utility
// -------------------------------------------------------------
test('wrapText wraps long lines without exceeding maxWidth', () => {
  const longSentence = 'This is a very long error explanation meant to test whether our custom wrapping utility works properly without breaking the borders of the card.';
  const maxWidth = 35;
  const wrapped = wrapText(longSentence, maxWidth);

  assert.ok(wrapped.length > 2, 'Sentence was split into multiple lines');
  for (const line of wrapped) {
    assert.ok(
      getPrintableWidth(line) <= maxWidth,
      `Wrapped line "${line}" exceeds width ${maxWidth}`
    );
  }
});

// -------------------------------------------------------------
// Test 7: Integration - uncaughtException keeps process alive
// -------------------------------------------------------------
test('Integration: Intercepts uncaughtException and keeps process alive in dev mode', () => {
  const scriptContent = `
    const { init } = require(${JSON.stringify(path.resolve(__dirname, '../src/index.js'))});
    
    init({ keepAlive: true });

    // Throw unhandled error
    setTimeout(() => {
      throw new Error("Deliberate unhandled crash!");
    }, 50);

    // Verify process didn't die by running a subsequent timeout
    setTimeout(() => {
      console.log("ALIVE_AND_KICKING");
      process.exit(0);
    }, 150);
  `;

  const result = spawnSync(process.execPath, ['-e', scriptContent], {
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.strictEqual(result.status, 0, 'Process exited with code 0 instead of crashing');
  assert.ok(
    result.stderr.includes('FAIL-GUARD') || result.stdout.includes('FAIL-GUARD'),
    'Output contains FAIL-GUARD card'
  );
  assert.ok(
    result.stdout.includes('ALIVE_AND_KICKING'),
    'Event loop stayed alive and continued execution'
  );
});

// -------------------------------------------------------------
// Test 8: Integration - unhandledRejection keeps process alive
// -------------------------------------------------------------
test('Integration: Intercepts unhandledRejection and keeps process alive', () => {
  const scriptContent = `
    const { init } = require(${JSON.stringify(path.resolve(__dirname, '../src/index.js'))});
    
    init({ keepAlive: true });

    // Reject promise without catch
    Promise.reject(new TypeError("Rejected promise without catch"));

    // Verify process remains alive
    setTimeout(() => {
      console.log("REJECTION_GUARDED");
      process.exit(0);
    }, 120);
  `;

  const result = spawnSync(process.execPath, ['-e', scriptContent], {
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.strictEqual(result.status, 0, 'Process stayed alive through unhandled rejection');
  assert.ok(
    result.stderr.includes('FAIL-GUARD • UNHANDLED REJECTION') ||
    result.stdout.includes('FAIL-GUARD • UNHANDLED REJECTION'),
    'Rendered Unhandled Rejection card'
  );
  assert.ok(result.stdout.includes('REJECTION_GUARDED'));
});

// -------------------------------------------------------------
// Test 9: Integration - exitOnFatal: true terminates with code 1
// -------------------------------------------------------------
test('Integration: exitOnFatal terminates process with exit code 1 after rendering card', () => {
  const scriptContent = `
    const { init } = require(${JSON.stringify(path.resolve(__dirname, '../src/index.js'))});
    
    init({ exitOnFatal: true });

    throw new Error("Fatal crash should exit!");
  `;

  const result = spawnSync(process.execPath, ['-e', scriptContent], {
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.strictEqual(result.status, 1, 'Process exited with code 1 as requested');
  assert.ok(
    result.stderr.includes('FAIL-GUARD') || result.stdout.includes('FAIL-GUARD'),
    'Printed error card before exiting'
  );
  assert.ok(
    result.stderr.includes('Exiting') || result.stdout.includes('Exiting'),
    'Printed Exiting status'
  );
});

// -------------------------------------------------------------
// Test 10: ESM Dual Module Import Support
// -------------------------------------------------------------
test('ESM import support via src/index.mjs works seamlessly', () => {
  const { pathToFileURL } = require('url');
  const esmUrl = pathToFileURL(path.resolve(__dirname, '../src/index.mjs')).href;
  const scriptContent = `
    import failGuard, { init, formatErrorCard } from ${JSON.stringify(esmUrl)};
    
    if (typeof init === 'function' && typeof formatErrorCard === 'function' && typeof failGuard === 'function') {
      console.log('ESM_SUCCESS');
    }
  `;

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', scriptContent], {
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.strictEqual(result.status, 0, `ESM execution failed: ${result.stderr}`);
  assert.ok(result.stdout.includes('ESM_SUCCESS'), 'ESM import successful');
});

console.log(`\n🎉 Results: ${passedTests}/${totalTests} tests passed.\n`);
