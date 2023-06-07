import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
  Logger,
  Post,
  Delete,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IRequest } from '../utils/interface'
import { JwtAuthGuard } from '../authentication/jwt.auth.guard'
import {
  ApiResponseArray,
  ApiResponseObject,
  ResponseUtil,
} from '../utils/response'
import { ApplicationAuthGuard } from '../authentication/application.auth.guard'
import {
  UpdateApplicationBundleDto,
  UpdateApplicationNameDto,
  UpdateApplicationStateDto,
} from './dto/update-application.dto'
import { ApplicationService } from './application.service'
import { FunctionService } from '../function/function.service'
import { StorageService } from 'src/storage/storage.service'
import { RegionService } from 'src/region/region.service'
import { CreateApplicationDto } from './dto/create-application.dto'
import { AccountService } from 'src/account/account.service'
import {
  Application,
  ApplicationPhase,
  ApplicationState,
  ApplicationWithRelations,
} from './entities/application'
import { SystemDatabase } from 'src/system-database'
import { Runtime } from './entities/runtime'
import { ObjectId } from 'mongodb'
import { ApplicationBundle } from './entities/application-bundle'
import { ResourceService } from 'src/billing/resource.service'

@ApiTags('Application')
@Controller('applications')
@ApiBearerAuth('Authorization')
export class ApplicationController {
  private logger = new Logger(ApplicationController.name)

  constructor(
    private readonly application: ApplicationService,
    private readonly fn: FunctionService,
    private readonly region: RegionService,
    private readonly storage: StorageService,
    private readonly account: AccountService,
    private readonly resource: ResourceService,
  ) {}

  /**
   * Create application
   */
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create application' })
  @ApiResponseObject(ApplicationWithRelations)
  @Post()
  async create(@Req() req: IRequest, @Body() dto: CreateApplicationDto) {
    const user = req.user

    // check regionId exists
    const region = await this.region.findOneDesensitized(
      new ObjectId(dto.regionId),
    )
    if (!region) {
      return ResponseUtil.error(`region ${dto.regionId} not found`)
    }

    // check runtimeId exists
    const runtime = await SystemDatabase.db
      .collection<Runtime>('Runtime')
      .findOne({ _id: new ObjectId(dto.runtimeId) })
    if (!runtime) {
      return ResponseUtil.error(`runtime ${dto.runtimeId} not found`)
    }

    // check if trial tier
    const isTrialTier = await this.resource.isTrialBundle(dto)
    if (isTrialTier) {
      const regionId = new ObjectId(dto.regionId)
      const bundle = await this.resource.findTrialBundle(regionId)
      const trials = await this.application.findTrialApplications(user._id)
      const limitOfFreeTier = bundle?.limitCountOfFreeTierPerUser || 0
      if (trials.length >= (limitOfFreeTier || 0)) {
        return ResponseUtil.error(
          `you can only create ${limitOfFreeTier} trial applications`,
        )
      }
    }

    // one user can only have 20 applications in one region
    const count = await this.application.countByUser(user._id)
    if (count > 20) {
      return ResponseUtil.error(`too many applications, limit is 20`)
    }

    // check account balance
    const account = await this.account.findOne(user._id)
    const balance = account?.balance || 0
    if (!isTrialTier && balance < 0) {
      return ResponseUtil.error(`account balance is not enough`)
    }

    // create application
    const appid = await this.application.tryGenerateUniqueAppid()
    await this.application.create(user._id, appid, dto, isTrialTier)

    const app = await this.application.findOne(appid)
    return ResponseUtil.ok(app)
  }

