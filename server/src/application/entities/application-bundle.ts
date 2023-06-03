import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ObjectId } from 'mongodb'

export class ApplicationBundleResource {
  @ApiProperty({ example: 500 })
  limitCPU: number

  @ApiProperty({ example: 1024 })
  limitMemory: number

  requestCPU: number
  requestMemory: number

  @ApiProperty({ example: 1024 })
  databaseCapacity: number

  @ApiProperty({ example: 1024 })
  storageCapacity: number

  @ApiProperty({ example: 100 })
  limitCountOfCloudFunction: number

  @ApiProperty({ example: 3 })
  limitCountOfBucket: number

  @ApiProperty({ example: 3 })
  limitCountOfDatabasePolicy: number

  @ApiProperty({ example: 1 })
  limitCountOfTrigger: number

  @ApiProperty({ example: 3 })
  limitCountOfWebsiteHosting: number

  @ApiProperty()
  reservedTimeAfterExpired: number

  limitDatabaseTPS: number
  limitStorageTPS: number

  constructor(partial: Partial<ApplicationBundleResource>) {
    Object.assign(this, partial)
  }
}

export class ApplicationBundle {
  @ApiProperty({ type: String })
  _id?: ObjectId

  @ApiProperty()
  appid: string

  @ApiProperty()
  resource: ApplicationBundleResource

  @ApiPropertyOptional()
  isTrialTier?: boolean

  @ApiProperty()
  createdAt: Date

  @ApiProperty()
  updatedAt: Date

  constructor(partial: Partial<ApplicationBundle>) {
    Object.assign(this, partial)
  }
}
