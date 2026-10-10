/**
 * fail-guard Interactive Example
 * Demonstrates how fail-guard intercepts errors and keeps your server/bot alive.
 */

const { init } = require('./src/index');

// Initialize fail-guard with friendly defaults
init({
  keepAlive: true,      // Keep process running in dev mode
  showHint: true,       // Display beginner hints
  showSnippet: true,    // Extract 2 lines of source code around error
  snippetLines: 2,
});

console.log('\n🚀 [fail-guard] App started! Simulating unhandled crashes in 1 second...\n');

// 1. Simulate an uncaught exception (e.g. reading property on undefined)
setTimeout(() => {
  console.log('⚡ Triggering Uncaught Exception (accessing property on null)...');
  const user = null;
  // This would normally crash your entire server/bot!
  const profileName = user.profile.name;
}, 1000);

// 2. Simulate an unhandled Promise rejection
setTimeout(() => {
  console.log('⚡ Triggering Unhandled Rejection (async task failed)...');
  Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
}, 2500);

// 3. Keep-alive verification: Server heartbeat keeps ticking!
const timer = setInterval(() => {
  console.log('💚 [Heartbeat] Event loop is still running! App did not crash.');
}, 1500);

// Stop example after 6 seconds
setTimeout(() => {
  clearInterval(timer);
  console.log('\n✨ Example completed successfully. Both crashes were gracefully guarded!\n');
  process.exit(0);
}, 5000);
