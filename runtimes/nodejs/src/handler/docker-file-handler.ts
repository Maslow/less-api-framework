import { Response } from 'express'
import { createReadStream } from 'fs'
import fs from 'fs/promises'
import fsPromises from 'fs/promises'
import os from 'os'
import path from 'path'
import tar from 'tar'
import { pipeline } from 'stream/promises'
import { DatabaseAgent } from '../db'
import { CLOUD_FUNCTION_COLLECTION, CONFIG_COLLECTION } from '../constants'
import { ICloudFunctionData } from '../support/engine/types'
import { IRequest } from '../support/types'

// Constants for file paths
const WORKSPACE_PATH = path.join(__dirname, '../../cloud_functions')

const TEMP_DIR = path.join(os.tmpdir(), 'cloud_functions')
const TAR_FILE_NAME = 'cloud_functions.tar'
const TAR_FILE_PATH = path.join(TEMP_DIR, TAR_FILE_NAME)

// Function to write cloud function data to the workspace as JSON files
async function saveFunctionsToWorkspace(): Promise<void> {
  // Check if the workspace directory exists and delete it if it does
  try {
    await fs.rm(WORKSPACE_PATH, { recursive: true, force: true })
  } catch (err) {
    console.error('Error removing the workspace directory:', err)
  }

  await fs.mkdir(WORKSPACE_PATH, { recursive: true })

  const funcs = await DatabaseAgent.db
    .collection<ICloudFunctionData>(CLOUD_FUNCTION_COLLECTION)
    .find()
    .toArray()

  for (const func of funcs) {
    const dirPath = path.join(WORKSPACE_PATH, path.dirname(func.name))
    await fs.mkdir(dirPath, { recursive: true })
    const filePath = path.join(WORKSPACE_PATH, func.name)
    await fs.writeFile(filePath, JSON.stringify(func), 'utf8')
  }
}

// Function to create a tarball of the workspace directory
async function createTarPackage(): Promise<void> {
  // Check if the tar file exists and delete it if it does
  try {
    await fs.rm(TAR_FILE_PATH, { force: true })
  } catch (err) {
    console.error('Error removing the tar file:', err)
  }

  await fs.mkdir(TEMP_DIR, { recursive: true })

  await tar.create(
    {
      gzip: false,
      file: TAR_FILE_PATH,
      cwd: WORKSPACE_PATH,
    },
    ['.'],
  )
}

// /docker-file
export async function handleCloudFunctionTarPackage(
  _: IRequest,
  res: Response,
) {
  try {
    // Save them to the workspace directory
    await saveFunctionsToWorkspace()
    // Create a tarball of the workspace
    await createTarPackage()

    // Set headers to serve the tarball as a download
    res.writeHead(200, {
      'Content-Type': 'application/x-tar',
      'Content-Disposition': `attachment; filename="${TAR_FILE_NAME}"`,
    })
    // create file stream
    const readStream = createReadStream(TAR_FILE_PATH)

    // use pipeline pipe the file stream to response
    await pipeline(readStream, res).then(() => {
      // after pipe the file stream, remove the tar file
      fsPromises.unlink(TAR_FILE_PATH).catch((unlinkError) => {
        console.error('Error removing file:', unlinkError)
      })
    })
  } catch (error) {
    console.error('Error:', error)
    if (!res.headersSent) {
      return res.status(500).send('Internal Server Error')
    }
  }
}

export async function handleDockerFile(_: IRequest, res: Response) {
  try {
    const ENV = process.env
    const keysToInclude = [
      'DB_URI',
      'APP_ID',
      'APPID',
      'RUNTIME_DOMAIN',
      'RUNTIME_MAIN_IMAGE',

      'OSS_ACCESS_KEY',
      'OSS_ACCESS_SECRET',
      'OSS_INTERNAL_ENDPOINT',
      'OSS_EXTERNAL_ENDPOINT',
      'OSS_REGION',

      'DEPENDENCIES',

      'NODE_MODULES_PUSH_URL',
      'NODE_MODULES_PULL_URL',

      'NPM_INSTALL_FLAGS',
      'CUSTOM_DEPENDENCY_BASE_PATH',
      'RESTART_AT',
      'SERVER_SECRET',
    ]

    let envVariablesString = 'LOG_LEVEL=debug \\\n  FORCE_COLOR=1 \\\n  '

    envVariablesString += 'DOCKER_PRODUCT=true \\\n  '
    envVariablesString += 'DOCKER_PRODUCT_MONGO=false \\\n  '

    const conf = await DatabaseAgent.db
      .collection(CONFIG_COLLECTION)
      .findOne({})

    if (conf && conf.environments) {
      for (const env of conf.environments) {
        envVariablesString += `${env.name}=${env.value} \\\n  `
      }
    }

    for (const [key, value] of Object.entries(ENV)) {
      if (keysToInclude.includes(key)) {
        envVariablesString += `${key}=${value} \\\n  `
      }
    }

    envVariablesString = envVariablesString.replace(/\\\n\s*$/, '')

    // version from env  todo
    const DOCKER_FILE = `

FROM ${ENV.RUNTIME_MAIN_IMAGE} as builder
USER root

WORKDIR ${ENV.CUSTOM_DEPENDENCY_BASE_PATH}
RUN mkdir -p /app/cloud_functions && chown -R node:node /app/cloud_functions ${ENV.CUSTOM_DEPENDENCY_BASE_PATH}

USER node
RUN npm install ${ENV.DEPENDENCIES} || true

RUN curl -o /tmp/cloud_functions.tar https://${ENV.RUNTIME_DOMAIN}/_/${process.env.SERVER_SECRET}/cloud_functions/tar && tar -xf /tmp/cloud_functions.tar -C /app/cloud_functions && rm /tmp/cloud_functions.tar

FROM node:20.10.0
USER root

EXPOSE 8000
EXPOSE 9000

USER node

COPY --from=builder ${ENV.CUSTOM_DEPENDENCY_BASE_PATH} ${ENV.CUSTOM_DEPENDENCY_BASE_PATH}
COPY --from=builder /app /app

RUN ln -s ${ENV.CUSTOM_DEPENDENCY_BASE_PATH} /app/functions/node_modules

ENV ${envVariablesString}

WORKDIR /app

CMD node $FLAGS --experimental-vm-modules --experimental-fetch ./dist/index.js
`
    // 设置响应头，返回纯文本内容
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename="Dockerfile"',
    })

    res.end(DOCKER_FILE)
  } catch (error) {
    // Handle errors by sending an internal server error status and the error message
    res.status(500).send(`Error generating Dockerfile: ${error.message}`)
  }
}
