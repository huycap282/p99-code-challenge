import express from 'express'
import 'reflect-metadata'
import { ResourceController } from './controllers/resource.controller'
import { AppDataSource } from './database/dataSource'
import { ResourceRepository } from './repositories/resource.repository'
import { createResourceRouter } from './routes/resource.routes'
import { ResourceService } from './services/resource.service'
import { errorHandler } from './middlewares/errorHandler'
import { swaggerSpec } from './swagger'

const PORT = process.env.PORT ?? 3000

async function bootstrap() {
  await AppDataSource.initialize()
  console.log('Database connected')

  const app = express()
  app.use(express.json())
  app.get('/docs/swagger.json', (_req, res) => res.json(swaggerSpec))
  app.get('/docs', (_req, res) => {
    res.send(`<!DOCTYPE html>
      <html>
        <head>
          <title>Resource API Docs</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
          <script>
            SwaggerUIBundle({ url: "/docs/swagger.json", dom_id: "#swagger-ui" });
          </script>
        </body>
      </html>`)
  })

  const resourceRepository = new ResourceRepository(AppDataSource)
  const resourceService = new ResourceService(resourceRepository)
  const resourceController = new ResourceController(resourceService)

  app.use('/api/resources', createResourceRouter(resourceController))

  app.use(errorHandler)

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
