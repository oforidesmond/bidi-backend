import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile, Request, Get, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles-guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RateLimitGuard } from './rate-limit.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'src/config/multer.config';
import { supabaseStorage } from 'src/config/supabase.config';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  // @UseGuards(RateLimitGuard)
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Get('validate')
@UseGuards(JwtAuthGuard)
async validate(@Req() req) {
  return { success: true, user: req.user };
}
// Register OMC with validation for logo and products
 @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OMC_ADMIN')
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage }))
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
     let logoPath: string | undefined;
  if (logo) {
    logoPath = await supabaseStorage.handleUpload(logo, 'omc-logos');
  }
    const products = JSON.parse(body.products);
    return this.authService.registerOmc(
      body.name,
      body.location,
      logoPath,
      body.contactPerson,
      body.contact,
      body.email,
      products,
    );
  }

 @Post('add-station')
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
    dispensers?: { dispenserNumber: string; pumps: { productName: string; pumpNumber: string }[] }[];
    stationProductPrices?: { catalogId: number; price: number; effectiveFrom?: string }[];
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
    body.dispensers,
    body.stationProductPrices
  );
}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

 @Post('logout')
async logout(@Req() req) {
  return { success: true, message: 'Logged out successfully' };
}
}