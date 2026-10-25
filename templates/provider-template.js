// 新音源插件模板（v2 协议）
// 复制本文件到 providers/<平台>.js，改掉 platform / login / 各方法即可
var BASE = 'https://example.com'

module.exports = {
  apiVersion: 2,

  // 名字会显示在「音源插件」页
  platform: { id: 'example', name: '示例平台' },

  // 写明这个插件支持哪些能力，宿主据此决定 UI 行为
  capabilities: ['search'],

  // 需要登录时才写；不需要就整段删掉
  // login: {
  //   type: 'webview',
  //   url: BASE + '/login',
  //   cookies: ['SESSION']
  // },

  // 登录后返回 uid / 昵称，宿主用它做歌单导入
  // async me(ctx) {
  //   const profile = await ctx.get(BASE + '/api/me')
  //   return { uid: String(profile.id), nickname: profile.name }
  // },

  // 搜索：返回 [{ id, title, artist, album, duration, cover }]
  async search(ctx, query, page) {
    const json = await ctx.get(BASE + '/api/search', { q: query, page: page || 1 })
    return (json.items || []).map((item) => ({
      id: String(item.id),
      title: item.name,
      artist: item.artist,
      album: item.album,
      duration: item.durationMs,
      cover: item.coverUrl
    }))
  },

  // 取流：返回 { url } 或 null
  // async getMediaSource(ctx, track) {
  //   const json = await ctx.get(BASE + '/api/url', { id: track.id })
  //   return json.url ? { url: json.url } : null
  // },

  // 歌词：返回 { lrc }
  // async getLyric(ctx, track) {
  //   const json = await ctx.get(BASE + '/api/lyric', { id: track.id })
  //   return { lrc: json.lrc || '' }
  // }
}
