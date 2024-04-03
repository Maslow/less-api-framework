/*
 * @Author: Maslow<wangfugen@126.com>
 * @Date: 2021-08-16 15:29:15
 */

import { MongoAccessor } from 'database-proxy'
import Config from './config'
import { MongoClient } from 'mongodb'
import { logger } from './support/logger'

/**
 * Database Management
 */
export class DatabaseAgent {
  private static _accessor: MongoAccessor
  private static _client: MongoClient
  static ready = this.initialize()

  /**
   * Mongo client
   */
  static get client() {
    return this._client
  }

  /**
   * Database instance
   */
  static get db() {
    return this.client.db()
  }

  static async initialize() {
    if (Config.IS_DOCKER_PRODUCT && Config.DOCKER_PRODUCT_MONGO === false) {
      return
    }

    const client = new MongoClient(Config.DB_URI)

    let retryDelay = 1000 // 1s
    const maxDelay = 30 * 1000 // 30s

    while (true) {
      try {
        this._client = await client.connect()
        logger.info('db connected')
        return this._client
      } catch (error) {
        if (retryDelay > maxDelay) {
          retryDelay = 1000
          logger.warn('connect db failed, try again...')
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        retryDelay *= 2
      }
    }
  }

  /**
   * MongoAccessor instance of database-proxy
   */
  static get accessor() {
    if (!this._accessor) {
      this._accessor = new MongoAccessor(this.client)
      this._accessor.logger.level = 0
    }
    return this._accessor
  }
}
