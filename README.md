# MusicHub Providers

> MusicHub 的音源插件仓库。**每个插件是一个独立 JS 文件**，运行时由宿主加载，不需要重新编译主程序。

`GPL-3.0` · 欢迎 PR

---

## 这是什么

MusicHub 主程序本身**不包含任何平台实现**。所有「怎么搜、怎么取播放地址、怎么拿歌词」都在这个仓库里，
以普通 JavaScript 文件的形式存在：

```
providers/
  netease.js     网易云：搜索 / 播放 / 歌词 / 歌单 / 登录
  qq.js          QQ 音乐：搜索 / 播放 / 歌词 / 歌单 / 登录（含签名）
  kugou.js       酷狗：搜索
  lib/           插件私有依赖（如 QQ 签名算法），不会被当成音源注册
```

主程序启动时会把 `providers/` 里**每个 `.js` 文件**当作一个音源加载，文件名即音源 id：
`providers/foo.js` → 音源 id `script:foo`。

### 为什么单独一个仓库

| 好处 | 说明 |
|---|---|
| 独立发版 | 平台改接口时只改插件，用户重新导入脚本即可，不必等主程序发版 |
| 互不阻塞 | 插件维护者不需要懂 Electron / React |
| 更好协作 | 一个平台一个文件，PR 冲突最小 |

---

## 目录

