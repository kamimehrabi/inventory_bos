import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { UserFields } from 'src/user/user.model';

export class LoginDto {
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  password: string;
}

export class LoginResponseDto {
  access_token: string;
  user: Partial<Omit<UserFields, 'passwordHash'>>;
}
