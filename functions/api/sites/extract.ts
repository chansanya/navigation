// POST /api/sites/extract - 从 URL 自动提取站点信息

interface Env {
  // 不需要认证，任何人都能用
}

interface ExtractedInfo {
  title?: string
  description?: string
  icon?: string
}

/**
 * 验证图标是否可访问
 */
async function validateIcon(iconUrl: string): Promise<boolean> {
  try {
    // 先 HEAD 探测图标，避免把无法访问的 favicon 写入站点或投稿。
    const response = await fetch(iconUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(3000) // 3秒超时
    })
    // 200-299 和 304 都认为是成功
    return response.ok || response.status === 304
  } catch (error) {
    return false
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { url } = await context.request.json() as { url: string }

    if (!url) {
      return Response.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 })
    }

    // 验证 URL 格式
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return Response.json({
        success: false,
        error: 'Invalid URL format'
      }, { status: 400 })
    }

    const info: ExtractedInfo = {}

    try {
      // 抓取页面内容（设置 5 秒超时）
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const html = await response.text()

      // 提取标题
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        info.title = titleMatch[1].trim()
      }

      // 提取 meta description
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      if (descMatch) {
        info.description = descMatch[1].trim()
      }

      // 提取 favicon - 收集所有候选，按页面声明、默认 favicon、Google 兜底依次尝试。
      const iconCandidates: string[] = []

      // 1. link[rel="icon"]
      const iconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i)
      if (iconMatch) {
        const iconUrl = iconMatch[1]
        // 处理相对路径
        if (iconUrl.startsWith('http')) {
          iconCandidates.push(iconUrl)
        } else if (iconUrl.startsWith('//')) {
          iconCandidates.push(`${parsedUrl.protocol}${iconUrl}`)
        } else if (iconUrl.startsWith('/')) {
          iconCandidates.push(`${parsedUrl.origin}${iconUrl}`)
        } else {
          iconCandidates.push(`${parsedUrl.origin}/${iconUrl}`)
        }
      }

      // 2. 默认 favicon.ico
      iconCandidates.push(`${parsedUrl.origin}/favicon.ico`)

      // 3. Google Favicon API 作为最终降级
      iconCandidates.push(`https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=128`)

      // 逐个验证图标，找到第一个可用的
      for (const candidate of iconCandidates) {
        const isValid = await validateIcon(candidate)
        if (isValid) {
          info.icon = candidate
          break
        }
      }

      // 如果所有验证都失败，使用 Google API（最可靠）
      if (!info.icon) {
        info.icon = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=128`
      }

    } catch (error) {
      // 抓取失败，返回基础信息
      // 外部页面超时或拒绝访问时仍给前端一个可编辑的默认结果。
      info.title = parsedUrl.hostname
      info.icon = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=128`
    }

    return Response.json({
      success: true,
      info
    })

  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to extract site info'
    }, { status: 500 })
  }
}
