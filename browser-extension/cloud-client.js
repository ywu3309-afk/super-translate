(function(root) {
  'use strict';
  const messages = {
    invalid: '账号或密码不正确。请使用超级翻译客户账号，不是后台管理员账号。',
    unauthorized: '登录已失效，请重新登录。', pending: '账号等待开通，请联系管理员配置套餐。',
    disabled: '账号已停用，请联系管理员。', expired: '套餐已到期，请续费后使用。',
    quota_exceeded: '字符额度不足，请补充额度后重试。', device_limit_reached: '已达到账号设备数量限制，请联系管理员。',
    invalid_request: '文字过长或目标语言不受支持，请分段翻译。',
    provider_not_configured: '云端翻译服务尚未配置，请联系管理员。',
    provider_unavailable: '云端翻译服务暂不可用，请稍后重试。', provider_error: '云端翻译服务请求失败，请稍后重试。',
    network: '无法连接云端。请求未自动重试；若已提交翻译，请先刷新额度再决定是否重试。',
    timeout: '云端响应超时。为避免重复扣费，不会自动重试；请先刷新额度。',
    rate_limit: '请求过于频繁，请稍后重试。', invalid_response: '云端响应格式异常，请稍后重试。',
    server_error: '云端服务暂时异常，请稍后重试。'
  };
  class CloudError extends Error {
    constructor(code, status=0) { super(messages[code] || messages.server_error); this.code=code; this.status=status; }
  }
  function create(origin, fetcher=fetch) {
    const base=new URL(origin);
    if(base.protocol!=='https:' || base.username || base.password || base.pathname!=='/' || base.search || base.hash) throw new Error('Invalid cloud origin');
    const allowed=new Set(['/api/customer-login','/api/customer-usage','/api/customer-heartbeat','/api/translate','/api/health']);
    async function request(path,{token='',body,method=body===undefined?'GET':'POST'}={}) {
      if(!allowed.has(path)) throw new Error('Unknown cloud route');
      let response;
      try {
        response=await fetcher(base.origin+path,{method,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000),headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
      } catch(error) { throw new CloudError(/TimeoutError|AbortError/.test(error?.name)?'timeout':'network'); }
      let data;try { data=await response.json(); } catch { throw new CloudError('invalid_response',response.status); }
      if(!response.ok || data?.ok!==true) {
        const code=response.status===429?'rate_limit':Object.hasOwn(messages,data?.error)?data.error:response.status===401?'unauthorized':'server_error';
        throw new CloudError(code,response.status);
      }
      return data;
    }
    return Object.freeze({request});
  }
  const api={create,CloudError};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.STCloudClient=api;
})(globalThis);
