import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const serveDataImportPlugin = () => ({
  name: 'serve-data-import',
  configureServer(server) {
    server.middlewares.use('/data-import', (req, res, next) => {
      const reqPath = decodeURIComponent((req.url || '').split('?')[0] || '/')
      const relativePath = reqPath.replace(/^\/+/, '')
      const safePath = path.normalize(relativePath)
      if (safePath.includes('..')) {
        res.statusCode = 400
        res.end('Invalid path')
        return
      }

      const filePath = path.resolve(process.cwd(), 'data-import', safePath)
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        next()
        return
      }

      const ext = path.extname(filePath).toLowerCase()
      const contentTypeMap = {
        '.csv': 'text/csv; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
      res.setHeader('Content-Type', contentTypeMap[ext] || 'application/octet-stream')
      fs.createReadStream(filePath).pipe(res)
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveDataImportPlugin()],
  assetsInclude: ['**/*.xlsx'],
})
