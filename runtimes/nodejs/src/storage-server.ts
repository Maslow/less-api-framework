import * as http from 'http'
import Config from './config'
import { logger } from './support/logger'
import './support/cloud-sdk'
import { WebsiteHostingChangeStream } from './support/database-change-stream/website-hosting-change-stream'
import axios, { AxiosError } from 'axios'

const tryPath = (bucket: string, path: string): string[] => {
  return path.endsWith('/')
    ? [`/${bucket}${path}index.html`, `/${bucket}/index.html`]
    : [
        `/${bucket}${path}`,
        `/${bucket}${path}/index.html`,
        `/${bucket}/index.html`,
      ]
}

const websiteHostingPathHandler = async (
  host: string,
  url: string,
): Promise<string> => {
  const websiteHosting = WebsiteHostingChangeStream.websiteHosting.find(
    (item) => host === item.domain,
  )
  if (!websiteHosting) {
    return url
  }

  const minioUrl = new URL(url, Config.OSS_INTERNAL_ENDPOINT)

  const paths = tryPath(websiteHosting.bucketName, minioUrl.pathname)

  for (const path of paths) {
    minioUrl.pathname = path
    try {
      await axios.head(minioUrl.toString())
      // Url.pathname only contain path eg: /path , Url.search only contain query string eg: ?query=string
      return minioUrl.pathname + minioUrl.search
    } catch (err) {
      if ((err as AxiosError).response?.status !== 404) {
        break
      }
    }
  }
  return url // If all paths are unavailable, the original url string is returned.
}

const storageServer = http.createServer(
  async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const headers = {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'true',
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers)
      res.end()
      return
    }

    try {
      const proxyReqUrl = new URL(Config.OSS_INTERNAL_ENDPOINT)
      const reqHost = new URL(`${req.headers['x-forwarded-proto']}://${req.headers.host}`)
      const path = await websiteHostingPathHandler(
        reqHost.hostname || '',
        req.url || '',
      )

      const proxyReq = http.request({
        host: proxyReqUrl.hostname,
        port: proxyReqUrl.port,
        headers: req.headers,
        method: req.method,
        path: path, // contain query string eg: /path?query=string
      })

      proxyReq.on('response', (proxyRes: http.IncomingMessage) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
        proxyRes.pipe(res)
      })

      proxyReq.on('error', (err) => {
        req.emit('close')
        proxyReq.emit('close')
        logger.error('Proxy request error:', err)
        if (!res.headersSent) {
          res.writeHead(500)
          res.end('Internal Server Error')
        }
      })

      proxyReq.on('close', () => {
        proxyReq.removeAllListeners()
        proxyReq.destroy()
      })

      req.on('aborted', () => {
        proxyReq.emit('close')
        req.emit('close')
        if (!res.headersSent) {
          res.writeHead(504)
        }
        res.end()
      })

      req.on('close', () => {
        req.removeAllListeners()
        req.destroy()
      })

      req.on('error', (err) => {
        req.emit('close')
        proxyReq.emit('close')
        logger.error('Source request error:', err)
        if (!res.headersSent) {
          res.writeHead(500)
          res.end('Internal Server Error')
        }
      })

      req.pipe(proxyReq)
    } catch (err) {
      logger.error('Error handling request:', err)
      if (!res.headersSent) {
        res.writeHead(500)
        res.end('Internal Server Error')
      }
    }
  },
)

storageServer.listen(Config.STORAGE_PORT, () => {
  logger.info(
    `Storage server ${process.pid} listened on ${Config.STORAGE_PORT}`,
  )
})

export default storageServer
