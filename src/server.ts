import { fs } from "./deps.ts";
import { routeApi } from "./router.ts";

const pattern = new URLPattern({ pathname: "/(api|cron)/:name+" });

Deno.serve(async (req: Request) => {
  const matchResult = pattern.exec(req.url);
  if (matchResult) {
    // api请求
    return routeApi(matchResult.pathname.input, req);
  } else {
    // 静态页面请求
    const response = await fs.serveDir(req, {
      fsRoot: "src/frontend/www",
      quiet: true,
    });
    if (/\.(?:css|js|png|jpe?g|gif|svg|woff2?)$/i.test(new URL(req.url).pathname)) {
      response.headers.set("Cache-Control", "public, max-age=3600");
    }
    return response;
  }
});
