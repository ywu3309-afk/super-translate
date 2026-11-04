'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const helpers = require('../src/workbench/traffic-crm.js');

const moduleFile = path.resolve(__dirname, '../src/workbench/traffic-crm.js');
const checks = [];
function ok(name, value) {
  assert.ok(value, name);
  checks.push(name);
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function main() {
  ok('Default database name', helpers.DB_NAME === 'TrafficCRM_DB');
  ok('Phone normalization removes every non-digit', helpers.normalizePhone(' +44 (7700) 900-123 ') === '447700900123');
  ok('Three-digit calling code wins', helpers.resolveCountry('+420 777 123 456').country === '捷克');
  ok('Ethiopia calling code and flag are resolved', helpers.resolveCountry('+251 92 562 6363').country === '埃塞俄比亚' && helpers.resolveCountry('+251 92 562 6363').flag === '🇪🇹');
  ok('Additional European calling codes are resolved', helpers.resolveCountry('+358 40 123 4567').country === '芬兰' && helpers.resolveCountry('+380 50 123 4567').country === '乌克兰');
  ok('One-digit calling code works', helpers.resolveCountry('+7 999 123 45 67').country === '俄罗斯');

  const expectedCountries = new Map([
    ['420', '捷克'], ['421', '斯洛伐克'], ['355', '阿尔巴尼亚'], ['351', '葡萄牙'],
    ['966', '沙特'], ['971', '阿联酋'], ['251', '埃塞俄比亚'], ['358', '芬兰'], ['380', '乌克兰'], ['31', '荷兰'], ['48', '波兰'], ['41', '瑞士'], ['30', '希腊'],
    ['44', '英国'], ['33', '法国'], ['49', '德国'], ['34', '西班牙'], ['39', '意大利'], ['55', '巴西'],
    ['52', '墨西哥'], ['84', '越南'], ['66', '泰国'], ['62', '印尼'], ['81', '日本'], ['82', '韩国'],
    ['1', '美国/加拿大'], ['7', '俄罗斯']
  ]);
  ok('All requested calling codes are covered', [...expectedCountries].every(([prefix, country]) => helpers.resolveCountry(prefix + '123456789').country === country));

  const moduleBody = fs.readFileSync(moduleFile);
  const server = http.createServer((request, response) => {
    if (request.url === '/traffic-crm.js') {
      response.writeHead(200, {'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store'});
      response.end(moduleBody);
      return;
    }
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
    response.end('<!doctype html><meta charset="utf-8"><body><script src="/traffic-crm.js"></script></body>');
  });
  const port = await listen(server);
  // Reuse the installed Chrome binary, matching the repository's other
  // browser tests (the Playwright-managed Chromium shell is not bundled).
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const context = await browser.newContext({acceptDownloads: true});
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  try {
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('TrafficCRM_DB');
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('test database delete blocked'));
    }));

    const schema = await page.evaluate(async() => {
      const db = await TrafficCRM.open();
      const tx = db.transaction('customers', 'readonly');
      const store = tx.objectStore('customers');
      return {name: db.name, keyPath: store.keyPath, indexes: [...store.indexNames]};
    });
    ok('TrafficCRM_DB opens in IndexedDB', schema.name === 'TrafficCRM_DB');
    ok('customers uses phone keyPath', schema.keyPath === 'phone');
    ok('Daily and status indexes created', ['firstContactDate', 'status', 'country', 'dealTimestamp'].every(name => schema.indexes.includes(name)));

    const dedupe = await page.evaluate(async() => {
      const firstTime = new Date(2026, 8, 8, 8, 30, 15).getTime();
      const laterTime = new Date(2026, 8, 9, 18, 45, 10).getTime();
      const first = await TrafficCRM.ensureCustomer('+44 (7700) 900-123', {now: firstTime});
      const duplicate = await TrafficCRM.ensureCustomer('44-7700-900-123', {now: laterTime});
      return {first, duplicate, saved: await TrafficCRM.getCustomer('+447700900123'), firstTime};
    });
    ok('First contact is marked new', dedupe.first.isNew === true);
    ok('Duplicate contact is not marked new', dedupe.duplicate.isNew === false);
    ok('Duplicate never overwrites firstContactDate', dedupe.saved.firstContactDate === '2026-09-08');
    ok('Duplicate never overwrites firstContactTimestamp', dedupe.saved.firstContactTimestamp === dedupe.firstTime);
    ok('Stored phone key contains digits only', dedupe.saved.phone === '447700900123');
    ok('Country and flag are persisted', dedupe.saved.country === '英国' && dedupe.saved.flag === '🇬🇧');

    const repairedCountry = await page.evaluate(async() => {
      const db = await TrafficCRM.open();
      const originalTime = new Date(2026, 7, 2, 9, 15, 0).getTime();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('customers', 'readwrite');
        tx.objectStore('customers').put({phone:'33600000101',firstContactDate:'2026-08-02',firstContactTimestamp:originalTime,country:'未知',flag:'🌐',status:'deal',dealTimestamp:originalTime + 1000});
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
      const result = await TrafficCRM.ensureCustomer('+33 6 00 00 01 01', {now:new Date(2026, 8, 9, 12, 0, 0).getTime()});
      return result.customer;
    });
    ok('Existing unknown country is repaired from the phone prefix', repairedCountry.country === '法国' && repairedCountry.flag === '🇫🇷');
    ok('Country repair preserves first contact and deal state', repairedCountry.firstContactDate === '2026-08-02' && repairedCountry.status === 'deal');

    const repairedEthiopia = await page.evaluate(async() => {
      const db = await TrafficCRM.open();
      const originalTime = new Date(2026, 7, 3, 9, 15, 0).getTime();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('customers', 'readwrite');
        tx.objectStore('customers').put({phone:'251925626363',firstContactDate:'2026-08-03',firstContactTimestamp:originalTime,country:'未知',flag:'🌐',status:'deal',dealTimestamp:originalTime + 1000});
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
      const result = await TrafficCRM.ensureCustomer('+251 92 562 6363', {now:new Date(2026, 8, 9, 12, 0, 0).getTime()});
      return result.customer;
    });
    ok('Existing unknown Ethiopia country is repaired from the phone prefix', repairedEthiopia.country === '埃塞俄比亚' && repairedEthiopia.flag === '🇪🇹');
    ok('Ethiopia country repair preserves first contact and deal state', repairedEthiopia.firstContactDate === '2026-08-03' && repairedEthiopia.status === 'deal');

    const sharedCallingCode = await page.evaluate(async() => {
      const result = await TrafficCRM.ensureCustomer('+1 416 555 0100', {country:'加拿大', countryCode:'CA', now:new Date(2026, 6, 1, 13, 0, 0).getTime()});
      return result.customer;
    });
    ok('Authoritative full-number country overrides a shared calling-code fallback', sharedCallingCode.country === '加拿大' && sharedCallingCode.flag === '🇨🇦');

    const concurrent = await page.evaluate(async() => {
      const now = new Date(2026, 8, 9, 9, 0, 0).getTime();
      const results = await Promise.all(Array.from({length: 8}, (_, index) => TrafficCRM.recordContact('+31 6 1234 5678', {now: now + index})));
      const all = await TrafficCRM.listAll();
      return {newCount: results.filter(result => result.isNew).length, matching: all.filter(customer => customer.phone === '31612345678').length};
    });
    ok('Concurrent contact events create exactly one new customer', concurrent.newCount === 1 && concurrent.matching === 1);

    const scoped = await page.evaluate(async() => {
      const phone = '+86 132 8265 5871';
      const firstTime = new Date(2026, 8, 10, 15, 0, 0).getTime();
      const secondTime = new Date(2026, 8, 10, 16, 0, 0).getTime();
      const firstAccount = await TrafficCRM.ensureCustomer(phone, {accountId: 'a', now: firstTime});
      const secondAccount = await TrafficCRM.ensureCustomer(phone, {accountId: 'b', now: secondTime});
      await TrafficCRM.setStatus(phone, 'deal', {accountId: 'b', now: secondTime + 1000});
      return {
        firstAccount,
        secondAccount,
        a: await TrafficCRM.getCustomer(phone, {accountId: 'a'}),
        b: await TrafficCRM.getCustomer(phone, {accountId: 'b'}),
        reportA: await TrafficCRM.getDailyReport('2026-09-10', {accountId: 'a'}),
        reportB: await TrafficCRM.getDailyReport('2026-09-10', {accountId: 'b'})
      };
    });
    ok('Same phone can be tracked independently per WhatsApp account', scoped.firstAccount.isNew === true && scoped.secondAccount.isNew === true && scoped.a.status === 'following' && scoped.b.status === 'deal');
    ok('Account-scoped reports do not merge deal customers', scoped.reportA.newCustomers === 1 && scoped.reportA.dealCustomers === 0 && scoped.reportB.newCustomers === 1 && scoped.reportB.dealCustomers === 1);
    ok('Legacy unscoped records remain visible to the original account', (await page.evaluate(() => TrafficCRM.getDailyReport('2026-09-09', {accountId: 'a'}))).newCustomers === 1);

    const status = await page.evaluate(async() => {
      const firstDeal = new Date(2026, 8, 9, 10, 0, 0).getTime();
      const secondClick = new Date(2026, 8, 9, 11, 0, 0).getTime();
      const deal = await TrafficCRM.setStatus('+31 6 1234 5678', 'deal', {now: firstDeal});
      const repeated = await TrafficCRM.setStatus('+31 6 1234 5678', 'deal', {now: secondClick});
      const following = await TrafficCRM.setStatus('+31 6 1234 5678', 'following', {now: secondClick});
      return {deal, repeated, following, firstDeal};
    });
    ok('Deal transition stores dealTimestamp', status.deal.status === 'deal' && status.deal.dealTimestamp === status.firstDeal);
    ok('Repeated deal click preserves original dealTimestamp', status.repeated.dealTimestamp === status.firstDeal);
    ok('Following transition clears dealTimestamp only', status.following.status === 'following' && status.following.dealTimestamp === null && status.following.firstContactDate === '2026-09-09');

    const report = await page.evaluate(async() => {
      const day = (hour) => new Date(2026, 8, 9, hour, 0, 0).getTime();
      await TrafficCRM.ensureCustomer('+420 777 000 001', {now: day(10)});
      await TrafficCRM.ensureCustomer('+420 777 000 002', {now: day(11)});
      await TrafficCRM.ensureCustomer('+44 7700 000 001', {now: day(12)});
      await TrafficCRM.setStatus('+420 777 000 001', 'deal', {now: day(13)});
      await TrafficCRM.setStatus('+44 7700 000 001', 'deal', {now: day(14)});
      return TrafficCRM.getDailyReport('2026-09-09');
    });
    ok('Daily report counts strictly deduplicated first contacts', report.newCustomers === 4);
    ok('Daily report counts current deal state', report.dealCustomers === 2);
    ok('Conversion rate is deterministic', report.conversionRate === 50);
    ok('Country distribution is sorted by count', report.countryDistribution[0].country === '捷克' && report.countryDistribution[0].count === 2 && report.countryDistribution[0].percentage === 50);
    ok('Historical customer is excluded from selected day', report.customers.every(customer => customer.firstContactDate === '2026-09-09'));

    const csv = await page.evaluate(() => TrafficCRM.buildCsv('2026-09-09'));
    ok('CSV starts with UTF-8 BOM and requested columns', csv.startsWith('\uFEFF号码,国家,进粉时间,成交状态\r\n'));
    ok('CSV contains deal and following rows', csv.includes('已成交') && csv.includes('正在跟进'));
    ok('CSV exports normalized phone numbers', csv.includes('420777000001'));

    const downloadPromise = page.waitForEvent('download');
    const downloadResultPromise = page.evaluate(() => TrafficCRM.downloadCsv('2026-09-09'));
    const download = await downloadPromise;
    const downloadResult = await downloadResultPromise;
    ok('CSV download uses date-specific filename', download.suggestedFilename() === '超级翻译-进粉报表-2026-09-09.csv' && downloadResult.count === 4);

    await page.reload();
    const persisted = await page.evaluate(() => TrafficCRM.getCustomer('+420777000001'));
    ok('IndexedDB data survives renderer reload', persisted && persisted.status === 'deal');
    ok('No renderer errors', pageErrors.length === 0);
  } finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  console.log(JSON.stringify({passed: checks.length, checks}, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
