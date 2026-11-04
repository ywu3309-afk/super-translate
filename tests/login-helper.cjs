'use strict';

// Test-only login bootstrap.  Production must not expose a "skip login"
// entry point: integration tests provision an isolated, random local admin
// record and exercise the same login form a user sees.  A local HTTP stub
// declines cloud endpoints so tests never contact the configured production
// host or depend on network state.
const crypto = require('node:crypto');
const http = require('node:http');
const { authStore } = require('../src/auth');

async function startCloudDeclineServer() {
  const server = http.createServer((request, response) => {
    // Keep the response shape deliberately boring: loginAccount should then
    // fall back to the isolated local administrator path.
    response.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ ok: false, error: 'test_cloud_disabled' }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    server,
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => server.close(() => resolve()))
  };
}

async function provisionLocalAdmin(profile) {
  const suffix = crypto.randomBytes(8).toString('hex');
  const credentials = {
    username: `TEST_ADMIN_${suffix}`,
    password: `T-${crypto.randomBytes(30).toString('base64url')}`
  };
  await authStore(profile).create(credentials.username, credentials.password);
  return credentials;
}

async function prepareTestLogin(profile) {
  const credentials = await provisionLocalAdmin(profile);
  const cloud = await startCloudDeclineServer();
  return { ...credentials, cloudBase: cloud.base, closeCloud: cloud.close };
}

async function loginToWorkbench(page, credentials) {
  await page.waitForSelector('#login-form');
  await page.locator('#account').fill(credentials.username);
  await page.locator('#password').fill(credentials.password);
  await page.locator('#login-form').evaluate(form => form.requestSubmit());
  await page.waitForURL('**/workbench/index.html');
}

module.exports = { startCloudDeclineServer, provisionLocalAdmin, prepareTestLogin, loginToWorkbench };
