import { apiCallWithRetry, ParamCheckEntity, ResponseCode } from "./common.ts";
import { Credential } from "../../kv/credential.ts";
import { get } from "../../utils/request.ts";

const allowedAssetHosts = [
  "weread.qq.com",
  "res.weread.qq.com",
  "rescdn.qqmail.com",
  "weread-1258476243.file.myqcloud.com",
  "wfqqreader-1252317822.image.myqcloud.com",
];

export function isAllowedAssetUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" &&
      allowedAssetHosts.includes(url.hostname);
  } catch {
    return false;
  }
}

export async function downloadAsset(req: Request) {
  const params: ParamCheckEntity[] = [
    {
      name: "token",
      from: "query",
      statusCode: ResponseCode.CredentialError,
      statusText: "token无效",
    },
    {
      name: "url",
      from: "query",
      statusCode: ResponseCode.ParamError,
      statusText: "url不能为空",
    },
  ];

  return await apiCallWithRetry(req, params, ({ url }, _: Credential) => {
    if (!isAllowedAssetUrl(url)) {
      return new Response("不允许代理该资源", { status: 403 });
    }
    return get(new URL(url).href);
  });
}
