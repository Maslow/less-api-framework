import { Injectable, Logger } from '@nestjs/common'
import { GetApplicationNamespaceById } from '../common/getter'
import { KubernetesService } from '../core/kubernetes.service'
import { CreateFunctionDto } from './dto/create-function.dto'
import { UpdateFunctionDto } from './dto/update-function.dto'
import { CloudFunction, CloudFunctionList } from './entities/function.entity'

@Injectable()
export class FunctionsService {
  private logger = new Logger(FunctionsService.name)

  constructor(private readonly k8sClient: KubernetesService) {}

  /**
   * Create a new function
   * @param appid
   * @param dto
   * @returns
   */
  async create(appid: string, dto: CreateFunctionDto) {
    const namespace = GetApplicationNamespaceById(appid)
    const func = new CloudFunction(dto.name, namespace)
    func.spec.description = dto.description
    func.spec.methods = dto.methods
    func.spec.source.codes = dto.codes
    func.spec.websocket = dto.websocket

    try {
      const res = await this.k8sClient.objectApi.create(func)
      return res.body
    } catch (error) {
      this.logger.error(error, error?.response?.body)
      return null
    }
  }

  /**
   * Query functions of a app
   * @param appid
   * @param labelSelector
   * @returns
   */
  async findAll(appid: string, labelSelector?: string) {
    const namespace = GetApplicationNamespaceById(appid)
    const res = await this.k8sClient.customObjectApi.listNamespacedCustomObject(
      CloudFunction.GVK.group,
      CloudFunction.GVK.version,
      namespace,
      CloudFunction.GVK.plural,
      undefined,
      undefined,
      undefined,
      labelSelector,
    )

    return CloudFunctionList.fromObject(res.body as any)
  }

  /**
   * Find a function by name
   * @param appid
   * @param name
   * @returns
   */
  async findOne(appid: string, name: string) {
    const namespace = GetApplicationNamespaceById(appid)
    try {
      const res =
        await this.k8sClient.customObjectApi.getNamespacedCustomObject(
          CloudFunction.GVK.group,
          CloudFunction.GVK.version,
          namespace,
          CloudFunction.GVK.plural,
          name,
        )
      return CloudFunction.fromObject(res.body)
    } catch (err) {
      this.logger.error(err)
      if (err?.response?.body?.reason === 'NotFound') {
        return null
      }
      throw err
    }
  }

  update(id: number, updateFunctionDto: UpdateFunctionDto) {
    return `This action updates a #${id} function`
  }

  remove(id: number) {
    return `This action removes a #${id} function`
  }
}
