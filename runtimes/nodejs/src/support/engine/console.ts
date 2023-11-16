import * as util from 'util'
import chalk from 'chalk'
import { padStart } from 'lodash'
import Config from '../../config'
import { isObject } from '../utils'

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export class Console {
  category: string

  constructor(category: string) {
    this.category = category
  }

  protected _format(level: LogLevel, ...params: any[]): string {
    const time = chalk.gray(new Date().toISOString())
    let levelStr = padStart(level, 5, ' ')
    if (level === LogLevel.INFO) {
      levelStr = chalk.gray(levelStr)
    } else {
      levelStr = this._colorize(level, levelStr)
    }

    const fn = chalk.blueBright(`[${this.category}]`)

    const content = params
      .map((param) => {
        if (typeof param === 'string') return this._colorize(level, param)
        if (isObject(param)) {
          return this._colorize(
            level,
            util.inspect(param, { depth: Config.LOG_DEPTH, colors: true }),
          )
        }
        return this._colorize(level, param)
      })
      .join(' ')

    // content = this._colorize(level, content)
    const data = `${time} ${levelStr} ${fn} ${content}`
    return data
  }

  debug(...params: any[]) {
    if (!this._shouldLog(LogLevel.DEBUG)) return
    const data = this._format(LogLevel.DEBUG, ...params)
    console.debug(data)
  }

  info(...params: any[]) {
    if (!this._shouldLog(LogLevel.INFO)) return
    const data = this._format(LogLevel.INFO, ...params)
    console.info(data)
  }

  log(...params: any[]) {
    if (!this._shouldLog(LogLevel.INFO)) return
    const data = this._format(LogLevel.INFO, ...params)
    console.log(data)
  }

  warn(...params: any[]) {
    if (!this._shouldLog(LogLevel.WARN)) return
    const data = this._format(LogLevel.WARN, ...params)
    console.warn(data)
  }

  error(...params: any[]) {
    if (!this._shouldLog(LogLevel.ERROR)) return
    const data = this._format(LogLevel.ERROR, ...params)
    console.error(data)
  }

  protected _colorize(level: LogLevel, data: any) {
    let result = data
    switch (level) {
      case LogLevel.DEBUG:
        result = chalk.cyan(data)
        break
      case LogLevel.WARN:
        result = chalk.yellow(data)
        break
      case LogLevel.ERROR:
        result = chalk.red(data)
        break
      default:
        result = data
        break
    }
    return result
  }

  protected _shouldLog(level: LogLevel) {
    const LogLevelValue = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
    }
    const configLevel = (Config.LOG_LEVEL || 'debug').toUpperCase()
    const configLevelValue = LogLevelValue[configLevel] ?? 0
    return LogLevelValue[level] >= configLevelValue
  }
}

export class DebugConsole extends Console {
  constructor(category: string) {
    super(category)
  }

  private _logs: string[] = []

  protected _format(level: LogLevel, ...params: any[]): string {
    const data = super._format(level, ...params)
    this._logs.push(data)
    return data
  }

  getLogs() {
    return JSON.stringify(this._logs)
  }
}
