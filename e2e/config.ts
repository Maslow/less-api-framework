import * as dotenv from 'dotenv'

dotenv.config()

export class Config {
  static get DOMAIN() {
    if (!process.env.DOMAIN) throw new Error('DOMAIN is not set')
    return process.env.DOMAIN
  }

  static get API_ENDPOINT() {
    return process.env.API_ENDPOINT || `http://api.${Config.DOMAIN}`
  }

  static get MONGO_URI() {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set')
    return process.env.MONGO_URI
  }

  static get APISIX_ADMIN_URL() {
    if (!process.env.APISIX_ADMIN_URL)
      throw new Error('APISIX_ADMIN_URL is not set')
    return (
      process.env.APISIX_ADMIN_URL ||
      `http://${Config.DOMAIN}:9180/apisix/admin`
    )
  }

  static get APISIX_ADMIN_KEY() {
    if (!process.env.APISIX_ADMIN_KEY)
      throw new Error('APISIX_ADMIN_KEY is not set')
    return process.env.APISIX_ADMIN_KEY
  }

  static get TEST_USERNAME() {
    return process.env.TEST_USERNAME || 'testing-e2e-user'
  }

  static get TEST_PASSWORD() {
    return process.env.TEST_PASSWORD || 'testing-e2e-password'
  }

  static get TEST_APP_NAME() {
    return process.env.TEST_APP_NAME || 'testing-e2e-application-name'
  }

  static get TEST_APPID() {
    if (!process.env.TEST_APPID) throw new Error('TEST_APPID is not set')
    return process.env.TEST_APPID
  }
}
