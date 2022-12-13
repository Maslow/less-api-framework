import { applyDecorators, Type } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger'

export class ResponseUtil<T = any> {
  @ApiProperty({ required: false })
  public error: string

  @ApiProperty({
    required: false,
  })
  public data: T

  static ok<T>(data: T) {
    return new ResponseUtil(data, null)
  }

  static error(error: string) {
    return new ResponseUtil(null, error)
  }

  static build<T = any>(data: T, error: string) {
    return new ResponseUtil(data, error)
  }

  constructor(data: T, error: string) {
    this.data = data
    this.error = error
  }

  valueOf() {
    return this.toJSON()
  }

  toJSON() {
    return {
      error: this.error,
      data: this.data,
    }
  }
  toString() {
    return JSON.stringify(this.toJSON())
  }
}

export const ApiResponseUtil = <DataDto extends Type<unknown>>(
  dataDto: DataDto,
) =>
  applyDecorators(
    ApiExtraModels(ResponseUtil, dataDto),
    ApiResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResponseUtil) },
          {
            properties: {
              data: { $ref: getSchemaPath(dataDto) },
            },
          },
        ],
      },
    }),
  )
