import { Response } from 'express'
import { IRequest } from '../support/types'
import { DEFAULT_FUNCTION_NAME, INTERCEPTOR_FUNCTION_NAME } from '../constants'
import { parseToken } from '../support/token'
import {
  FunctionExecutor,
  Console,
  DebugConsole,
  FunctionCache,
  FunctionContext,
  ICloudFunctionData,
  FunctionDebugExecutor,
} from '../support/engine'
import pako from 'pako'
import { base64ToUint8Array, isObject, uint8ArrayToBase64 } from '../support/utils'

export async function handleInvokeFunction(req: IRequest, res: Response) {
  const name = req.params?.name

  const ctx: FunctionContext = {
    __function_name: name,
    requestId: req.requestId,
    query: req.query,
    files: req.files as any,
    body: req.body,
    headers: req.headers,
    method: req.method,
    auth: req['auth'],
    user: req.user,
    request: req,
    response: res,
  }

  let useInterceptor = true
  if (!FunctionCache.get(INTERCEPTOR_FUNCTION_NAME)) {
    useInterceptor = false
  }

  // debug mode
  if (req.get('x-laf-develop-token')) {
    return await invokeDebug(ctx, useInterceptor)
  }

  return await invokeFunction(ctx, useInterceptor)
}

// invoke cloud function
async function invokeFunction(
  ctx: FunctionContext,
  useInterceptor: boolean,
): Promise<any> {
  const requestId = ctx.requestId

  // trigger mode
  let isTrigger = false
  if (parseToken(ctx.request.get('x-laf-trigger-token'))) {
    isTrigger = true
  }

  const name = ctx.__function_name

  let func = FunctionCache.get(name)
  if (!func) {
    func = FunctionCache.get(DEFAULT_FUNCTION_NAME)
    if (!func) {
      return ctx.response.status(404).send('Function Not Found')
    }
  }
  // reject while no HTTP enabled
  if (
    !func.methods.includes(ctx.request.method.toUpperCase()) &&
    !isTrigger
  ) {
    return ctx.response.status(405).send('Method Not Allowed')
  }

  const logger = new Console(func.name)
  try {
    // execute the func
    const executor = new FunctionExecutor(func)
    const result = await executor.invoke(ctx, useInterceptor)

    if (result.error) {
      logger.error(result.error)
      return ctx.response.status(500).send({
        error: 'Internal Server Error',
        requestId,
      })
    }

    // reject request if interceptor return false
    if (
      isObject(result.data) &&
      result.data.__type__ === '__interceptor__' &&
      result.data.__res__ == false
    ) {
      return ctx.response.status(403).send({ error: 'Forbidden', requestId })
    }

    if (ctx.response.writableEnded === false) {
      let data = result.data
      if (typeof result.data === 'number') {
        data = Number(result.data).toString()
      }
      return ctx.response.send(data)
    }
  } catch (error) {
    logger.error(requestId, 'failed to invoke error', error)
    return ctx.response.status(500).send('Internal Server Error')
  }
}

// invoke debug function
async function invokeDebug(
  ctx: FunctionContext,
  useInterceptor: boolean,
): Promise<any> {
  // verify the debug token
  const token = ctx.request.get('x-laf-develop-token')
  if (!token) {
    return ctx.response.status(400).send('x-laf-develop-token is required')
  }

  const auth = parseToken(token) || null
  if (auth?.type !== 'develop') {
    return ctx.response
      .status(403)
      .send('permission denied: invalid develop token')
  }

  // parse func_data
  let funcData: ICloudFunctionData

  // get func_data from header `x-laf-debug-data`
  if (ctx.request.get('x-laf-debug-data')) {
    const funcStr = ctx.request.get('x-laf-debug-data')
    try {
      // decode base64 string
      const compressed = base64ToUint8Array(funcStr)
      const restored = pako.ungzip(compressed, { to: 'string' })
      funcData = JSON.parse(restored)
    } catch (error) {
      return ctx.response.status(400).send('x-laf-debug-data is invalid')
    }
  } else if (ctx.request.get('x-laf-func-data')) {
    // reserve 'x-laf-func-data' check to keep compatible to old clients (laf-web, laf-cli)
    const funcStr = ctx.request.get('x-laf-func-data')
    try {
      const decoded = decodeURIComponent(funcStr)
      funcData = JSON.parse(decoded)
    } catch (error) {
      return ctx.response.status(400).send('x-laf-func-data is invalid')
    }
  } else {
    return ctx.response.status(400).send('x-laf-debug-data is required')
  }

  const requestId = ctx.requestId
  const funcName = ctx.request.params?.name

  if (!funcData) {
    return ctx.response.send({
      code: 1,
      error: 'function data not found',
      requestId,
    })
  }
  const debugConsole = new DebugConsole(funcName)
  const executor = new FunctionDebugExecutor(funcData, debugConsole)

  try {
    // execute the func
    ctx.__function_name = funcName
    const result = await executor.invoke(ctx, useInterceptor)

    // set logs to response header
    if (result.error) {
      debugConsole.error(result.error)
    }

    const logs = debugConsole.getLogs()
    if (ctx.request.get('x-laf-debug-data')) {
      const compressed = pako.gzip(logs)
      const base64Encoded = uint8ArrayToBase64(compressed)
      ctx.response.set('x-laf-debug-logs', base64Encoded)
    } else if (ctx.request.get('x-laf-func-data')) {
      // keep compatible for old version clients(laf web & laf cli)
      const encoded = encodeURIComponent(logs)
      ctx.response.set('x-laf-func-logs', encoded)
    }

    ctx.response.set('x-laf-debug-time-usage', result.time_usage.toString())

    if (result.error) {
      return ctx.response.status(500).send({
        error: 'Internal Server Error',
        requestId,
      })
    }

    // reject request if interceptor return false
    if (
      isObject(result.data) &&
      result.data.__type__ === '__interceptor__' &&
      result.data.__res__ == false
    ) {
      return ctx.response.status(403).send({ error: 'Forbidden', requestId })
    }

    if (ctx.response.writableEnded === false) {
      let data = result.data
      if (typeof result.data === 'number') {
        data = Number(result.data).toString()
      }
      return ctx.response.send(data)
    }
  } catch (error) {
    debugConsole.error(requestId, 'failed to invoke error', error)
    return ctx.response.status(500).send('Internal Server Error')
  }
}
