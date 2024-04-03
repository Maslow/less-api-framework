/*
 * @Author: Maslow<wangfugen@126.com>
 * @Date: 2021-07-30 10:30:29
 * @LastEditTime: 2022-02-03 00:32:16
 * @Description:
 */

import { Router } from 'express'
import multer from 'multer'
import * as path from 'path'
import { handleDatabaseProxy } from './db-proxy'
import { handlePackageTypings } from './typings'
import { generateUUID } from '../support/utils'
import { handleInvokeFunction } from './invoke'
import { DatabaseAgent } from '../db'
import Config from '../config'
import {
  handleCloudFunctionTarPackage,
  handleDockerFile,
} from './docker-file-handler'

/**
 * multer uploader config
 */
const uploader = multer({
  storage: multer.diskStorage({
    filename: (_req, file, cb) => {
      const { ext } = path.parse(file.originalname)
      cb(null, generateUUID() + ext)
    },
  }),
  fileFilter(_req, file, callback) {
    // solve the problem of garbled unicode names
    file.originalname = Buffer.from(file.originalname, 'latin1').toString(
      'utf8',
    )
    callback(null, true)
  },
})

export const router = Router()

router.post('/proxy/:policy', handleDatabaseProxy)
router.get('/_/typing/package', handlePackageTypings)
router.get(
  `/_/${process.env.SERVER_SECRET}/cloud_functions/tar`,
  handleCloudFunctionTarPackage,
)
router.get(
  `/_/${process.env.SERVER_SECRET}/cloud_functions/dockerfile`,
  handleDockerFile,
)

router.get('/_/healthz', (_req, res) => {
  if (Config.IS_DOCKER_PRODUCT) {
    res.status(200).send('ok')
    return
  }

  if (DatabaseAgent.client) {
    res.status(200).send('ok')
  } else {
    res.status(503).send('db is not ready')
  }
})

/**
 * Invoke cloud function through HTTP request.
 * @method *
 */
// router.all('/:name', uploader.any(), handleInvokeFunction)
router.all('*', uploader.any(), (req, res) => {
  let func_name = req.path

  // remove the leading slash
  if (func_name.startsWith('/')) {
    func_name = func_name.slice(1)
  }

  // check length
  if (func_name.length > 256) {
    return res.status(500).send('function name is too long')
  }

  req.params['name'] = func_name
  handleInvokeFunction(req, res)
})
