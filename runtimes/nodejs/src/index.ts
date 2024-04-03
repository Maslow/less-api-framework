/*
 * @Author: Maslow<wangfugen@126.com>
 * @Date: 2021-07-30 10:30:29
 * @LastEditTime: 2022-01-20 13:55:22
 * @Description:
 */

import express from 'express'
import cors from 'cors'

import { parseToken, splitBearerToken } from './support/token'
import Config from './config'
import { router } from './handler/router'
import { logger } from './support/logger'
import { GetClientIPFromRequest, generateUUID } from './support/utils'
import { WebSocketAgent } from './support/ws'
import { DatabaseAgent } from './db'
import xmlparser from 'express-xml-bodyparser'

// init static method of class
import './support/cloud-sdk'
import { DatabaseChangeStream } from './support/database-change-stream'
import url from 'url'

import { LspWebSocket } from './support/lsp'
import { createCloudSdk } from './support/cloud-sdk'
import { FunctionCache } from './support/engine'
import storageServer from './storage-server'

require('source-map-support').install({
  emptyCacheBetweenOperations: true,
  overrideRetrieveFile: true,
  retrieveFile: (path) => FunctionCache.get(path)?.source.compiled,
})

// hack: set createCloudSdk to global object to make it available in @lafjs/cloud package
globalThis.createCloudSdk = createCloudSdk

const app = express()

if (Config.IS_DOCKER_PRODUCT) {
  FunctionCache.initialize()
  storageServer.close()
} else {
  DatabaseAgent.ready.then(() => {
    DatabaseChangeStream.initialize()
  })
}

app.use(
  cors({
    origin: true,
    methods: '*',
    exposedHeaders: '*',
    credentials: true,
    maxAge: 86400,
  }),
)

// fix x-real-ip while gateway not set
app.use((req, _res, next) => {
  if (!req.headers['x-real-ip']) {
    req.headers['x-real-ip'] = GetClientIPFromRequest(req)
  }
  next()
})

app.use(express.json({ limit: Config.REQUEST_LIMIT_SIZE }) as any)
app.use(
  express.urlencoded({
    limit: Config.REQUEST_LIMIT_SIZE,
    extended: true,
  }) as any,
)
app.use(
  express.raw({
    limit: Config.REQUEST_LIMIT_SIZE,
  }) as any,
)

app.use(xmlparser())

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Caught unhandledRejection:`, reason, promise)
})

process.on('uncaughtException', (err) => {
  logger.error(`Caught uncaughtException:`, err)
})

/**
 * Parsing bearer token
 */
app.use(function (req, res, next) {
  const token = splitBearerToken(req.headers['authorization'] ?? '')
  const auth = parseToken(token) || null
  req['user'] = auth

  const requestId = (req['requestId'] =
    req.headers['x-request-id'] || generateUUID())
  res.set('request-id', requestId)
  next()
})

app.use(router)

const server = app.listen(Config.PORT, () =>
  logger.info(`server ${process.pid} listened on ${Config.PORT}`),
)

/**
 * WebSocket upgrade & connect
 */
server.on('upgrade', (req, socket, head) => {
  const pathname = req.url ? url.parse(req.url).pathname : undefined
  if (pathname === '/_/lsp') {
    LspWebSocket.handleUpgrade(req, socket, head)
    return
  }

  WebSocketAgent.server.handleUpgrade(req, socket as any, head, (client) => {
    WebSocketAgent.server.emit('connection', client, req)
  })
})

process.on('SIGTERM', gracefullyExit)
process.on('SIGINT', gracefullyExit)

async function gracefullyExit() {
  await DatabaseAgent.accessor.close()
  server.close()
  if (!Config.IS_DOCKER_PRODUCT) {
    storageServer.close()
  }
  logger.info('process gracefully exited!')
  process.exit(0)
}
