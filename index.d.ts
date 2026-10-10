export interface FailGuardOptions {
  /**
   * Keep the event loop running instead of exiting on unhandled errors.
   * Default: true in non-production environments (process.env.NODE_ENV !== 'production').
   */
  keepAlive?: boolean;

  /**
   * Print intuitive auto-fix suggestions for common beginner errors.
   * Default: true
   */
  showHint?: boolean;

  /**
   * If true, force exit with code 1 after rendering the clean card.
   * Default: false
   */
  exitOnFatal?: boolean;

  /**
   * Extract and highlight source code snippet around the error line.
   * Default: true
   */
  showSnippet?: boolean;

  /**
   * Number of lines of source code to display before and after the error line.
   * Default: 2
   */
  snippetLines?: number;

  /**
   * Force enable or disable ANSI terminal colors.
   * Defaults to automatic terminal capability detection.
   */
  enableColor?: boolean;

  /**
   * Custom logger function.
   * Default: console.error
   */
  logger?: (message: string) => void;

  /**
   * Callback hook triggered when a crash is caught.
   */
  onCrash?: (error: any, meta: CrashMeta) => void;
}

export interface CallSite {
  filePath: string;
  relativePath: string;
  fileName: string;
  line: number;
  column: number;
  functionName: string;
  isNodeModule: boolean;
}

export interface ErrorHint {
  id: string;
  title: string;
  explanation: string;
  suggestions: string[];
}

export interface CrashMeta {
  type: string;
  origin?: string;
  callSite: CallSite | null;
  hint: ErrorHint | null;
  keepAlive: boolean;
  card: string;
}

export function init(options?: FailGuardOptions): FailGuardOptions;
export function capture(error: any, customOptions?: FailGuardOptions & { type?: string }): string;
export function uninstall(): void;
export function isInitialized(): boolean;
export function formatErrorCard(error: any, options?: FailGuardOptions & { type?: string }): string;
export function parseCallSite(error: any): CallSite | null;
export function getHintForError(error: any): ErrorHint | null;

export interface FailGuardFunction {
  (options?: FailGuardOptions): FailGuardOptions;
  init: typeof init;
  capture: typeof capture;
  uninstall: typeof uninstall;
  isInitialized: typeof isInitialized;
  formatErrorCard: typeof formatErrorCard;
  parseCallSite: typeof parseCallSite;
  getHintForError: typeof getHintForError;
  failGuard: FailGuardFunction;
}

declare const failGuard: FailGuardFunction;
export default failGuard;
