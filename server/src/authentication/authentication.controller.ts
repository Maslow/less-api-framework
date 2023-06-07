import { AuthenticationService } from './authentication.service'
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import {
  ApiResponseObject,
  ApiResponseString,
  ResponseUtil,
} from 'src/utils/response'
import { JwtAuthGuard } from './jwt.auth.guard'
import { BindUsernameDto } from './dto/bind-username.dto'
import { IRequest } from 'src/utils/interface'
import { BindPhoneDto } from './dto/bind-phone.dto'
import { SmsService } from './phone/sms.service'
import { UserService } from 'src/user/user.service'
import { ObjectId } from 'mongodb'
import { SmsVerifyCodeType } from './entities/sms-verify-code'
import { Pat2TokenDto } from './dto/pat2token.dto'
import { UserWithProfile } from 'src/user/entities/user'

@ApiTags('Authentication')
@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly smsService: SmsService,
    private readonly userService: UserService,
  ) {}

  /**
   * Auth providers
   */
  @ApiOperation({ summary: 'Auth providers' })
  @ApiResponse({ type: ResponseUtil })
  @Get('providers')
  async getProviders() {
    const providers = await this.authService.getProviders()
    return ResponseUtil.ok(providers)
  }

  /**
   * Bind phone
   */
  @ApiOperation({ summary: 'Bind username' })
  @ApiResponse({ type: ResponseUtil })
  @UseGuards(JwtAuthGuard)
  @Post('bind/phone')
  async bindPhone(@Body() dto: BindPhoneDto, @Req() req: IRequest) {
    const { phone, code } = dto
    // check code valid
    const err = await this.smsService.validateCode(
      phone,
      code,
      SmsVerifyCodeType.Bind,
    )
    if (err) {
      return ResponseUtil.error(err)
    }

    // check phone if have already been bound
    const user = await this.userService.findOneByUsernameOrPhoneOrEmail(phone)
    if (user) {
      return ResponseUtil.error('phone already been bound')
    }

    // bind phone
    await this.userService.updateUser(new ObjectId(req.user._id), { phone })
  }

  /**
   * Bind username, not support bind existed username
   */
  @ApiOperation({ summary: 'Bind username' })
  @ApiResponse({ type: ResponseUtil })
  @UseGuards(JwtAuthGuard)
  @Post('bind/username')
  async bindUsername(@Body() dto: BindUsernameDto, @Req() req: IRequest) {
    const { username, phone, code } = dto

    // check code valid
    const err = await this.smsService.validateCode(
      phone,
      code,
      SmsVerifyCodeType.Bind,
    )
    if (err) {
      return ResponseUtil.error(err)
    }

    // check username if have already been bound
    const user = await this.userService.findOneByUsernameOrPhoneOrEmail(
      username,
    )
    if (user) {
      return ResponseUtil.error('username already been bound')
    }

    // bind username
    await this.userService.updateUser(new ObjectId(req.user._id), { username })
  }

  /**
   * Get user token by PAT
   * @param pat
   * @returns
   */
  @ApiOperation({ summary: 'Get user token by PAT' })
  @ApiResponseString()
  @Post('pat2token')
  async pat2token(@Body() dto: Pat2TokenDto) {
    const token = await this.authService.pat2token(dto.pat)
    if (!token) {
      return ResponseUtil.error('invalid pat')
    }

    return ResponseUtil.ok(token)
  }

  /**
   * Get current user profile
   * @param request
   * @returns
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiResponseObject(UserWithProfile)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth('Authorization')
  async getProfile(@Req() request: IRequest) {
    const user = request.user
    return ResponseUtil.ok(user)
  }
}
