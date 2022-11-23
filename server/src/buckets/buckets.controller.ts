import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common'
import { ApplicationAuthGuard } from 'src/applications/application.auth.guard'
import { IRequest } from 'src/common/types'
import { ApplicationsService } from '../applications/applications.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ResponseUtil } from '../common/response'
import { BucketsService } from './buckets.service'
import { CreateBucketDto } from './dto/create-bucket.dto'
import { UpdateBucketDto } from './dto/update-bucket.dto'

@Controller('apps/:appid/buckets')
export class BucketsController {
  logger = new Logger(BucketsController.name)
  constructor(
    private readonly bucketsService: BucketsService,
    private readonly appService: ApplicationsService,
  ) {}

  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post()
  async create(@Body() dto: CreateBucketDto, @Req() req: IRequest) {
    // check if the bucket name is unique
    const found = await this.bucketsService.findOne(dto.appid, dto.name)
    if (found) {
      return ResponseUtil.error('bucket name is already existed')
    }

    // TODO: check the storage capacity of the app
    const app = req.application
    this.logger.warn(
      'TODO: check the storage capacity of the app: ',
      app.metadata.name,
    )

    // create bucket
    const bucket = await this.bucketsService.create(dto)
    if (!bucket) {
      return ResponseUtil.error('create bucket failed')
    }

    return ResponseUtil.ok(bucket)
  }

  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get()
  findAll() {
    return this.bucketsService.findAll()
  }

  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get(':name')
  findOne(@Param('appid') appid: string, @Param('name') name: string) {
    return this.bucketsService.findOne(appid, name)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBucketDto: UpdateBucketDto) {
    return this.bucketsService.update(+id, updateBucketDto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bucketsService.remove(+id)
  }
}