  /**
   * Get user application list
   * @param req
   * @returns
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get user application list' })
  @ApiResponseArray(ApplicationWithRelations)
  async findAll(@Req() req: IRequest) {
    const user = req.user
    const data = await this.application.findAllByUser(user._id)
    return ResponseUtil.ok(data)
  }

  /**
   * Get an application by appid
   * @param appid
   * @returns
   */
  @ApiOperation({ summary: 'Get an application by appid' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get(':appid')
  async findOne(@Param('appid') appid: string) {
    const data = await this.application.findOne(appid)

    // SECURITY ALERT!!!
    // DO NOT response this region object to client since it contains sensitive information
    const region = await this.region.findOne(data.regionId)

    // TODO: remove these storage related code to standalone api
    let storage = {}
    const storageUser = await this.storage.findOne(appid)
    if (storageUser) {
      const sts = await this.storage.getOssSTS(region, appid, storageUser)
      const credentials = {
        endpoint: region.storageConf.externalEndpoint,
        accessKeyId: sts.Credentials?.AccessKeyId,
        secretAccessKey: sts.Credentials?.SecretAccessKey,
        sessionToken: sts.Credentials?.SessionToken,
        expiration: sts.Credentials?.Expiration,
      }

      storage = {
        credentials,
        ...storageUser,
      }
    }

    // Generate the develop token, it's provided to the client when debugging function
    const expires = 60 * 60 * 24 * 7
    const develop_token = await this.fn.generateRuntimeToken(
      appid,
      'develop',
      expires,
    )

    const res = {
      ...data,
      storage: storage,
      port: region.gatewayConf.port,
      develop_token: develop_token,

      /** This is the redundant field of Region */
      tls: region.tls,
    }

    return ResponseUtil.ok(res)
  }

  /**
   * Update application name
   */
  @ApiOperation({ summary: 'Update application name' })
  @ApiResponseObject(Application)
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Patch(':appid/name')
  async updateName(
    @Param('appid') appid: string,
    @Body() dto: UpdateApplicationNameDto,
  ) {
    const doc = await this.application.updateName(appid, dto.name)
    return ResponseUtil.ok(doc)
  }

  /**
   * Update application state
   */
  @ApiOperation({ summary: 'Update application state' })
  @ApiResponseObject(Application)
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Patch(':appid/state')
  async updateState(
    @Param('appid') appid: string,
    @Body() dto: UpdateApplicationStateDto,
    @Req() req: IRequest,
  ) {
    const app = req.application
    const user = req.user

    // check account balance
    const account = await this.account.findOne(user._id)
    const balance = account?.balance || 0
    if (balance < 0) {
      return ResponseUtil.error(`account balance is not enough`)
    }

    // check: only running application can restart
    if (
      dto.state === ApplicationState.Restarting &&
      app.state !== ApplicationState.Running &&
      app.phase !== ApplicationPhase.Started
    ) {
      return ResponseUtil.error(
        'The application is not running, can not restart it',
      )
    }

    // check: only running application can stop
    if (
      dto.state === ApplicationState.Stopped &&
      app.state !== ApplicationState.Running &&
      app.phase !== ApplicationPhase.Started
    ) {
      return ResponseUtil.error(
        'The application is not running, can not stop it',
      )
    }

    // check: only stopped application can start
    if (
      dto.state === ApplicationState.Running &&
      app.state !== ApplicationState.Stopped &&
      app.phase !== ApplicationPhase.Stopped
    ) {
      return ResponseUtil.error(
        'The application is not stopped, can not start it',
      )
    }

    const doc = await this.application.updateState(appid, dto.state)
    return ResponseUtil.ok(doc)
  }

  /**
   * Update application bundle
   */
  @ApiOperation({ summary: 'Update application bundle' })
  @ApiResponseObject(ApplicationBundle)
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Patch(':appid/bundle')
  async updateBundle(
    @Param('appid') appid: string,
    @Body() dto: UpdateApplicationBundleDto,
    @Req() req: IRequest,
  ) {
    const app = await this.application.findOne(appid)
    const user = req.user
    const regionId = app.regionId

    // check if trial tier
    const isTrialTier = await this.resource.isTrialBundle({
      ...dto,
      regionId: regionId.toString(),
    })
    if (isTrialTier) {
      const bundle = await this.resource.findTrialBundle(regionId)
      const trials = await this.application.findTrialApplications(user._id)
      const limitOfFreeTier = bundle?.limitCountOfFreeTierPerUser || 0
      if (trials.length >= (limitOfFreeTier || 0)) {
        return ResponseUtil.error(
          `you can only create ${limitOfFreeTier} trial applications`,
        )
      }
    }

    const doc = await this.application.updateBundle(appid, dto, isTrialTier)

    // restart running application if cpu or memory changed
    const origin = app.bundle
    const isRunning = app.phase === ApplicationPhase.Started
    const isCpuChanged = origin.resource.limitCPU !== doc.resource.limitCPU
    const isMemoryChanged =
      origin.resource.limitMemory !== doc.resource.limitMemory

    if (isRunning && (isCpuChanged || isMemoryChanged)) {
      await this.application.updateState(appid, ApplicationState.Restarting)
    }

    return ResponseUtil.ok(doc)
  }

  /**
   * Delete an application
   */
  @ApiOperation({ summary: 'Delete an application' })
  @ApiResponseObject(Application)
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Delete(':appid')
  async delete(@Param('appid') appid: string, @Req() req: IRequest) {
    const app = req.application

    // check: only stopped application can be deleted
    if (
      app.state !== ApplicationState.Stopped &&
      app.phase !== ApplicationPhase.Stopped
    ) {
      return ResponseUtil.error('The app is not stopped, can not delete it')
    }

    const doc = await this.application.remove(appid)
    return ResponseUtil.ok(doc)
  }
}
