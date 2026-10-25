// 校验所有插件的导出是否合法（不联网）
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const providersDir = path.join(root, 'providers')

const stubCtx = new Proxy({}, { get: () => () => undefined })
const sandbox = { console, fetch: async () => ({ ok: false, json: async () => ({}) }), URL, URLSearchParams, setTimeout, clearTimeout, Promise, Math, JSON, Date }
sandbox.globalThis = sandbox
const context = vm.createContext(sandbox)

let failed = 0
const files = fs.readdirSync(providersDir).filter((name) => name.endsWith('.js'))

for (const file of files) {
  const full = path.join(providersDir, file)
  const problems = []

  try {
    const source = fs.readFileSync(full, 'utf8')
    const module = { exports: {} }
    const fn = vm.runInContext('(function (module, exports, ctx) {\n' + source + '\n})', context, { filename: full })
    fn(module, module.exports, stubCtx)
    const provider = module.exports.default || module.exports

    if (!provider || typeof provider !== 'object') problems.push('没有导出对象')
    else {
      if (typeof provider.search !== 'function') problems.push('缺少 search 方法')
      if (provider.login) {
        if (provider.login.type !== 'webview') problems.push('login.type 目前只支持 webview')
        if (!provider.login.url) problems.push('login.url 缺失')
        if (!Array.isArray(provider.login.cookies) || provider.login.cookies.length === 0) problems.push('login.cookies 必须是非空数组')
      }
      if (provider.apiVersion === 2) {
        for (const name of ['search', 'getMediaSource', 'getLyric', 'getUserPlaylists', 'getPlaylistTracks', 'me']) {
          const fn2 = provider[name]
          if (typeof fn2 === 'function' && fn2.length === 0) problems.push(name + ' 在 apiVersion 2 下应声明 (ctx, ...) 参数')
        }
      }
      if (provider.lib || provider.requires) problems.push('不应声明 lib/requires 字段')
    }
  } catch (error) {
    problems.push('加载失败：' + error.message)
  }

  if (problems.length > 0) {
    failed += 1
    console.log('✗ ' + file)
    for (const problem of problems) console.log('    - ' + problem)
  } else {
    console.log('✓ ' + file)
  }
}

console.log('')
console.log(failed === 0 ? '全部通过（' + files.length + ' 个插件）' : failed + ' 个插件有问题')
process.exit(failed === 0 ? 0 : 1)
