/**
 * SHEHSWAR ONE360 - Authentication Controller
 */
import { Controller, Post, Body, Req, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../core/decorators/public.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser } from '@shehswar/types';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string);
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, { ipAddress, userAgent });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthUser) {
    // Session ID is tracked in JWT payload / token context
    return { message: 'Logged out successfully', userId: user.id };
  }

  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return user;
  }
}
