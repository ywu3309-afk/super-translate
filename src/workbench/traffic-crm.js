(function trafficCrmModule(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.TrafficCRM = api;
})(typeof globalThis === 'object' ? globalThis : this, function createTrafficCrmModule() {
  'use strict';

  const DB_NAME = 'TrafficCRM_DB';
  // Version 2 adds an accountId index without changing the existing phone
  // keyPath.  Existing unscoped records remain readable and are treated as
  // belonging to the original account (`a`) during the compatibility window.
  const DB_VERSION = 2;
  const STORE_NAME = 'customers';
  const SCOPE_SEPARATOR = '\u0000';
  const LEGACY_ACCOUNT_ID = 'a';
  const VALID_STATUSES = new Set(['following', 'deal']);
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  // Keep this table in descending prefix-length order. The ISO code is
  // converted to a flag at runtime so country labels stay valid UTF-16 and
  // cannot be corrupted by a source-file encoding conversion.
  function countryFlag(iso) {
    const code = String(iso || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return '🌐';
    return String.fromCodePoint(...[...code].map(char => 0x1F1E6 + char.charCodeAt(0) - 65));
  }
  const CALLING_CODES = Object.freeze([
    // Europe
    ['30','希腊','GR'],['31','荷兰','NL'],['32','比利时','BE'],['33','法国','FR'],['34','西班牙','ES'],
    ['36','匈牙利','HU'],['39','意大利','IT'],['40','罗马尼亚','RO'],['41','瑞士','CH'],['43','奥地利','AT'],
    ['44','英国','GB'],['45','丹麦','DK'],['46','瑞典','SE'],['47','挪威','NO'],['48','波兰','PL'],['49','德国','DE'],
    ['350','直布罗陀','GI'],['351','葡萄牙','PT'],['352','卢森堡','LU'],['353','爱尔兰','IE'],['354','冰岛','IS'],
    ['355','阿尔巴尼亚','AL'],['356','马耳他','MT'],['357','塞浦路斯','CY'],['358','芬兰','FI'],['359','保加利亚','BG'],
    ['370','立陶宛','LT'],['371','拉脱维亚','LV'],['372','爱沙尼亚','EE'],['373','摩尔多瓦','MD'],['374','亚美尼亚','AM'],
    ['375','白俄罗斯','BY'],['376','安道尔','AD'],['377','摩纳哥','MC'],['378','圣马力诺','SM'],['380','乌克兰','UA'],
    ['381','塞尔维亚','RS'],['382','黑山','ME'],['383','科索沃','XK'],['385','克罗地亚','HR'],['386','斯洛文尼亚','SI'],
    ['387','波斯尼亚和黑塞哥维那','BA'],['389','北马其顿','MK'],['420','捷克','CZ'],['421','斯洛伐克','SK'],
    ['423','列支敦士登','LI'],['7','俄罗斯','RU'],
    // Middle East and Africa
    ['20','埃及','EG'],['27','南非','ZA'],['211','南苏丹','SS'],['212','摩洛哥','MA'],['213','阿尔及利亚','DZ'],
    ['216','突尼斯','TN'],['218','利比亚','LY'],['220','冈比亚','GM'],['221','塞内加尔','SN'],['222','毛里塔尼亚','MR'],
    ['223','马里','ML'],['224','几内亚','GN'],['225','科特迪瓦','CI'],['226','布基纳法索','BF'],['227','尼日尔','NE'],
    ['228','多哥','TG'],['229','贝宁','BJ'],['230','毛里求斯','MU'],['231','利比里亚','LR'],['232','塞拉利昂','SL'],
    ['233','加纳','GH'],['234','尼日利亚','NG'],['235','乍得','TD'],['236','中非','CF'],['237','喀麦隆','CM'],
    ['238','佛得角','CV'],['239','圣多美和普林西比','ST'],['240','赤道几内亚','GQ'],['241','加蓬','GA'],['242','刚果（布）','CG'],
    ['243','刚果（金）','CD'],['244','安哥拉','AO'],['245','几内亚比绍','GW'],['246','迪戈加西亚','IO'],['248','塞舌尔','SC'],
    ['249','苏丹','SD'],['250','卢旺达','RW'],['251','埃塞俄比亚','ET'],['252','索马里','SO'],['253','吉布提','DJ'],
    ['254','肯尼亚','KE'],['255','坦桑尼亚','TZ'],['256','乌干达','UG'],['257','布隆迪','BI'],['258','莫桑比克','MZ'],
    ['260','赞比亚','ZM'],['261','马达加斯加','MG'],['262','留尼汪','RE'],['263','津巴布韦','ZW'],['264','纳米比亚','NA'],
    ['265','马拉维','MW'],['266','莱索托','LS'],['267','博茨瓦纳','BW'],['268','斯威士兰','SZ'],['269','科摩罗','KM'],
    ['290','圣赫勒拿','SH'],['291','厄立特里亚','ER'],['297','阿鲁巴','AW'],['298','法罗群岛','FO'],['299','格陵兰','GL'],
    ['960','马尔代夫','MV'],['961','黎巴嫩','LB'],['962','约旦','JO'],['963','叙利亚','SY'],['964','伊拉克','IQ'],
    ['965','科威特','KW'],['966','沙特','SA'],['967','也门','YE'],['968','阿曼','OM'],['970','巴勒斯坦','PS'],['971','阿联酋','AE'],
    ['972','以色列','IL'],['973','巴林','BH'],['974','卡塔尔','QA'],['975','不丹','BT'],
    // Asia-Pacific
    ['60','马来西亚','MY'],['61','澳大利亚','AU'],['62','印尼','ID'],['63','菲律宾','PH'],['64','新西兰','NZ'],
    ['65','新加坡','SG'],['66','泰国','TH'],['81','日本','JP'],['82','韩国','KR'],['84','越南','VN'],['86','中国大陆','CN'],
    ['880','孟加拉国','BD'],['886','中国台湾','TW'],['90','土耳其','TR'],['91','印度','IN'],['92','巴基斯坦','PK'],
    ['93','阿富汗','AF'],['94','斯里兰卡','LK'],['95','缅甸','MM'],['98','伊朗','IR'],['992','塔吉克斯坦','TJ'],
    ['993','土库曼斯坦','TM'],['994','阿塞拜疆','AZ'],['995','格鲁吉亚','GE'],['996','吉尔吉斯斯坦','KG'],['998','乌兹别克斯坦','UZ'],
    // Americas and Caribbean
    ['1','美国/加拿大','US'],['51','秘鲁','PE'],['52','墨西哥','MX'],['53','古巴','CU'],['54','阿根廷','AR'],['55','巴西','BR'],
    ['56','智利','CL'],['57','哥伦比亚','CO'],['58','委内瑞拉','VE'],['500','福克兰群岛','FK'],['501','伯利兹','BZ'],
    ['502','危地马拉','GT'],['503','萨尔瓦多','SV'],['504','洪都拉斯','HN'],['505','尼加拉瓜','NI'],['506','哥斯达黎加','CR'],
    ['507','巴拿马','PA'],['508','圣皮埃尔和密克隆','PM'],['509','海地','HT'],['590','瓜德罗普/圣巴泰勒米','GP'],['591','玻利维亚','BO'],
    ['592','圭亚那','GY'],['593','厄瓜多尔','EC'],['594','法属圭亚那','GF'],['595','巴拉圭','PY'],['596','马提尼克','MQ'],
    ['597','苏里南','SR'],['598','乌拉圭','UY'],['599','库拉索/荷属加勒比','CW']
  ].map(([prefix, country, iso]) => ({prefix, country, flag: country === '美国/加拿大' ? '🇺🇸/🇨🇦' : countryFlag(iso)})).sort((a, b) => b.prefix.length - a.prefix.length));

  function normalizePhone(value) {
    // NFKC makes full-width digits deterministic before all non-digits are
    // removed.  The stored key intentionally never contains a leading '+'.
    return String(value == null ? '' : value).normalize('NFKC').replace(/\D/g, '');
  }

  function normalizeAccountId(value) {
    if (value === undefined || value === null || value === '') return null;
    const id = String(value).trim().replace(/[\u0000\r\n]/g, '_').slice(0, 120);
    return id || null;
  }

  function requestedAccountId(options) {
    if (typeof options === 'string') return normalizeAccountId(options);
    return normalizeAccountId(options?.accountId ?? options?.scope);
  }

  // The original database used phone as the primary key.  Keep that shape for
  // account `a` and legacy callers, while using a composite physical key for
  // every additional account.  `customerPhone` preserves the user-facing
  // normalized phone number in scoped records.
  function physicalPhoneKey(phone, accountId) {
    const scope = normalizeAccountId(accountId);
    return scope && scope !== LEGACY_ACCOUNT_ID ? `${scope}${SCOPE_SEPARATOR}${phone}` : phone;
  }

  function parseStoredIdentity(value) {
    const raw = String(value?.phone ?? '');
    const storedPhone = String(value?.customerPhone ?? '');
    if (storedPhone) return {phone: storedPhone, accountId: normalizeAccountId(value?.accountId)};
    const separator = raw.indexOf(SCOPE_SEPARATOR);
    if (separator > 0) return {phone: raw.slice(separator + 1), accountId: normalizeAccountId(raw.slice(0, separator))};
    return {phone: raw, accountId: normalizeAccountId(value?.accountId)};
  }

  function storedAccountId(value) {
    const identity = parseStoredIdentity(value);
    return identity.accountId || LEGACY_ACCOUNT_ID;
  }

  function matchesAccount(value, accountId) {
    const requested = normalizeAccountId(accountId);
    if (!requested) return true;
    return storedAccountId(value) === requested || (requested === LEGACY_ACCOUNT_ID && !value?.accountId && !String(value?.phone ?? '').includes(SCOPE_SEPARATOR));
  }

  function requirePhone(value) {
    const phone = normalizePhone(value);
    if (!phone) throw new TypeError('客户电话号码为空。');
    if (phone.length > 24) throw new RangeError('客户电话号码过长。');
    return phone;
  }

  function resolveCountry(value) {
    const phone = normalizePhone(value);
    if (!phone) return {country: '未知', flag: '🌐', callingCode: ''};
    const match = CALLING_CODES.find(entry => phone.startsWith(entry.prefix));
    return match
      ? {country: match.country, flag: match.flag, callingCode: `+${match.prefix}`}
      : {country: '未知', flag: '🌐', callingCode: ''};
  }

  function resolvedLocation(value, options = {}) {
    const fallback = resolveCountry(value);
    const country = String(options.country || '').trim().slice(0, 60);
    const countryCode = String(options.countryCode || '').trim().toUpperCase();
    // The desktop host resolves the complete international number with
    // libphonenumber. Prefer that authoritative result for shared calling
    // codes such as +1; keep the local table as a renderer-startup fallback.
    if (country && /^[A-Z]{2}$/.test(countryCode)) {
      return {country, flag: countryFlag(countryCode), callingCode: fallback.callingCode};
    }
    return fallback;
  }

  function requireTimestamp(value) {
    if (value === undefined || value === null) return Date.now();
    const timestamp = value instanceof Date ? value.getTime() : Number(value);
    if (!Number.isFinite(timestamp)) throw new TypeError('时间戳无效。');
    return Math.trunc(timestamp);
  }

  function localDate(value) {
    const date = value instanceof Date ? value : new Date(requireTimestamp(value));
    if (!Number.isFinite(date.getTime())) throw new TypeError('日期无效。');
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function requireDate(value) {
    const date = value === undefined || value === null || value === '' ? localDate(Date.now()) : String(value);
    if (!DATE_PATTERN.test(date)) throw new TypeError('日期必须为 YYYY-MM-DD 格式。');
    const [year, month, day] = date.split('-').map(Number);
    const check = new Date(year, month - 1, day);
    if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) {
      throw new TypeError('日期不存在。');
    }
    return date;
  }

  function formatTimestamp(value) {
    if (value === null || value === undefined || value === '') return '';
    const date = new Date(requireTimestamp(value));
    const day = localDate(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day} ${hours}:${minutes}:${seconds}`;
  }

  function cloneCustomer(value) {
    if (!value) return null;
    const identity = parseStoredIdentity(value);
    return {
      phone: String(identity.phone),
      firstContactDate: String(value.firstContactDate),
      firstContactTimestamp: Number(value.firstContactTimestamp),
      country: String(value.country || '未知'),
      flag: String(value.flag || '🌐'),
      status: VALID_STATUSES.has(value.status) ? value.status : 'following',
      dealTimestamp: Number.isFinite(value.dealTimestamp) ? Number(value.dealTimestamp) : null
    };
  }

  function csvCell(value) {
    const text = String(value == null ? '' : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB 请求失败。'));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB 事务已中止。'));
      transaction.onerror = () => {};
    });
  }

  class TrafficCRMStorage {
    constructor(options = {}) {
      this.name = options.name || DB_NAME;
      this.version = DB_VERSION;
      this.indexedDB = options.indexedDB || (typeof globalThis === 'object' ? globalThis.indexedDB : null);
      this.databasePromise = null;
    }

    open() {
      if (!this.indexedDB) return Promise.reject(new Error('当前环境不支持 IndexedDB。'));
      if (this.databasePromise) return this.databasePromise;
      this.databasePromise = new Promise((resolve, reject) => {
        const request = this.indexedDB.open(this.name, this.version);
        request.onupgradeneeded = () => {
          const database = request.result;
          const store = database.objectStoreNames.contains(STORE_NAME)
            ? request.transaction.objectStore(STORE_NAME)
            : database.createObjectStore(STORE_NAME, {keyPath: 'phone'});
          if (!store.indexNames.contains('firstContactDate')) store.createIndex('firstContactDate', 'firstContactDate', {unique: false});
          if (!store.indexNames.contains('status')) store.createIndex('status', 'status', {unique: false});
          if (!store.indexNames.contains('country')) store.createIndex('country', 'country', {unique: false});
          if (!store.indexNames.contains('dealTimestamp')) store.createIndex('dealTimestamp', 'dealTimestamp', {unique: false});
          if (!store.indexNames.contains('accountId')) store.createIndex('accountId', 'accountId', {unique: false});
        };
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => {
            database.close();
            this.databasePromise = null;
          };
          resolve(database);
        };
        request.onerror = () => {
          this.databasePromise = null;
          reject(request.error || new Error('TrafficCRM_DB 打开失败。'));
        };
        request.onblocked = () => {
          this.databasePromise = null;
          reject(new Error('TrafficCRM_DB 升级被其他窗口阻止，请关闭旧窗口后重试。'));
        };
      });
      return this.databasePromise;
    }

    async close() {
      if (!this.databasePromise) return;
      try {
        const database = await this.databasePromise;
        database.close();
      } finally {
        this.databasePromise = null;
      }
    }

    async ensureCustomer(value, options = {}) {
      const phone = requirePhone(value);
      const timestamp = requireTimestamp(options.now);
      const accountId = requestedAccountId(options);
      const firstContactDate = localDate(timestamp);
      const location = resolvedLocation(phone, options);
      const candidate = {
        phone: physicalPhoneKey(phone, accountId),
        customerPhone: phone,
        ...(accountId ? {accountId} : {}),
        firstContactDate,
        firstContactTimestamp: timestamp,
        country: location.country,
        flag: location.flag,
        status: 'following',
        dealTimestamp: null
      };
      const database = await this.open();

      // A single read/write transaction is intentional.  IndexedDB serializes
      // overlapping write transactions, so simultaneous chat/message events
      // cannot both create the same phone or rewrite its first-contact fields.
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        let customer = null;
        let isNew = false;
        const request = store.get(candidate.phone);
        request.onsuccess = () => {
          if (request.result) {
            customer = cloneCustomer(request.result);
            // Older records may have been created before the phone/country
            // mapping became available. Refresh only the derived location;
            // never rewrite first-contact time/date or the deal state.
            if (location.country !== '未知' && (customer.country !== location.country || customer.flag !== location.flag)) {
              customer.country = location.country;
              customer.flag = location.flag;
              // Preserve the physical scoped key and any account metadata.
              const repaired = {...request.result, ...customer, phone: request.result.phone};
              if (accountId && !repaired.accountId) repaired.accountId = accountId;
              store.put(repaired);
            }
            return;
          }
          isNew = true;
          customer = candidate;
          store.add(candidate);
        };
        request.onerror = () => transaction.abort();
        transaction.oncomplete = () => resolve({customer: cloneCustomer(customer), isNew});
        transaction.onabort = () => reject(transaction.error || request.error || new Error('客户去重写入失败。'));
        transaction.onerror = () => {};
      });
    }

    recordContact(value, options = {}) {
      return this.ensureCustomer(value, options);
    }

    async getCustomer(value, options = {}) {
      const phone = requirePhone(value);
      const accountId = requestedAccountId(options);
      const database = await this.open();
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const customerPromise = requestValue(transaction.objectStore(STORE_NAME).get(physicalPhoneKey(phone, accountId)));
      const done = transactionDone(transaction);
      const customer = await customerPromise;
      await done;
      return cloneCustomer(customer);
    }

    async setStatus(value, status, options = {}) {
      const phone = requirePhone(value);
      const accountId = requestedAccountId(options);
      if (!VALID_STATUSES.has(status)) throw new TypeError('客户状态只能为 following 或 deal。');
      const timestamp = requireTimestamp(options.now);
      const database = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        let updated = null;
        let missing = false;
        const request = store.get(physicalPhoneKey(phone, accountId));
        request.onsuccess = () => {
          if (!request.result) {
            missing = true;
            transaction.abort();
            return;
          }
          // Copy every first-contact field verbatim.  Only the two status
          // fields are allowed to change in this transaction.
          updated = cloneCustomer(request.result);
          if (status === 'deal') {
            if (updated.status !== 'deal' || !Number.isFinite(updated.dealTimestamp)) updated.dealTimestamp = timestamp;
          } else {
            updated.dealTimestamp = null;
          }
          updated.status = status;
          const persisted = {...request.result, ...updated, phone: request.result.phone};
          if (accountId && !persisted.accountId) persisted.accountId = accountId;
          store.put(persisted);
        };
        request.onerror = () => transaction.abort();
        transaction.oncomplete = () => resolve(cloneCustomer(updated));
        transaction.onabort = () => {
          if (missing) {
            const error = new Error('未找到该客户，请先记录首次联系。');
            error.code = 'CUSTOMER_NOT_FOUND';
            reject(error);
          } else {
            reject(transaction.error || request.error || new Error('客户状态保存失败。'));
          }
        };
        transaction.onerror = () => {};
      });
    }

    async listAll(options = {}) {
      const accountId = requestedAccountId(options);
      const database = await this.open();
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const valuesPromise = requestValue(transaction.objectStore(STORE_NAME).getAll());
      const done = transactionDone(transaction);
      const values = await valuesPromise;
      await done;
      return values.filter(value => matchesAccount(value, accountId)).map(cloneCustomer).sort((a, b) => a.firstContactTimestamp - b.firstContactTimestamp || a.phone.localeCompare(b.phone));
    }

    async listByDate(value, options = {}) {
      const date = requireDate(value);
      const accountId = requestedAccountId(options);
      const database = await this.open();
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).index('firstContactDate').getAll(date);
      const valuesPromise = requestValue(request);
      const done = transactionDone(transaction);
      const values = await valuesPromise;
      await done;
      return values.filter(value => matchesAccount(value, accountId)).map(cloneCustomer).sort((a, b) => a.firstContactTimestamp - b.firstContactTimestamp || a.phone.localeCompare(b.phone));
    }

    async getDailyReport(value, options = {}) {
      const date = requireDate(value);
      const customers = await this.listByDate(date, options);
      const newCustomers = customers.length;
      const dealCustomers = customers.filter(customer => customer.status === 'deal').length;
      const countries = new Map();
      for (const customer of customers) {
        const key = `${customer.flag}\u0000${customer.country}`;
        const current = countries.get(key) || {country: customer.country, flag: customer.flag, count: 0};
        current.count += 1;
        countries.set(key, current);
      }
      const countryDistribution = [...countries.values()]
        .map(item => ({...item, percentage: newCustomers ? Number((item.count * 100 / newCustomers).toFixed(2)) : 0}))
        .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country, 'zh-CN'));
      return {
        date,
        newCustomers,
        dealCustomers,
        conversionRate: newCustomers ? Number((dealCustomers * 100 / newCustomers).toFixed(2)) : 0,
        countryDistribution,
        customers
      };
    }

    getStatsByDate(value, options = {}) {
      return this.getDailyReport(value, options);
    }

    async buildCsv(value, options = {}) {
      const report = await this.getDailyReport(value, options);
      const rows = [['号码', '国家', '进粉时间', '成交状态']];
      for (const customer of report.customers) {
        rows.push([
          customer.phone,
          `${customer.flag} ${customer.country}`,
          formatTimestamp(customer.firstContactTimestamp),
          customer.status === 'deal' ? '已成交' : '正在跟进'
        ]);
      }
      return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
    }

    async downloadCsv(value, filename, options = {}) {
      if (typeof document !== 'object' || typeof Blob !== 'function' || !globalThis.URL?.createObjectURL) {
        throw new Error('当前环境不支持浏览器文件下载。');
      }
      const date = requireDate(value);
      const csv = await this.buildCsv(date, options);
      const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename || `超级翻译-进粉报表-${date}.csv`;
      anchor.hidden = true;
      document.body.append(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return {date, filename: anchor.download, count: (await this.listByDate(date, options)).length};
    }
  }

  const defaultStorage = new TrafficCRMStorage();
  return Object.freeze({
    DB_NAME,
    DB_VERSION,
    STORE_NAME,
    CALLING_CODES,
    statuses: Object.freeze({following: 'following', deal: 'deal'}),
    normalizePhone,
    resolveCountry,
    localDate,
    formatTimestamp,
    createStorage: options => new TrafficCRMStorage(options),
    open: () => defaultStorage.open(),
    close: () => defaultStorage.close(),
    ensureCustomer: (phone, options) => defaultStorage.ensureCustomer(phone, options),
    recordContact: (phone, options) => defaultStorage.recordContact(phone, options),
    getCustomer: (phone, options) => defaultStorage.getCustomer(phone, options),
    setStatus: (phone, status, options) => defaultStorage.setStatus(phone, status, options),
    listAll: options => defaultStorage.listAll(options),
    listByDate: (date, options) => defaultStorage.listByDate(date, options),
    getDailyReport: (date, options) => defaultStorage.getDailyReport(date, options),
    getStatsByDate: (date, options) => defaultStorage.getStatsByDate(date, options),
    report: (date, options) => defaultStorage.getDailyReport(date, options),
    buildCsv: (date, options) => defaultStorage.buildCsv(date, options),
    downloadCsv: (date, filename, options) => defaultStorage.downloadCsv(date, filename, options),
    exportCsv: (date, filename, options) => defaultStorage.downloadCsv(date, filename, options)
  });
});
