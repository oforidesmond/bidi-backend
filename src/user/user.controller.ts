import { BadRequestException, Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles-guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('omcs')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('OMC_ADMIN')
  async getAllOmcs() {
    return this.userService.getAllOmcs();
  }

    @Get('stations')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('OMC_ADMIN')
  async getStations(@Query('omcId') omcId?: string) {
    return this.userService.getStations(omcId ? parseInt(omcId, 10) : undefined);
  }

   @Get('count')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('OMC_ADMIN')
  async count(@Query('omcId') omcId?: string) {
    return this.userService.count(omcId ? parseInt(omcId, 10) : undefined);
  }

  @Patch(':type/:id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('OMC_ADMIN') // Adjust roles as needed
  async editResource(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    const resourceId = parseInt(id, 10);
    if (isNaN(resourceId)) {
      throw new BadRequestException('Invalid ID');
    }

    switch (type.toLowerCase()) {
      case 'station':
        return this.userService.updateStation(resourceId, data);
      case 'omc':
        return this.userService.updateOmc(resourceId, data);
      default:
        throw new BadRequestException('Invalid resource type. Use "station" or "omc"');
    }
  }
}
