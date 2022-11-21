import { Injectable } from '@nestjs/common'
import { Prisma, User } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import * as nanoid from 'nanoid'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  generateUserId() {
    const nano = nanoid.customAlphabet(
      '1234567890abcdefghijklmnopqrstuvwxyz',
      12,
    )
    return nano()
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    if (!data.id) {
      data.id = this.generateUserId()
    }

    return this.prisma.user.create({
      data,
    })
  }

  async user(input: Prisma.UserWhereUniqueInput, withProfile = false) {
    return this.prisma.user.findUnique({
      where: input,
      include: {
        UserProfile: withProfile,
      },
    })
  }

  async profile(input: Prisma.UserProfileWhereInput, withUser = true) {
    return this.prisma.userProfile.findFirst({
      where: input,
      include: {
        user: withUser,
      },
    })
  }

  async getProfileByOpenid(openid: string) {
    return this.profile({ openid }, true)
  }

  async users(params: {
    skip?: number
    take?: number
    cursor?: Prisma.UserWhereUniqueInput
    where?: Prisma.UserWhereInput
    orderBy?: Prisma.UserOrderByWithRelationInput
  }): Promise<User[]> {
    const { skip, take, cursor, where, orderBy } = params
    return this.prisma.user.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    })
  }

  async updateUser(params: {
    where: Prisma.UserWhereUniqueInput
    data: Prisma.UserUpdateInput
  }) {
    const { where, data } = params
    return this.prisma.user.update({
      data,
      where,
    })
  }

  async deleteUser(where: Prisma.UserWhereUniqueInput) {
    return this.prisma.user.delete({
      where,
    })
  }
}
