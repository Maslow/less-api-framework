import { ObjectId } from 'mongodb'
import { CreateEnvironmentDto } from '../../application/dto/create-env.dto'
import { CreateDependencyDto } from 'src/dependency/dto/create-dependency.dto'
import { CloudFunctionSource } from 'src/function/entities/cloud-function'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { HTTP_METHODS } from '../../constants'
import { HttpMethod } from '../../function/entities/cloud-function'
export class FunctionTemplateItemDto {
  @ApiProperty({
    description: 'FunctionTemplate function name',
  })
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_.\-\/]{1,256}$/)
  name: string

  @ApiPropertyOptional()
  @MaxLength(256)
  description?: string

  @ApiProperty({ type: [String], enum: HttpMethod })
  @IsIn(HTTP_METHODS, { each: true })
  methods: HttpMethod[] = []

  @ApiProperty({ description: 'The source code of the function' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1024 * 512)
  code: string

  validate() {
    return null
  }
}

export class CreateFunctionTemplateDto {
  @ApiProperty({ description: 'function template name' })
  @IsNotEmpty()
  @IsString()
  name: string

  @ApiProperty({ description: 'Dependencies', type: [CreateDependencyDto] })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateDependencyDto)
  dependencies: CreateDependencyDto[]

  @ApiProperty({ description: 'environments', type: [CreateEnvironmentDto] })
  @ValidateNested({ each: true })
  @Type(() => CreateEnvironmentDto)
  environments: CreateEnvironmentDto[]

  @ApiProperty({ description: 'Private flag' })
  @IsBoolean()
  private: boolean

  @ApiPropertyOptional({ description: 'function template description' })
  @IsString()
  description?: string

  @ApiProperty({
    description: 'items of the function template',
    type: [FunctionTemplateItemDto],
  })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FunctionTemplateItemDto)
  items: FunctionTemplateItemDto[]
}