# MusicHub Providers

MusicHub 的音源插件仓库。每个插件是一个独立的 JS 文件，运行时由宿主加载，
不需要重新编译主程序。

## 目录

```
providers/            插件本体（会被同步到主程序的 resources/providers）
  netease.js          网易云：搜索 / 播放 / 歌词 / 歌单 / 登录
  qq.js               QQ 音乐：搜索 / 播放 / 歌词 / 歌单 / 登录（含签名）
  kugou.js            酷狗：搜索
  lib/                插件私有依赖（如 QQ 签名算法），不会被注册为音源
templates/            新插件脚手架
docs/                 协议文档与贡献指南
scripts/validate.mjs  校验脚本
```

## 写一个新插件

1. 复制 `templates/provider-template.js` 到 `providers/<平台>.js`
2. 实现 `search`（必需），按需实现 `getMediaSource` / `getLyric` / `getUserPlaylists` / `getPlaylistTracks`
3. 跑 `npm run validate`
4. 提 PR

## 协议要点

- 声明 `apiVersion: 2` 时，所有方法的**第一个参数是 `ctx`**
- `ctx` 提供：`get/post/request`、`crypto`（md5/aes/rsa 原语）、`auth`、`mapSong`、`error`、`log`、`loadScript`
- 详细说明见 [docs/PROVIDER-API.md](docs/PROVIDER-API.md)

## 声明式登录

```js
login: {
  type: 'webview',
  url: 'https://example.com/login',
  cookies: ['SESSION', 'token_a|token_b']
}
```

`a|b` 表示“任一存在即可”。宿主负责打开登录页、抓 cookie、加密存储，插件不用碰登录流程。
