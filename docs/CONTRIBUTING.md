# 贡献插件

## 提交前

```bash
npm run validate
```

校验会真正加载每个插件，检查导出是否完整、`login` 声明是否合法、
以及 `apiVersion: 2` 的方法签名是否为 `(ctx, ...)`。

## 规范

1. 一个平台一个文件，放在 `providers/`
2. 文件名即音源 id（`providers/foo.js` → `script:foo`）
3. 私有依赖放 `providers/lib/<插件名>/`，不要直接丢在 `providers/`
4. 不要硬编码第三方页面里抓来的 token / cookie
5. 拿不到播放地址时返回 `null`，不要抛错（避免“整首播不了还报异常”）

## 许可与来源

`providers/lib/qq-sign/` 来自用户自有的 QQ 音乐签名实现，仅用于个人学习研究。
任何插件不得用于绕过付费墙或批量分发受版权保护的内容。
