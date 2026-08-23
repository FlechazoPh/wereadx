import { get, postJSON } from "../../utils/request.ts";
import { checkErrCode } from "../err-code.ts";
import * as credentialUtil from "../../kv/credential.ts";
import type { Credential } from "../../kv/credential.ts";

// ponytail: single-process lock; use a KV lease if multiple replicas share an account.
const credentialRenewals = new Map<string, Promise<Credential>>();

export function getCredentialCookies(headers: Headers) {
  return headers.getSetCookie().reduce(
    (entry: Record<string, string>, cookie) => {
      const item = cookie.split(";", 1)[0];
      const separator = item.indexOf("=");
      if (separator < 0) return entry;
      const name = item.slice(0, separator);
      const value = item.slice(separator + 1);
      if (name === "wr_vid") entry.vid = value;
      else if (name === "wr_skey") entry.accessToken = value;
      else if (name === "wr_rt") entry.refreshToken = value;
      return entry;
    },
    {},
  );
}

/**
 * 获取uid
 */
export async function web_login_getuid() {
  const resp = await postJSON("https://weread.qq.com/web/login/getuid");
  return resp.json();
}

/**
 * 生成登录链接
 * @param uid
 */
export function web_confirm(uid: string) {
  return `https://weread.qq.com/web/confirm?pf=2&uid=${uid}`;
}

/**
 * 查询用户扫码信息
 * @param uid
 */
export async function web_login_getinfo(uid: string) {
  const resp = await postJSON("https://weread.qq.com/web/login/getinfo", {
    uid,
  });
  return resp.json();
}

/**
 * 使用扫码信息进行登录
 * @param info
 */
export async function web_login_weblogin(
  info: Record<string, string | number> = {},
) {
  delete info.redirect_uri;
  delete info.expireMode;
  delete info.pf;

  info.fp = "";
  const resp = await postJSON("https://weread.qq.com/web/login/weblogin", info);
  return resp.json();
}

/**
 * 初始化会话
 * @param info
 */
export async function web_login_session_init(
  info: Record<string, string | number> = {},
) {
  const params = {
    vid: info.vid,
    pf: 0,
    skey: info.accessToken ?? info.skey,
    rt: info.refreshToken ?? info.code,
  };
  const resp = await postJSON(
    "https://weread.qq.com/web/login/session/init",
    params,
  );
  return { ...await resp.json(), ...getCredentialCookies(resp.headers) };
}

/**
 * 刷新skey
 * @param url 原请求路径
 * @param cookie
 */
export async function web_login_renewal(url: string, cookie = "") {
  const resp = await postJSON("https://weread.qq.com/web/login/renewal", {
    rq: encodeURIComponent(url),
    ql: false,
  }, {
    cookie,
  });

  await checkErrCode(resp, cookie);

  const data = await resp.json();
  if (data.succ === 1) {
    const credential = getCredentialCookies(resp.headers);
    if (!credential.accessToken) {
      throw new Error("续期成功但未返回 wr_skey");
    }
    return credential;
  } else {
    // { errCode: -12013, errMsg: "微信登录授权已过期，继续购买需跳转到微信重新登录" }
    // { errCode: -2013, errLog: "C6LyBKI", errMsg: "鉴权失败" }
    if (data.errCode !== -12013) {
      console.warn("/web/login/renewal接口失败", data.errCode);
    }
    const error = new Error(data.errMsg);
    Object.assign(error, data);
    throw error;
  }
}

export function renewCredential(token: string, url: string) {
  const pending = credentialRenewals.get(token);
  if (pending) return pending;

  const renewal = (async () => {
    const credential = await credentialUtil.getByToken(token);
    if (!credential.token || !credential.rt) {
      throw new Error("登录凭证无效，请重新登录");
    }

    const updated = await web_login_renewal(
      url,
      credentialUtil.getCookieByCredential(credential),
    );
    credential.skey = updated.accessToken ?? credential.skey;
    credential.rt = updated.refreshToken ?? credential.rt;
    credential.updatedAt = Date.now();
    await credentialUtil.update(credential);
    return credential;
  })().finally(() => credentialRenewals.delete(token));

  credentialRenewals.set(token, renewal);
  return renewal;
}

/**
 * 通知后台前端已登录
 */
export async function web_login_notify(cookie = "") {
  const resp = await get("https://weread.qq.com/web/login/notify", {}, {
    cookie,
  });
  await checkErrCode(resp, cookie);
  return resp.json();
}
