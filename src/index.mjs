/**
 * fail-guard - ESM wrapper for seamless ES Module support
 */

import failGuard from './index.js';

export const init = failGuard.init;
export const capture = failGuard.capture;
export const uninstall = failGuard.uninstall;
export const isInitialized = failGuard.isInitialized;
export const formatErrorCard = failGuard.formatErrorCard;
export const parseCallSite = failGuard.parseCallSite;
export const getHintForError = failGuard.getHintForError;
export { failGuard };

export default failGuard;
