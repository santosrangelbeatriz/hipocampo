import { createServer } from 'node:http'
import { readFile } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const publicRoot = path.join(projectRoot, 'public')
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 8443)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.otf': 'font/otf',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
}

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

const server = createServer((request, response) => {
  const requestedFile = resolveRequest(request.url || '/')

  if (!requestedFile) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  readFile(requestedFile, (error, contents) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500)
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Internal server error')
      return
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(requestedFile)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    response.end(contents)
  })
})

server.listen(port, host, () => {
  console.log('HIPOCAMPO disponível em http://' + host + ':' + port)
})
