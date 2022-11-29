import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { FunctionsService } from './functions.service'
import { CreateFunctionDto } from './dto/create-function.dto'
import { UpdateFunctionDto } from './dto/update-function.dto'
import { ApiResponseUtil, ResponseUtil } from 'src/common/response'
import { CloudFunction, CloudFunctionList } from './entities/function.entity'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'
import { ApplicationAuthGuard } from 'src/applications/application.auth.guard'

@ApiTags('Function')
@ApiBearerAuth('Authorization')
@Controller('apps/:appid/functions')
export class FunctionsController {
  constructor(private readonly functionsService: FunctionsService) {}

  /**
   * Create a new function
   * @param dto
   * @returns
   */
  @ApiResponseUtil(CloudFunction)
  @ApiOperation({ summary: 'Create a new function' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post()
  async create(@Param('appid') appid: string, @Body() dto: CreateFunctionDto) {
    const error = dto.validate()
    if (error) {
      return ResponseUtil.error(error)
    }

    const res = await this.functionsService.create(appid, dto)
    if (!res) {
      return ResponseUtil.error('create function error')
    }
    return ResponseUtil.ok(res)
  }

  /**
   * Query function list of an app
   * @returns
   */
  @ApiResponseUtil(CloudFunctionList)
  @ApiOperation({ summary: 'Query function list of an app' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get()
  async findAll(@Param('appid') appid: string) {
    const data = await this.functionsService.findAll(appid)
    return ResponseUtil.ok(data)
  }

  /**
   * Get a function by its name
   * @param appid
   * @param name
   */
  @ApiResponseUtil(CloudFunction)
  @ApiOperation({ summary: 'Get a function by its name' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get(':name')
  async findOne(@Param('appid') appid: string, @Param('name') name: string) {
    const data = await this.functionsService.findOne(appid, name)
    if (!data) {
      throw new HttpException('function not found', HttpStatus.NOT_FOUND)
    }
    return ResponseUtil.ok(data)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'TODO - ⌛️' })
  update(
    @Param('id') id: string,
    @Body() updateFunctionDto: UpdateFunctionDto,
  ) {
    return this.functionsService.update(+id, updateFunctionDto)
  }

  @ApiOperation({ summary: 'TODO - ⌛️' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.functionsService.remove(+id)
  }
}