- [5 分钟写第一个插件](#5-分钟写第一个插件)
- [插件结构参考](#插件结构参考)
- [方法契约](#方法契约)
- [ctx 速查](#ctx-速查)
- [登录（声明式）](#登录声明式)
- [私有依赖与 loadScript](#私有依赖与-loadscript)
- [本地测试](#本地测试)
- [提交 PR 全流程](#提交-pr-全流程)
- [审核标准](#审核标准)
- [发版与主程序如何引用](#发版与主程序如何引用)
- [代码红线](#代码红线)
- [现有插件导读](#现有插件导读)
- [常见问题](#常见问题)
- [许可与来源说明](#许可与来源说明)

---

## 5 分钟写第一个插件

下面是一个**可以真正跑起来**的完整插件（用 iTunes 公开搜索接口，不需要登录、不需要签名）。

新建 `providers/demo.js`：

```js
// 一个最小的 MusicHub 音源插件
module.exports = {
  apiVersion: 2,
  platform: { id: 'demo', name: '演示音源' },
  capabilities: ['search'],

  async search(ctx, query, page) {
    // ctx.get 会自动带 UA、处理 JSON 解析
    const json = await ctx.get('https://itunes.apple.com/search', {
      term: query,
      media: 'music',
      limit: 20,
      offset: ((page || 1) - 1) * 20
    })

    return (json.results || []).map((item) => ({
      id: String(item.trackId),
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName,
      duration: item.trackTimeMillis,
      cover: item.artworkUrl100
    }))
  }
}
```

保存后做两件事：

```bash
npm run validate        # 校验导出是否合法
```

然后把文件拖进应用的「音源插件」页（或点「导入音源脚本」选择它），刷新后就能在发现页选到「演示音源」了。

### 这段代码做了什么

| 行 | 作用 |
|---|---|
| `apiVersion: 2` | 声明使用 v2 协议：所有方法第一个参数是 `ctx` |
| `platform` | 显示在「音源插件」页的名字 |
| `capabilities` | 声明能力，宿主据此决定 UI（能不能播放 / 有没有歌词 / 能不能登录） |
| `async search(ctx, query, page)` | 唯一必需的方法 |
| 返回值数组 | 每项是统一的歌曲结构，宿主靠 `id` 记住这首歌 |

> `id` 是你自己的标识符，只要下次 `getMediaSource(ctx, track)` 能用它找回这首歌就行。

### 加上播放能力

```js
async getMediaSource(ctx, track) {
  const json = await ctx.get('https://example.com/api/url', { id: track.id })
  if (!json.url) return null          // 拿不到就返回 null，不要抛错
  return { url: json.url }
}
```

---

## 插件结构参考

```js
module.exports = {
  apiVersion: 2,                                  // 推荐
  platform: { id: 'netease', name: '网易云音乐' },
  capabilities: ['search', 'stream', 'lyric', 'playlist', 'auth'],

  login: {                                        // 可选
    type: 'webview',
    url: 'https://music.163.com/#/login',
    cookies: ['MUSIC_U']
  },

  async search(ctx, query, page) {},
  async getMediaSource(ctx, track) {},
  async getLyric(ctx, track) {},
  async getUserPlaylists(ctx, uid) {},
  async getPlaylistTracks(ctx, id) {},
  async me(ctx) {}
}
```

| 字段 | 必需 | 说明 |
|---|---|---|
| `apiVersion` | 推荐 | 设为 `2` 使用 `ctx` 协议；不设则按 v1 老签名调用 |
| `platform` | 必需 | `{ id, name }`，`name` 显示在界面 |
| `capabilities` | 推荐 | `search` / `stream` / `lyric` / `playlist` / `auth` |
| `login` | 可选 | 声明式登录（见下） |
| `search` | **必需** | 搜索 |
| `getMediaSource` | 可选 | 取播放地址 |
| `getLyric` | 可选 | 取歌词 |
| `getUserPlaylists` / `getPlaylistTracks` | 可选 | 歌单导入 |
| `me` | 可选 | 登录后返回 uid / 昵称 |

---

## 方法契约

| 方法 | 入参 | 返回 |
|---|---|---|
| `search(ctx, query, page)` | 关键词、页码（从 1 开始） | `[{ id, title, artist, album, duration, cover }]` |
| `getMediaSource(ctx, track)` | `{ id }` | `{ url }` 或 `null` |
| `getLyric(ctx, track)` | `{ id }` | `{ lrc }` |
| `getUserPlaylists(ctx, uid)` | uid（可能为空，回退到 `ctx.auth.me.uid`） | `[{ id, name, trackCount, coverUrl }]` |
| `getPlaylistTracks(ctx, id)` | 歌单 id | `{ name, tracks: [...] }` |
| `me(ctx)` | — | `{ uid, nickname }` 或 `null` |

`duration` 单位是**毫秒**。

---

## ctx 速查

### 请求

```js
await ctx.get(url, params?, opts?)     // params 自动拼 query 并编码，返回 JSON
await ctx.post(url, body?, opts?)      // body 为对象时按 form-urlencoded 发送
await ctx.request(url, { method, headers, body })
```

- 自动带 `User-Agent` 与 cookie（含登录态）
- `opts.referer` 可指定 Referer
- ⚠️ `params` 的值会被自动编码，**不要自己预先 encode**

### 登录态

```js
ctx.auth.loggedIn         // 是否有凭据
ctx.auth.me               // { uid, nickname } 或 null
ctx.auth.get('MUSIC_U')   // 只读本插件自己的 cookie
```

### 加密

```js
ctx.crypto.md5(text) / sha1(text) / base64(text)
ctx.crypto.aesEcb(text, key) / aesCbc(text, key, iv)
ctx.crypto.randomHex(size)
```

### 其它

```js
ctx.mapSong(raw)              // 常见字段名归一化
ctx.error('NEED_LOGIN')       // 抛出带 code 的错误
ctx.log(...)                  // 打到宿主控制台
ctx.loadScript('./lib/x.js')  // 加载插件目录内的脚本
ctx.global('fnName')          // 读取 loadScript 产生的全局函数
```

错误码约定：`NEED_LOGIN`（提示登录）、`RATE_LIMITED`（提示稍后再试）、`FAILED`（其它）。

---

## 登录（声明式）

**不要自己写登录流程。** 只需声明去哪登录、要哪些 cookie：

```js
login: {
  type: 'webview',
  url: 'https://music.163.com/#/login',
  cookies: ['MUSIC_U']
}
```

- 宿主会开一个独立窗口加载这个官方页面（账密 / 验证码 / 扫码都在页面里完成）
- 频繁轮询 cookie，出现声明项即视为登录成功
- 凭据加密存储，并按音源隔离：你的插件只能读到自己的 cookie
- `cookies` 支持「任一命中」写法：`'qqmusic_key|qm_keyst'`

登录成功后宿主会调用 `me(ctx)`，用返回的 `uid` 支持「读取我的歌单」。

---

## 私有依赖与 loadScript

有些平台要签名（如 QQ 音乐的 `musics.fcg`）。把这类代码放 `providers/lib/<插件名>/`，
然后在插件里加载：

```js
ctx.loadScript('./lib/mysign/sign.js')
const sign = ctx.global('getsign')(JSON.stringify(payload))
```

### ⚠️ 安全边界

`loadScript` 会用 Node 的 `require` 执行插件目录内的文件，**等于完全信任该脚本**。
路径被限制在插件目录内，但它自身可以访问文件系统。

- 只在自己的插件里使用
- PR 里出现 `loadScript` 时，Reviewer 必须人工审阅被加载的文件
- 不要把来路不明的第三方代码放进 `lib/`

---

## 本地测试

```bash
npm run validate
```

校验会真正加载每个插件，检查：

- 能否被解析执行
- `search` 是否存在
- `login` 声明是否合法（`type` / `url` / `cookies`）
- `apiVersion: 2` 的方法是否声明了 `ctx` 参数

更完整的测试（真实网络请求）：把文件复制到应用的插件目录，或直接在「音源插件」页导入，
然后用 `ctx.log(...)` 在宿主控制台看输出。

---

## 提交 PR 全流程

### 1. Fork 并克隆

```bash
# 在 GitHub 上点 Fork，然后
git clone https://github.com/<你的用户名>/music-hub-providers.git
cd music-hub-providers
```

### 2. 建分支

```bash
git checkout -b feat/bilibili-provider
```

分支命名建议：`feat/新平台`、`fix/某平台接口`、`docs/文档`。

### 3. 写插件并自查

```bash
npm run validate
```

### 4. 提交

```bash
git add providers/bilibili.js
git commit -m "feat: 新增 B 站音频音源"
git push origin feat/bilibili-provider
```

提交信息用 [Conventional Commits](https://www.conventionalcommits.org/) 前缀：
`feat` / `fix` / `docs` / `refactor` / `chore`。

### 5. 开 PR

PR 描述里请写清楚：

- 新增/修改了哪个平台，实现了哪些能力
- 是否需要登录、登录需要的 cookie
- 是否包含 `lib/` 私有依赖（如果有，说明来源与用途）
- 你实际测过的场景（搜索 / 播放 / 歌词 / 歌单）

### 6. CI 与 Review

CI 会自动跑 `validate`。Maintainer 会按下面的标准审阅，可能会请你补充代码或说明。

### 7. 合并

通过后由 Maintainer 合并到 `main`，你的名字会出现在提交历史里。

---

## 审核标准

Reviewer 会检查：

- [ ] `npm run validate` 通过
- [ ] 没有硬编码 cookie / token / 账号
- [ ] 拿不到播放地址时返回 `null`，而不是抛异常
- [ ] 请求有合理的 `Referer`，没有滥用高频请求
- [ ] `lib/` 里的文件已人工读过（尤其用 `loadScript` 时）
- [ ] 没有把付费墙绕过、批量抓取等能力包装成“功能”
- [ ] 文件名与平台对应，不与已有插件重名

---

## 发版与主程序如何引用

插件合并后，主程序有两种方式拿到新版本：

**方式一：用户自行导入**（立即生效）
在「音源插件」页导入新的 `.js` 文件即可，不需要主程序发版。

**方式二：写进安装包**（跟随版本）

```bash
# 打一个 tag
git tag v1.1.0 && git push origin v1.1.0
```

然后主仓库更新 `providers.lock.json`：

```json
{ "repo": "https://github.com/<你>/music-hub-providers.git", "ref": "v1.1.0" }
```

下次 `pnpm build` 会把该版本打进安装包。

---

## 代码红线

以下内容**不会被合并**：

1. 内置账号密码、抓来的 cookie、私人 token
2. 绕过平台付费机制的能力（如批量解锁 VIP 音频）
3. 批量抓取、爬全站、刷量等滥用行为
4. 把播放地址指向非官方 CDN 的中间层（有安全风险）
5. 尝试逃出沙箱（读取用户文件、发起内网请求、动态执行远程代码）

---

## 现有插件导读

想学具体写法，可以按这个顺序读：

| 文件 | 适合学什么 |
|---|---|
| `providers/kugou.js` | 最简单的搜索实现（40 行） |
| `providers/netease.js` | 搜索 + 取流 + 歌词 + 歌单 + 登录，能力最全 |
| `providers/qq.js` | 声明式登录、`loadScript` 加载签名包、错误码处理 |

`netease.js` 里几个值得注意的点：

- 播放地址要按「音质等级 + 编码」配套降级，`standard` 配 `flac` 会直接返回空
- `ids` 参数传原始 `[123]`，由 `ctx.get` 统一编码（自己再 encode 会变成 `%255B`）

---

## 常见问题

**Q：插件加载后没出现在列表里？**
A：文件名必须以 `.js` 结尾，且导出对象包含 `search` 方法。看宿主控制台有没有报错。

**Q：`ctx.get` 返回的不是 JSON？**
A：该接口可能不是 JSON，或者缺 `Referer`。用 `ctx.request` 自己控制请求头。

**Q：搜索能用但播放没声音？**
A：`getMediaSource` 返回了 `url`，但直链可能需要特定的 `Referer` 或有效期。

**Q：接口要求先访问首页拿 cookie？**
A：在插件里先 `await ctx.get(首页)`，沙箱的 cookie 罐会自动保留。

**Q：能联网下载文件吗？**
A：不能。插件只负责返回 URL，下载由宿主完成（含风险确认）。

---

## 许可与来源说明

本仓库以 **GPL-3.0** 发布，见 [LICENSE](LICENSE)。

### 例外

`providers/lib/qq-sign/` 是 QQ 音乐网页端的签名代码（webpack 产物），**不属于本仓库的原创内容**，
不适用本仓库的 MIT/GPL 授权声明，仅作为个人学习研究用途随附。详见 [NOTICE](NOTICE)。

任何插件都不得用于绕过付费墙或批量分发受版权保护的内容。
