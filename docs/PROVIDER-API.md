# 插件协议（Provider API）

## 基本形态

插件是一个 CommonJS 文件，导出对象：

```js
module.exports = {
  apiVersion: 2,
  platform: { id: 'netease', name: '网易云音乐' },
  capabilities: ['search', 'stream', 'lyric', 'playlist', 'auth'],
  login: { type: 'webview', url: '...', cookies: ['MUSIC_U'] },
  async search(ctx, query, page) {},
  async getMediaSource(ctx, track) {},
  async getLyric(ctx, track) {},
  async getUserPlaylists(ctx, uid) {},
  async getPlaylistTracks(ctx, id) {},
  async me(ctx) {}
}
```

`apiVersion: 2` → 所有方法第一个参数是 `ctx`。省略该字段（v1）→ 方法按老签名调用，
第一个参数就是 `query` / `track`，不提供 `ctx`。

## 方法返回值

| 方法 | 返回 |
|---|---|
| `search(ctx, query, page)` | `[{ id, title, artist, album, duration, cover }]` |
| `getMediaSource(ctx, track)` | `{ url }` 或 `null`（拿不到地址时返回 null，不要抛错） |
| `getLyric(ctx, track)` | `{ lrc }` |
| `getUserPlaylists(ctx, uid)` | `[{ id, name, trackCount, coverUrl }]` |
| `getPlaylistTracks(ctx, id)` | `{ name, tracks: [...] }` |
| `me(ctx)` | `{ uid, nickname }` 或 `null` |

`track` 形如 `{ id }`，`id` 就是 `search` 返回的 `id`。

## ctx 能力

### 请求

```js
await ctx.get(url, params?, opts?)      // params 自动拼 query 并编码；返回 JSON
await ctx.post(url, body?, opts?)       // body 为对象时按 form-urlencoded 发送；返回 JSON
await ctx.request(url, { method, headers, body })  // 完全自定义，返回 JSON
```

所有请求自动带 `User-Agent`、cookie（含登录态）。`opts.referer` 可指定 Referer。

> 注意：`params` 的值会被统一编码，**不要自己预先 encode**（否则会二次编码）。

### 登录态

```js
ctx.auth.loggedIn        // 是否有登录凭据
ctx.auth.me              // { uid, nickname } 或 null
ctx.auth.get('cookie名')  // 只读本插件自己的 cookie
```

### 加密

```js
ctx.crypto.md5(text)
ctx.crypto.sha1(text)
ctx.crypto.base64(text)
ctx.crypto.aesEcb(text, key)
ctx.crypto.aesCbc(text, key, iv)
ctx.crypto.randomHex(size)
```

### 其它

```js
ctx.mapSong(raw)          // 常见字段名归一化
ctx.error(code, message)  // 抛出带 code 的错误，如 'NEED_LOGIN' / 'RATE_LIMITED'
ctx.log(...)              // 打到宿主控制台
ctx.loadScript('./lib/x.js')  // 加载插件目录内的脚本（如平台签名算法）
ctx.global('函数名')       // 读取 loadScript 产生的全局函数
```

### ctx.loadScript 的安全边界

该能力会用 Node 的 `require` 执行插件目录内的文件，**等于信任该脚本**。
因此：只在你自己的插件里使用；不要加载来路不明的代码。
路径被限制在插件目录内，不能跳出。

## 错误码约定

| code | 含义 | 宿主行为 |
|---|---|---|
| `NEED_LOGIN` | 需要登录 | 提示用户去登录 |
| `RATE_LIMITED` | 请求过频 | 提示稍后再试 |
| `FAILED` | 其它失败 | 原样提示 |

## 沙箱限制

- 没有 `require`（除 `ctx.loadScript`）、没有 `fs`、没有 `process`
- 只能访问 http/https，内网地址被拦截
- 单次调用超时 12 秒（部分方法 20–30 秒），超时会终止 worker
