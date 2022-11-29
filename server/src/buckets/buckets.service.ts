import { Injectable, Logger } from '@nestjs/common'
import { GetApplicationNamespaceById } from '../common/getter'
import { KubernetesService } from '../core/kubernetes.service'
import { CreateBucketDto } from './dto/create-bucket.dto'
import { UpdateBucketDto } from './dto/update-bucket.dto'
import { Bucket, BucketList } from './entities/bucket.entity'

@Injectable()
export class BucketsService {
  logger: Logger = new Logger(BucketsService.name)
  constructor(private readonly k8sClient: KubernetesService) {}

  async create(appid: string, dto: CreateBucketDto) {
    const namespace = GetApplicationNamespaceById(appid)
    const bucket = new Bucket(dto.fullname(appid), namespace)
    bucket.spec = {
      policy: dto.policy,
      storage: dto.storage,
    }

    try {
      const res = await this.k8sClient.objectApi.create(bucket)
      return res.body
    } catch (error) {
      this.logger.error(error)
      return null
    }
  }

  /**
   * Query buckets of a app
   * @param appid
   * @param labelSelector
   * @returns
   */
  async findAll(appid: string, labelSelector?: string) {
    const namespace = GetApplicationNamespaceById(appid)
    const res = await this.k8sClient.customObjectApi.listNamespacedCustomObject(
      Bucket.GVK.group,
      Bucket.GVK.version,
      namespace,
      Bucket.GVK.plural,
      undefined,
      undefined,
      undefined,
      labelSelector,
    )

    return res.body as BucketList
  }

  async findOne(appid: string, name: string): Promise<Bucket> {
    const namespace = GetApplicationNamespaceById(appid)
    try {
      const res =
        await this.k8sClient.customObjectApi.getNamespacedCustomObject(
          Bucket.GVK.group,
          Bucket.GVK.version,
          namespace,
          Bucket.GVK.plural,
          name,
        )
      return res.body as Bucket
    } catch (err) {
      this.logger.error(err)
      if (err?.response?.body?.reason === 'NotFound') {
        return null
      }
      throw err
    }
  }

  update(id: number, updateBucketDto: UpdateBucketDto) {
    return `This action updates a #${id} bucket`
  }

  remove(id: number) {
    return `This action removes a #${id} bucket`
  }
}
