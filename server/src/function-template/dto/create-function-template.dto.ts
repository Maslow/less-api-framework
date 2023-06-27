import { CreateEnvironmentDto } from '../../application/dto/create-env.dto'
import { CreateDependencyDto } from 'src/dependency/dto/create-dependency.dto'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { HTTP_METHODS } from '../../constants'
import { HttpMethod } from '../../function/entities/cloud-function'
export class FunctionTemplateItemDto {
  @ApiProperty({
    description: 'FunctionTemplate item name',
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
  @MaxLength(64)
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
  @MinLength(8)
  @MaxLength(256)
  description?: string

  @ApiProperty({
    description: 'items of the function template',
    type: [FunctionTemplateItemDto],
  })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @ArrayMaxSize(20)
  @Type(() => FunctionTemplateItemDto)
  items: FunctionTemplateItemDto[]
}
