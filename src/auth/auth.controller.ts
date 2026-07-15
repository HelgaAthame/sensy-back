import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignInDto, SignInResponseDto } from './dto/sign-in.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вход по email/паролю, возвращает JWT' })
  @ApiOkResponse({ type: SignInResponseDto })
  signIn(@Body() dto: SignInDto): Promise<SignInResponseDto> {
    return this.authService.signIn(dto);
  }
}
