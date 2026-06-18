// GET /api/cloudflare/projects - 获取 Cloudflare Pages 和 Workers 项目

interface Env {
  CLOUDFLARE_API_TOKEN: string
  CLOUDFLARE_ACCOUNT_ID: string
}

interface CloudflareProject {
  id: string
  name: string
  type: 'pages' | 'workers'
  url: string
  created_at: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // 检查认证
  if (!context.data.isAuthenticated) {
    return Response.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  const apiToken = context.env.CLOUDFLARE_API_TOKEN
  const accountId = context.env.CLOUDFLARE_ACCOUNT_ID

  if (!apiToken || !accountId) {
    return Response.json({
      success: false,
      error: 'Cloudflare API credentials not configured'
    }, { status: 500 })
  }

  try {
    const projects: CloudflareProject[] = []

    // 获取 Pages 项目
    try {
      const pagesResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (pagesResponse.ok) {
        const pagesData = await pagesResponse.json() as any
        if (pagesData.success && pagesData.result) {
          for (const project of pagesData.result) {
            // 获取项目的自定义域名
            let customDomain = ''
            try {
              const domainsResponse = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project.name}/domains`,
                {
                  headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              )

              if (domainsResponse.ok) {
                const domainsData = await domainsResponse.json() as any
                if (domainsData.success && domainsData.result) {
                  // 优先使用自定义域名（非 .pages.dev）
                  const customDomains = domainsData.result.filter((d: any) =>
                    !d.name.endsWith('.pages.dev')
                  )
                  if (customDomains.length > 0) {
                    customDomain = customDomains[0].name
                  }
                }
              }
            } catch (error) {
              console.error(`Failed to fetch domains for ${project.name}:`, error)
            }

            // 确定最终 URL
            let projectUrl = ''
            if (customDomain) {
              projectUrl = `https://${customDomain}`
            } else if (project.subdomain) {
              projectUrl = `https://${project.subdomain}.pages.dev`
            } else {
              projectUrl = `https://${project.name}.pages.dev`
            }

            projects.push({
              id: project.id,
              name: project.name,
              type: 'pages',
              url: projectUrl,
              created_at: project.created_on
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch Pages projects:', error)
    }

    // 获取 Workers 项目
    try {
      const workersResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (workersResponse.ok) {
        const workersData = await workersResponse.json() as any
        if (workersData.success && workersData.result) {
          for (const worker of workersData.result) {
            let workerUrl = ''

            // 尝试获取 Workers 自定义域名
            try {
              const domainsResponse = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/domains`,
                {
                  headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              )

              if (domainsResponse.ok) {
                const domainsData = await domainsResponse.json() as any

                if (domainsData.success && domainsData.result) {
                  // 查找匹配当前 worker 的域名
                  const workerDomain = domainsData.result.find((d: any) =>
                    d.service === worker.id || d.script === worker.id
                  )
                  if (workerDomain) {
                    workerUrl = `https://${workerDomain.hostname}`
                  }
                }
              }
            } catch (error) {
              console.error(`Failed to fetch domains for worker ${worker.id}:`, error)
            }

            // 如果没有找到自定义域名，尝试获取路由
            if (!workerUrl) {
              try {
                const routesResponse = await fetch(
                  `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${worker.id}/routes`,
                  {
                    headers: {
                      'Authorization': `Bearer ${apiToken}`,
                      'Content-Type': 'application/json'
                    }
                  }
                )

                if (routesResponse.ok) {
                  const routesData = await routesResponse.json() as any
                  if (routesData.success && routesData.result?.[0]) {
                    const pattern = routesData.result[0].pattern
                    // 移除通配符和路径，只保留域名
                    const domain = pattern.replace(/\*/g, '').split('/')[0]
                    workerUrl = `https://${domain}`
                  }
                }
              } catch (error) {
                console.error(`Failed to fetch routes for worker ${worker.id}:`, error)
              }
            }

            // 如果还是没有，使用 workers.dev 域名
            if (!workerUrl) {
              workerUrl = `https://${worker.id}.workers.dev`
            }

            projects.push({
              id: worker.id,
              name: worker.id,
              type: 'workers',
              url: workerUrl,
              created_at: worker.created_on || new Date().toISOString()
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch Workers projects:', error)
    }

    return Response.json({
      success: true,
      projects
    })

  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message || 'Failed to fetch Cloudflare projects'
    }, { status: 500 })
  }
}
