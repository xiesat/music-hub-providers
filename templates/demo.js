// 最小可运行的音源插件示例（iTunes 公开搜索接口，无需登录）
// 复制到 ../providers/demo.js 后即可在应用「音源插件」页导入体验
module.exports = {
  apiVersion: 2,
  platform: { id: 'demo', name: '演示音源（iTunes）' },
  capabilities: ['search'],

  async search(ctx, query, page) {
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
