/**
 * fail-guard - Zero-dependency crash protection and beautiful error cards for Node.js
 *
 * Prevents beginner developers' Node.js apps and bots from abruptly crashing,
 * replacing intimidating stack traces with actionable, beginner-friendly terminal cards.
 */

const {
  formatErrorCard,
  parseCallSite,
  getHintForError,
  supportsColor,
} = require('./formatter');

// Active configuration state
let activeConfig = null;
let uncaughtListener = null;
let unhandledListener = null;
let isHandlingCrash = false;

/**
 * Resolve options with intelligent defaults.
 *
 * @param {Object} [options={}] - User options
 * @returns {Object} Fully resolved configuration
 */
function resolveConfig(options = {}) {
  const isDev = process.env.NODE_ENV !== 'production';

  return {
    // Keep process alive in development mode by default
    keepAlive: options.keepAlive !== undefined ? Boolean(options.keepAlive) : isDev,
    // Show beginner auto-fix hints
    showHint: options.showHint !== undefined ? Boolean(options.showHint) : true,
    // Force exit with code 1 after rendering card (overrides keepAlive if true)
    exitOnFatal: options.exitOnFatal !== undefined ? Boolean(options.exitOnFatal) : false,
    // Show source code snippet surrounding the error
    showSnippet: options.showSnippet !== undefined ? Boolean(options.showSnippet) : true,
    // Number of lines before and after to display in snippet
    snippetLines: typeof options.snippetLines === 'number' ? options.snippetLines : 2,
    // Enable ANSI colors (defaults to auto-detection)
    enableColor: options.enableColor !== undefined ? Boolean(options.enableColor) : supportsColor(),
    // Custom logger function (defaults to console.error)
    logger: typeof options.logger === 'function' ? options.logger : console.error,
    // Optional lifecycle callback when a crash is caught: (error, meta) => {}
    onCrash: typeof options.onCrash === 'function' ? options.onCrash : null,
  };
}

/**
 * Handle an intercepted error or unhandled rejection.
 *
 * @param {Error|any} error - The caught error or rejection reason
 * @param {string} crashType - 'Uncaught Exception' or 'Unhandled Rejection'
 * @param {string} [origin] - Origin of uncaught exception (e.g. 'uncaughtException')
 */
function handleCrash(error, crashType, origin = '') {
  // Re-entrancy guard to avoid infinite recursive crashes
  if (isHandlingCrash) {
    try {
      console.error('[fail-guard] Recursive error detected during crash handling:', error);
    } finally {
      process.exit(1);
    }
  }

  isHandlingCrash = true;

  try {
    const config = activeConfig || resolveConfig();
    const shouldKeepAlive = config.keepAlive && !config.exitOnFatal;

    // Generate beautiful ANSI error card
    const card = formatErrorCard(error, {
      type: crashType,
      keepAlive: shouldKeepAlive,
      showHint: config.showHint,
      showSnippet: config.showSnippet,
      snippetLines: config.snippetLines,
      enableColor: config.enableColor,
    });

    // Output through configured logger
    config.logger(card);

    // Call onCrash hook if registered
    if (config.onCrash) {
      try {
        const callSite = parseCallSite(error);
        const hint = config.showHint ? getHintForError(error) : null;
        config.onCrash(error, {
          type: crashType,
          origin,
          callSite,
          hint,
          keepAlive: shouldKeepAlive,
          card,
        });
      } catch (hookErr) {
        config.logger('[fail-guard] Warning: Error thrown inside onCrash callback:', hookErr);
      }
    }

    // Determine whether to exit the process
    if (!shouldKeepAlive) {
      process.exit(1);
    }
  } catch (internalErr) {
    // Failsafe fallback
    console.error('[fail-guard] Internal error rendering error card:');
    console.error(internalErr);
    console.error('Original Error:', error);
    process.exit(1);
  } finally {
    isHandlingCrash = false;
  }
}

/**
 * Initialize fail-guard crash interception.
 *
 * @param {Object} [options={}] - Configuration options
 * @returns {Object} Active configuration
 */
function init(options = {}) {
  activeConfig = resolveConfig(options);

  // If already initialized, update active config without duplicating listeners
  if (uncaughtListener && unhandledListener) {
    return activeConfig;
  }

  // Intercept uncaught exceptions
  uncaughtListener = (err, origin) => {
    handleCrash(err, 'Uncaught Exception', origin);
  };
  process.on('uncaughtException', uncaughtListener);

  // Intercept unhandled promise rejections
  unhandledListener = (reason, promise) => {
    handleCrash(reason, 'Unhandled Rejection', 'unhandledRejection');
  };
  process.on('unhandledRejection', unhandledListener);

  return activeConfig;
}

/**
 * Manually capture and format an error without throwing.
 * Useful for Express error handlers, Discord bot command catches, etc.
 *
 * @param {Error|any} error - The error to format and log
 * @param {Object} [customOptions={}] - Optional overrides for this capture
 * @returns {string} The formatted card string
 */
function capture(error, customOptions = {}) {
  const config = { ...(activeConfig || resolveConfig()), ...customOptions };
  const card = formatErrorCard(error, {
    type: customOptions.type || 'Captured Error',
    keepAlive: true,
    showHint: config.showHint,
    showSnippet: config.showSnippet,
    snippetLines: config.snippetLines,
    enableColor: config.enableColor,
  });

  config.logger(card);

  if (typeof config.onCrash === 'function') {
    try {
      config.onCrash(error, {
        type: 'Captured Error',
        callSite: parseCallSite(error),
        hint: config.showHint ? getHintForError(error) : null,
        keepAlive: true,
        card,
      });
    } catch {
      // Ignore
    }
  }

  return card;
}

/**
 * Uninstall fail-guard listeners and restore default Node.js behavior.
 */
function uninstall() {
  if (uncaughtListener) {
    process.removeListener('uncaughtException', uncaughtListener);
    uncaughtListener = null;
  }
  if (unhandledListener) {
    process.removeListener('unhandledRejection', unhandledListener);
    unhandledListener = null;
  }
  activeConfig = null;
  isHandlingCrash = false;
}

/**
 * Check whether fail-guard is currently active.
 *
 * @returns {boolean}
 */
function isInitialized() {
  return Boolean(uncaughtListener && unhandledListener);
}

/**
 * Primary callable failGuard function.
 * Allows `failGuard({ ... })` as an alias to `failGuard.init({ ... })`.
 *
 * @param {Object} [options]
 * @returns {Object} Active configuration
 */
function failGuard(options) {
  return init(options);
}

// Attach named properties to primary function
failGuard.init = init;
failGuard.capture = capture;
failGuard.uninstall = uninstall;
failGuard.isInitialized = isInitialized;
failGuard.formatErrorCard = formatErrorCard;
failGuard.parseCallSite = parseCallSite;
failGuard.getHintForError = getHintForError;
failGuard.failGuard = failGuard;

module.exports = failGuard;
