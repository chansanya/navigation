// GET /api/icon-proxy?url=<图标URL> - 代理图标请求，绕过防盗链

interface Env {
  // 可以添加缓存相关配置
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const iconUrl = url.searchParams.get('url')

  if (!iconUrl) {
    return Response.json({
      success: false,
      error: 'Missing url parameter'
    }, { status: 400 })
  }

  try {
    // 请求原始图标，关键：不带 Referer 和 Origin
    const response = await fetch(iconUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
      }
    })

    if (!response.ok) {
      // 图标加载失败，返回默认图标或使用第三方服务
      const domain = new URL(iconUrl).hostname
      const fallbackUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`

      const fallbackResponse = await fetch(fallbackUrl)
      if (fallbackResponse.ok) {
        return new Response(fallbackResponse.body, {
          headers: {
            'Content-Type': fallbackResponse.headers.get('Content-Type') || 'image/x-icon',
            'Cache-Control': 'public, max-age=86400', // 缓存1天
            'Access-Control-Allow-Origin': '*'
          }
        })
      }

      return new Response(null, { status: 404 })
    }

    // 返回图标，添加缓存头
    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/x-icon',
        'Cache-Control': 'public, max-age=86400', // 缓存1天
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error: any) {
    console.error('Icon proxy error:', error)
    return Response.json({
      success: false,
      error: 'Failed to fetch icon'
    }, { status: 500 })
  }
}
