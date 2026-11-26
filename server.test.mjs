import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { createPanelServer, restoreSecureCookiePrefixForUpstream, rewriteSetCookieForHttp } from './server.mjs'

describe('panel reverse proxy server', () => {
  const servers = []
  const tmpDirs = []

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map((s) => new Promise((resolve) => s.close(() => resolve())))
    )
    for (const dir of tmpDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('strips __Secure- prefix and Secure attribute for HTTP cookies', () => {
    const rewritten = rewriteSetCookieForHttp([
      '__Secure-paperclip-default.session_token=abc123; Path=/; HttpOnly; SameSite=Lax; Secure',
      '__Host-csrf=xyz; Path=/; Secure',
    ])
    assert.deepEqual(rewritten, [
      'paperclip-default.session_token=abc123; Path=/; HttpOnly; SameSite=Lax',
      'csrf=xyz; Path=/',
    ])
  })

  it('proxies /api/ requests with trusted origin and rewrites session cookies over HTTP', async () => {
    const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-dist-'))
    tmpDirs.push(distDir)
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html>ok</html>')

    let seenOrigin = ''
    let seenCookie = ''
    const mockUpstream = http.createServer((req, res) => {
      seenOrigin = String(req.headers.origin ?? '')
      seenCookie = String(req.headers.cookie ?? '')
      if (req.url === '/api/auth/sign-in/email') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie':
            '__Secure-paperclip-default.session_token=tok123; Path=/; HttpOnly; SameSite=Lax; Secure',
        })
        res.end(JSON.stringify({ ok: true }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ cookie: seenCookie }))
    })
    await new Promise((resolve) => mockUpstream.listen(0, '127.0.0.1', () => resolve()))
    servers.push(mockUpstream)
    const upAddr = mockUpstream.address()

    const panel = createPanelServer({
      distDir,
      upstreamUrl: `http://127.0.0.1:${upAddr.port}`,
      publicOrigin: 'https://paperclip.masterjf-solucoes.com.br',
    })
    await new Promise((resolve) => panel.listen(0, '127.0.0.1', () => resolve()))
    servers.push(panel)
    const panelAddr = panel.address()

    const signInRes = await fetch(`http://127.0.0.1:${panelAddr.port}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://152.53.108.68:5174' },
      body: '{}',
    })
    assert.equal(signInRes.status, 200)
    assert.equal(seenOrigin, 'https://paperclip.masterjf-solucoes.com.br')
    const setCookie = signInRes.headers.get('set-cookie') || ''
    assert.match(setCookie, /paperclip-default\.session_token=tok123/)
    assert.equal(setCookie.includes('__Secure-'), false)
    assert.equal(/;\s*Secure\b/i.test(setCookie), false)

    const sessionRes = await fetch(`http://127.0.0.1:${panelAddr.port}/api/auth/get-session`, {
      headers: { Cookie: 'other=1; paperclip-default.session_token=tok123' },
    })
    assert.deepEqual(await sessionRes.json(), {
      cookie: 'other=1; __Secure-paperclip-default.session_token=tok123',
    })
    assert.equal(
      restoreSecureCookiePrefixForUpstream('__Secure-paperclip-default.session_token=already'),
      '__Secure-paperclip-default.session_token=already'
    )
  })
})
