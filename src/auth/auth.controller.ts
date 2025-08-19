import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles-guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RateLimitGuard } from './rate-limit.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UseGuards(RateLimitGuard)
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }
// Register OMC with validation for logo and products
 @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
  @Roles('OMC_ADMIN')
  @UseInterceptors(FileInterceptor('logo'))
  async register(
    @Body() body: { 
      name: string; 
      location: string; 
      contactPerson: string; 
      contact: string; 
      email?: string; 
      products: string;
    },
     @UploadedFile() logo?: Express.Multer.File,
  ) {
    const products = JSON.parse(body.products);
    return this.authService.registerOmc(
      body.name,
      body.location,
      logo ? logo.path : undefined,
      body.contactPerson,
      body.contact,
      body.email,
      products,
    );
  }

  //create a new station
  @Post('stations')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('OMC_ADMIN')
  async createStation(
    @Body() body: { 
      name: string; 
      omcId: number; 
      region?: string; 
      district?: string; 
      town?: string; 
      managerName?: string; 
      managerContact?: string;
      pumps?: { productName: string; pumpNumber: string }[];
    },
  ) {
    return this.authService.createStation(
      body.name,
      body.omcId,
      body.region,
      body.district,
      body.town,
      body.managerName,
      body.managerContact,
      body.pumps
    );
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req) {
    return this.authService.logout(req.user.id);
  }
}