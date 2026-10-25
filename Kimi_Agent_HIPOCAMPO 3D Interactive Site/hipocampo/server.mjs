import { createServer } from 'node:http'
import { readFile } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompress, gzip, constants as zlibConstants } from 'node:zlib'
import { promisify } from 'node:util'

const brotliCompressAsync = promisify(brotliCompress)
const gzipAsync = promisify(gzip)

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const publicRoot = path.join(projectRoot, 'public')
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 8443)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

const compressibleExtensions = new Set([
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.svg',
  '.html',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
])

const compressionCache = new Map()

function resolveRequest(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname)

  if (pathname === '/' || pathname === '/index.html') {
    return path.join(projectRoot, 'index.html')
  }

  const requestedFile = path.resolve(publicRoot, pathname.slice(1))
  const isPublicFile =
    requestedFile === publicRoot || requestedFile.startsWith(publicRoot + path.sep)

  return isPublicFile ? requestedFile : null
}

function getCacheControl(requestUrl, requestedFile, pathname) {
  if (pathname === '/' || pathname === '/index.html' || requestedFile.endsWith('index.html')) {
    return 'no-cache'
  }

  const urlObj = new URL(requestUrl, 'http://localhost')
  if (urlObj.searchParams.has('v')) {
    return 'public, max-age=31536000, immutable'
  }

  const ext = path.extname(requestedFile).toLowerCase()
  const baseName = path.basename(requestedFile)

  if (/-[A-Za-z0-9_-]{8,}\./.test(baseName)) {
    return 'public, max-age=31536000, immutable'
  }

  if (['.woff2', '.woff', '.ttf', '.otf'].includes(ext) || pathname.startsWith('/fonts/')) {
    return 'public, max-age=31536000, immutable'
  }

  if (['.webp', '.png', '.jpg', '.jpeg', '.svg'].includes(ext) || pathname.startsWith('/images/')) {
    return 'public, max-age=31536000, immutable'
  }

  return 'no-cache'
}

async function getPayload(requestedFile, contents, ext, acceptEncoding) {
  if (!compressibleExtensions.has(ext) || contents.length < 120) {
    return { data: contents, encoding: null }
  }

  const acceptsBr = /\bbr\b/.test(acceptEncoding)
  const acceptsGzip = /\bgzip\b/.test(acceptEncoding)

  if (!acceptsBr && !acceptsGzip) {
    return { data: contents, encoding: null }
  }

  const encoding = acceptsBr ? 'br' : 'gzip'
  const cacheKey = `${requestedFile}:${encoding}:${contents.length}`
  const cached = compressionCache.get(cacheKey)
  if (cached) {
    return { data: cached, encoding }
  }

  let compressed
  if (acceptsBr) {
    compressed = await brotliCompressAsync(contents, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
      },
    })
  } else {
    compressed = await gzipAsync(contents, {
      level: 6,
    })
  }

  compressionCache.set(cacheKey, compressed)
  return { data: compressed, encoding }
}

const server = createServer((request, response) => {
  const urlObj = new URL(request.url || '/', 'http://localhost')
  const pathname = decodeURIComponent(urlObj.pathname)
  const requestedFile = resolveRequest(request.url || '/')

  if (!requestedFile) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  readFile(requestedFile, async (error, contents) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500)
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Internal server error')
      return
    }

    const ext = path.extname(requestedFile).toLowerCase()
    const contentType = contentTypes[ext] || 'application/octet-stream'
    const cacheControl = getCacheControl(request.url || '/', requestedFile, pathname)
    const acceptEncoding = request.headers['accept-encoding'] || ''

    try {
      const { data, encoding } = await getPayload(requestedFile, contents, ext, acceptEncoding)

      const headers = {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Content-Length': data.length,
      }

      if (encoding) {
        headers['Content-Encoding'] = encoding
        headers['Vary'] = 'Accept-Encoding'
      }

      response.writeHead(200, headers)
      if (request.method === 'HEAD') {
        response.end()
      } else {
        response.end(data)
      }
    } catch {
      response.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Content-Length': contents.length,
      })
      response.end(contents)
    }
  })
})

server.listen(port, host, () => {
  console.log('HIPOCAMPO disponível em http://' + host + ':' + port)
})
