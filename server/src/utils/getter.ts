import { Condition } from 'src/region/cluster/types'
import { ApplicationNamespaceMode, Region } from 'src/region/entities/region'

/**
 * Get application namespace name by appid (in kubernetes)
 * @param appid
 * @returns
 */
export function GetApplicationNamespace(region: Region, appid: string) {
  const conf = region.namespaceConf
  if (conf?.mode === ApplicationNamespaceMode.Fixed) {
    return conf.fixed
  }

  if (conf?.mode === ApplicationNamespaceMode.AppId) {
    const prefix = conf?.prefix || ''
    return `${prefix}${appid}`
  }

  return appid
}

export function isConditionTrue(type: string, conditions: Condition[] | any[]) {
  if (!conditions) return false

  for (const condition of conditions) {
    if (condition.type === type) {
      return condition.status === 'True'
    }
  }
  return false
}
