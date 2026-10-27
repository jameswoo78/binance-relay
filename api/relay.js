// 币安模拟盘（demo-fapi）中转（Vercel 版，固定在日本东京机房）
const TARGET = "https://demo-fapi.binance.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "X-MBX-APIKEY,Content-Type",
  "Access-Control-Max-Age": "86400",
};
const where = () => "中转位置 " + (process.env.VERCEL_REGION || "?");
function take(qs, name) {
  const re = new RegExp("(^|&)" + name + "=([^&]*)");
  const m = qs.match(re);
  if (!m) return [qs, null];
  const rest = qs.replace(re, "").replace(/^&/, "");
  return [rest, decodeURIComponent(m[2])];
}
module.exports = async (req, res) => {
  for (const k in CORS) res.setHeader(k, CORS[k]);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const i = req.url.indexOf("?");
  let qs = i >= 0 ? req.url.slice(i + 1) : "";
  let path, pick;
  [qs, path] = take(qs, "relay_path");
  [qs, pick] = take(qs, "relay_pick");
  let dbg; [qs, dbg] = take(qs, "relay_debug");
  if (path == null) { res.statusCode = 403; return res.end("only /fapi/ paths are allowed"); }
  path = "/fapi/" + path.replace(/^\/+/, "");
  if (dbg) { res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ 收到的原始地址: req.url, 转给币安的地址: TARGET + path + (qs ? "?" + qs : ""), 中转位置: process.env.VERCEL_REGION || "?" })); }
  const h = { "User-Agent": "Mozilla/5.0 (compatible; relay)", "Accept": "application/json" };
  if (req.headers["x-mbx-apikey"]) h["X-MBX-APIKEY"] = req.headers["x-mbx-apikey"];
  const send = (code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
  let r, t;
  try { r = await fetch(TARGET + path + (qs ? "?" + qs : ""), { method: req.method, headers: h }); t = await r.text(); }
  catch (e) { return send(502, { code: -1, msg: "relay cannot reach Binance: " + e.message + " [" + where() + "]" }); }
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) {
    if (j && typeof j.msg === "string") { j.msg += " [" + where() + "]"; return send(r.status, j); }
    return send(r.status, { code: -1, msg: "币安返回 HTTP " + r.status + "：" + t.slice(0, 120) + " [" + where() + "]" });
  }
  if (pick && path === "/fapi/v1/exchangeInfo" && j) {
    const want = new Set(pick.split(","));
    j.symbols = (j.symbols || []).filter((x) => want.has(x.symbol)); delete j.rateLimits;
    return send(200, j);
  }
  res.statusCode = r.status; res.setHeader("Content-Type", "application/json"); res.end(t);
};
