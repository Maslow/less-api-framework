import { Injectable, Logger } from '@nestjs/common'
import * as nanoid from 'nanoid'
import { UpdateApplicationBundleDto } from './dto/update-application.dto'
import {
  APPLICATION_SECRET_KEY,
  ServerConfig,
  TASK_LOCK_INIT_TIME,
} from '../constants'
import { GenerateAlphaNumericPassword } from '../utils/random'
import { CreateApplicationDto } from './dto/create-application.dto'
import { SystemDatabase } from 'src/system-database'
import {
  Application,
  ApplicationPhase,
  ApplicationState,
  ApplicationWithRelations,
} from './entities/application'
import { ObjectId } from 'mongodb'
import { ApplicationConfiguration } from './entities/application-configuration'
import {
  ApplicationBundle,
  ApplicationBundleResource,
} from './entities/application-bundle'

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name)

  /**
   * Create application
   * - create configuration
   * - create bundle
   * - create application
   */
  async create(
    userid: ObjectId,
    appid: string,
    dto: CreateApplicationDto,
    isTrialTier: boolean,
  ) {
    const client = SystemDatabase.client
    const db = client.db()
    const session = client.startSession()

    try {
      // start transaction
      session.startTransaction()

      // create application configuration
      const appSecret = {
        name: APPLICATION_SECRET_KEY,
        value: GenerateAlphaNumericPassword(64),
      }
      await db
        .collection<ApplicationConfiguration>('ApplicationConfiguration')
        .insertOne(
          {
            appid,
            environments: [appSecret],
            dependencies: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          { session },
        )

      // create application bundle
      await db.collection<ApplicationBundle>('ApplicationBundle').insertOne(
        {
          appid,
          resource: this.buildBundleResource(dto),
          isTrialTier: isTrialTier,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { session },
      )

      // create application
      await db.collection<Application>('Application').insertOne(
        {
          appid,
          name: dto.name,
          state: dto.state || ApplicationState.Running,
          phase: ApplicationPhase.Creating,
          tags: [],
          createdBy: new ObjectId(userid),
          lockedAt: TASK_LOCK_INIT_TIME,
          regionId: new ObjectId(dto.regionId),
          runtimeId: new ObjectId(dto.runtimeId),
          billingLockedAt: TASK_LOCK_INIT_TIME,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { session },
      )

      // commit transaction
      await session.commitTransaction()
    } catch (error) {
      await session.abortTransaction()
      throw Error(error)
    } finally {
      if (session) await session.endSession()
    }
  }

  async findAllByUser(userid: ObjectId) {
    const db = SystemDatabase.db

    const doc = await db
      .collection('Application')
      .aggregate<ApplicationWithRelations>()
      .match({
        createdBy: new ObjectId(userid),
        phase: { $ne: ApplicationPhase.Deleted },
      })
      .lookup({
        from: 'ApplicationBundle',
        localField: 'appid',
        foreignField: 'appid',
        as: 'bundle',
      })
      .unwind('$bundle')
      .lookup({
        from: 'Runtime',
        localField: 'runtimeId',
        foreignField: '_id',
        as: 'runtime',
      })
      .unwind('$runtime')
      .project<ApplicationWithRelations>({
        'bundle.resource.requestCPU': 0,
        'bundle.resource.requestMemory': 0,
      })
      .toArray()

    return doc
  }

  async findOne(appid: string) {
    const db = SystemDatabase.db

    const doc = await db
      .collection('Application')
      .aggregate<ApplicationWithRelations>()
      .match({ appid })
      .lookup({
        from: 'ApplicationBundle',
        localField: 'appid',
        foreignField: 'appid',
        as: 'bundle',
      })
      .unwind('$bundle')
      .lookup({
        from: 'Runtime',
        localField: 'runtimeId',
        foreignField: '_id',
        as: 'runtime',
      })
      .unwind('$runtime')
      .lookup({
        from: 'ApplicationConfiguration',
        localField: 'appid',
        foreignField: 'appid',
        as: 'configuration',
      })
      .unwind('$configuration')
      .lookup({
        from: 'RuntimeDomain',
        localField: 'appid',
        foreignField: 'appid',
        as: 'domain',
      })
      .unwind({ path: '$domain', preserveNullAndEmptyArrays: true })
      .project<ApplicationWithRelations>({
        'bundle.resource.requestCPU': 0,
        'bundle.resource.requestMemory': 0,
      })
      .next()

    return doc
  }

  async findOneUnsafe(appid: string) {
    const db = SystemDatabase.db

    const doc = await db
      .collection('Application')
      .aggregate<ApplicationWithRelations>()
      .match({ appid })
      .lookup({
        from: 'Region',
        localField: 'regionId',
        foreignField: '_id',
        as: 'region',
      })
      .unwind('$region')
      .lookup({
        from: 'ApplicationBundle',
        localField: 'appid',
        foreignField: 'appid',
        as: 'bundle',
      })
      .unwind('$bundle')
      .lookup({
        from: 'Runtime',
        localField: 'runtimeId',
        foreignField: '_id',
        as: 'runtime',
      })
      .unwind('$runtime')
      .lookup({
        from: 'ApplicationConfiguration',
        localField: 'appid',
        foreignField: 'appid',
        as: 'configuration',
      })
      .unwind('$configuration')
      .lookup({
        from: 'RuntimeDomain',
        localField: 'appid',
        foreignField: 'appid',
        as: 'domain',
      })
      .unwind({ path: '$domain', preserveNullAndEmptyArrays: true })
      .next()

    return doc
  }

  async findTrialApplications(userid: ObjectId) {
    const db = SystemDatabase.db

    const apps = await db
      .collection<Application>('Application')
      .aggregate<Application>()
      .match({ createdBy: userid })
      .lookup({
        from: 'ApplicationBundle',
        localField: 'appid',
        foreignField: 'appid',
        as: 'bundle',
      })
      .unwind('$bundle')
      .match({ 'bundle.isTrialTier': true })
      .toArray()

    return apps
  }

  async countByUser(userid: ObjectId) {
    const db = SystemDatabase.db

    const count = await db
      .collection<Application>('Application')
      .countDocuments({ createdBy: userid })

    return count
  }

  async updateName(appid: string, name: string) {
    const db = SystemDatabase.db
    const res = await db
      .collection<Application>('Application')
      .findOneAndUpdate(
        { appid },
        { $set: { name, updatedAt: new Date() } },
        { returnDocument: 'after' },
      )

    return res.value
  }

  async updateState(appid: string, state: ApplicationState) {
    const db = SystemDatabase.db
    const res = await db
      .collection<Application>('Application')
      .findOneAndUpdate(
        { appid },
        { $set: { state, updatedAt: new Date() } },
        { returnDocument: 'after' },
      )

    return res.value
  }

  async updateBundle(appid: string, dto: UpdateApplicationBundleDto) {
    const db = SystemDatabase.db
    const resource = this.buildBundleResource(dto)
    const res = await db
      .collection<ApplicationBundle>('ApplicationBundle')
      .findOneAndUpdate(
        { appid },
        {
          $set: { resource, updatedAt: new Date() },
          $unset: { isTrialTier: '' },
        },
        {
          projection: {
            'bundle.resource.requestCPU': 0,
            'bundle.resource.requestMemory': 0,
          },
          returnDocument: 'after',
        },
      )

    return res.value
  }

  async remove(appid: string) {
    const db = SystemDatabase.db
    const doc = await db
      .collection<Application>('Application')
      .findOneAndUpdate(
        { appid },
        { $set: { state: ApplicationState.Deleted, updatedAt: new Date() } },
        { returnDocument: 'after' },
      )

    return doc.value
  }

  /**
   * Generate unique application id
   * @returns
   */
  async tryGenerateUniqueAppid() {
    const db = SystemDatabase.db

    for (let i = 0; i < 10; i++) {
      const appid = this.generateAppID(ServerConfig.APPID_LENGTH)
      const existed = await db
        .collection<Application>('Application')
        .findOne({ appid })

      if (!existed) return appid
    }

    throw new Error('Generate appid failed')
  }

  private generateAppID(len: number) {
    len = len || 6

    // ensure prefixed with letter
    const only_alpha = 'abcdefghijklmnopqrstuvwxyz'
    const alphanumeric = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const prefix = nanoid.customAlphabet(only_alpha, 1)()
    const nano = nanoid.customAlphabet(alphanumeric, len - 1)
    return prefix + nano()
  }

  private buildBundleResource(dto: UpdateApplicationBundleDto) {
    const requestCPU = Math.floor(dto.cpu * 0.1)
    const requestMemory = Math.floor(dto.memory * 0.5)
    const limitCountOfCloudFunction = Math.floor(dto.cpu * 1)

    const magicNumber = Math.floor(dto.cpu * 0.01)
    const limitCountOfBucket = Math.max(3, magicNumber)
    const limitCountOfDatabasePolicy = Math.max(3, magicNumber)
    const limitCountOfTrigger = Math.max(1, magicNumber)
    const limitCountOfWebsiteHosting = Math.max(3, magicNumber)
    const limitDatabaseTPS = Math.floor(dto.cpu * 0.1)
    const limitStorageTPS = Math.floor(dto.cpu * 1)
    const reservedTimeAfterExpired = 60 * 60 * 24 * 31 // 31 days

    const resource = new ApplicationBundleResource({
      limitCPU: dto.cpu,
      limitMemory: dto.memory,
      requestCPU,
      requestMemory,
      databaseCapacity: dto.databaseCapacity,
      storageCapacity: dto.storageCapacity,

      limitCountOfCloudFunction,
      limitCountOfBucket,
      limitCountOfDatabasePolicy,
      limitCountOfTrigger,
      limitCountOfWebsiteHosting,
      limitDatabaseTPS,
      limitStorageTPS,
      reservedTimeAfterExpired,
    })

    return resource
  }
}
