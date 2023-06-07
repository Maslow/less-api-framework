import * as path from 'node:path'
import * as fs from 'node:fs'
import {
  dependencyControllerAdd,
  dependencyControllerGetDependencies,
  dependencyControllerUpdate,
} from '../../api/v1/application'
import { PACKAGE_FILE } from '../../common/constant'
import { CreateDependencyDto, UpdateDependencyDto } from '../../api/v1/data-contracts'
import { waitApplicationState } from '../../common/wait'
import { getEmoji } from '../../util/print'
import { AppSchema } from '../../schema/app'
import { ProjectSchema } from '../../schema/project'
import { getAppPath } from '../../util/sys'

export async function add(dependencyName: string, options: { targetVersion: string }) {
  const appSchema = AppSchema.read()
  const dependencyDto: CreateDependencyDto = {
    name: dependencyName,
    spec: 'latest',
  }
  if (options.targetVersion) {
    dependencyDto.spec = options.targetVersion
  }
  await dependencyControllerAdd(appSchema.appid, [dependencyDto])
  await waitApplicationState('Running')

  await pullOne()

  console.log(`${getEmoji('✅')} dependency ${dependencyDto.name}:${dependencyDto.spec} installed`)
  console.log(`${getEmoji('👉')} please run \`npm install\` to install dependency`)
}

export async function pull() {
  await pullOne()
  console.log(`${getEmoji('✅')} dependency pulled`)
  console.log(`${getEmoji('👉')} please run 'npm install' install dependencies`)
}

async function pullOne(updateYaml: boolean = true) {
  const appSchema = AppSchema.read()

  const dependencies = await dependencyControllerGetDependencies(appSchema.appid)

  const packagePath = path.resolve(getAppPath(), PACKAGE_FILE)
  let packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
  const devDependencies = {}
  const localDependencies = {}
  for (let dependency of dependencies) {
    devDependencies[dependency.name] = dependency.spec

    // add a non-built-in dependency
    if (!dependency.builtin) {
      localDependencies[dependency.name] = dependency.spec
    }
  }
  packageJson.devDependencies = devDependencies
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))

  // write to config
  if (updateYaml) {
    const projectSchema = ProjectSchema.read()
    projectSchema.spec.dependencies = localDependencies
    ProjectSchema.write(projectSchema)
  }
}

export async function push() {
  const appSchema = AppSchema.read()

  const serverDependencies = await dependencyControllerGetDependencies(appSchema.appid)
  const serverDependenciesMap = new Map<string, boolean>()
  for (let item of serverDependencies) {
    serverDependenciesMap.set(item.name, true)
  }

  const projectSchema = ProjectSchema.read()

  for (let key in projectSchema.spec.dependencies) {
    if (!serverDependenciesMap.has(key)) {
      const createDependencyDto: CreateDependencyDto = {
        name: key,
        spec: projectSchema.spec.dependencies[key],
      }
      await dependencyControllerAdd(appSchema.appid, [createDependencyDto])
    } else {
      const updateDependencyDto: UpdateDependencyDto = {
        name: key,
        spec: projectSchema.spec.dependencies[key],
      }
      await dependencyControllerUpdate(appSchema.appid, [updateDependencyDto])
    }
  }
  // update package.json
  await pullOne(false)
  console.log(`${getEmoji('✅')} dependency pushed`)
  console.log(`${getEmoji('👉')} please run 'npm install' install dependencies`)
}
