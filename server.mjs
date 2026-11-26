import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json; charset=utf-8',
}

/** Strips __Secure-/__Host- prefixes and Secure attribute so Better Auth session cookies work over HTTP. */
export function rewriteSetCookieForHttp(headerValue) {
  const rewriteOne = (cookie) =>
    String(cookie)
      .replace(/^(\s*)(__Secure-|__Host-)/i, '$1')
      .replace(/;\s*Secure\b/gi, '')
  if (Array.isArray(headerValue)) return headerValue.map(rewriteOne)
  return rewriteOne(headerValue)
}

/** Restores __Secure- prefix on Paperclip cookies sent over HTTP so Better Auth matches authCookies.sessionToken.name. */
export function restoreSecureCookiePrefixForUpstream(cookieHeader) {
  if (!cookieHeader) return cookieHeader
  return String(cookieHeader).replace(
    /(^|;\s*)(?!__Secure-)(paperclip-[^=;\s]+=)/gi,
    (_, sep, kv) => `${sep}__Secure-${kv}`
  )
}

function isHttpsRequest(req) {
  const proto = String(req.headers['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  return proto === 'https'
}

function resolveStaticFile(distDir, reqPath) {
  let decodedPath = '/'
  try {
    decodedPath = decodeURIComponent(reqPath.split('?')[0] || '/')
  } catch {
    return null
  }
  const cleanRel = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '')
  const distRoot = path.resolve(distDir)
  const candidate = path.resolve(distRoot, cleanRel)
  if (candidate !== distRoot && !candidate.startsWith(`${distRoot}${path.sep}`)) {
    return null
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate
  }
  const fallback = path.join(distRoot, 'index.html')
  return fs.existsSync(fallback) ? fallback : null
}

export function createPanelServer({
  distDir = path.resolve('dist'),
  upstreamUrl = process.env.UPSTREAM_URL || 'http://host.docker.internal:3100',
  publicOrigin = process.env.PUBLIC_ORIGIN || 'https://paperclip.masterjf-solucoes.com.br',
} = {}) {
  const upstream = new URL(upstreamUrl)
  const upstreamHost = upstream.hostname
  const upstreamPort = Number(upstream.port || (upstream.protocol === 'https:' ? 443 : 80))

  const server = http.createServer((req, res) => {
    const reqUrl = req.url || '/'

    if (reqUrl === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('healthy\n')
      return
    }

    if (reqUrl.startsWith('/api/')) {
      const headers = { ...req.headers }
      headers.origin = publicOrigin
      headers['x-forwarded-proto'] = isHttpsRequest(req) ? 'https' : 'http'
      if (headers.cookie && !isHttpsRequest(req)) {
        headers.cookie = restoreSecureCookiePrefixForUpstream(headers.cookie)
      }
      if (!headers['x-forwarded-for'] && req.socket.remoteAddress) {
        headers['x-forwarded-for'] = req.socket.remoteAddress
      }

      const proxyReq = http.request(
        {
          hostname: upstreamHost,
          port: upstreamPort,
          method: req.method,
          path: reqUrl,
          headers,
          timeout: 3600_000,
        },
        (proxyRes) => {
          const outHeaders = { ...proxyRes.headers }
          if (outHeaders['set-cookie'] && !isHttpsRequest(req)) {
            outHeaders['set-cookie'] = rewriteSetCookieForHttp(outHeaders['set-cookie'])
          }
          res.writeHead(proxyRes.statusCode || 502, outHeaders)
          proxyRes.pipe(res)
        }
      )

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: `Upstream unavailable: ${err.message}` }))
        }
      })

      req.pipe(proxyReq)
      return
    }

    const filePath = resolveStaticFile(distDir, reqUrl)
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const cacheControl = filePath.endsWith(`${path.sep}index.html`)
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=31536000, immutable'

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    })
    fs.createReadStream(filePath).pipe(res)
  })

  server.on('upgrade', (req, socket, head) => {
    const reqUrl = req.url || '/'
    if (!reqUrl.startsWith('/api/')) {
      socket.destroy()
      return
    }

    const upstreamSocket = net.connect(upstreamPort, upstreamHost, () => {
      const headerLines = [`${req.method || 'GET'} ${reqUrl} HTTP/${req.httpVersion || '1.1'}`]
      let hasOrigin = false
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const key = req.rawHeaders[i]
        const val = req.rawHeaders[i + 1]
        const lower = key.toLowerCase()
        if (lower === 'origin') {
          headerLines.push(`${key}: ${publicOrigin}`)
          hasOrigin = true
        } else if (lower === 'cookie' && !isHttpsRequest(req)) {
          headerLines.push(`${key}: ${restoreSecureCookiePrefixForUpstream(val)}`)
        } else {
          headerLines.push(`${key}: ${val}`)
        }
      }
      if (!hasOrigin) {
        headerLines.push(`Origin: ${publicOrigin}`)
      }
      upstreamSocket.write(`${headerLines.join('\r\n')}\r\n\r\n`)
      if (head?.length) upstreamSocket.write(head)
      upstreamSocket.pipe(socket)
      socket.pipe(upstreamSocket)
    })

    upstreamSocket.on('error', () => socket.destroy())
    socket.on('error', () => upstreamSocket.destroy())
  })

  return server
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isEntrypoint) {
  const port = Number(process.env.PORT || 80)
  const server = createPanelServer()
  server.listen(port, '0.0.0.0', () => {
    console.log(`painel-master-jf listening on :${port}`)
  })
}
