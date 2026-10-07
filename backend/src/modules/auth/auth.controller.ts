import { Body, Controller, Get, Headers, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { AuthService } from "./auth.service";

class FirebaseTokenDto {
  @IsString() @IsNotEmpty() idToken!: string;
}

class RequestOtpDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  @Matches(/^\+?[0-9][0-9\s-]{8,18}$/, { message: "Invalid phone number" })
  phone!: string;
}

class VerifyOtpDto {
  @IsString() @IsNotEmpty() @MaxLength(20) phone!: string;
  @IsString() @IsNotEmpty() @MaxLength(6) code!: string;
}

class ProfileDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() language?: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("request-otp")
  requestOtp(@Body() body: RequestOtpDto) { return this.auth.requestOtp(body.phone); }

  @Post("verify-otp")
  verifyOtp(@Body() body: VerifyOtpDto) { return this.auth.verifyOtp(body.phone, body.code); }

  @Post("firebase")
  firebase(@Body() body: FirebaseTokenDto) { return this.auth.authenticateFirebase(body.idToken); }

  @Get("me")
  me(@Headers("authorization") authorization?: string) {
    return this.auth.getProfile(this.requireToken(authorization));
  }

  @Get("profile")
  profile(@Headers("authorization") authorization?: string) {
    return this.auth.getProfile(this.requireToken(authorization));
  }

  @Patch("profile")
  updateProfile(@Headers("authorization") authorization: string | undefined, @Body() body: ProfileDto) {
    return this.auth.updateProfile(this.requireToken(authorization), body);
  }

  @Post("logout")
  logout(@Headers("authorization") authorization?: string) {
    return this.auth.logout(this.requireToken(authorization));
  }

  private requireToken(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new UnauthorizedException("Bearer token is required");
    return token;
  }
}
