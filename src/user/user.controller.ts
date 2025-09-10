import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  @Post('attendant')
async createPumpAttendant(
  @Body() body: {
    email: string;
    password: string;
    stationId: number;
    omcId?: number;
  },
) {
  return this.userService.createPumpAttendant(
    body.email,
    body.password,
    body.stationId,
    body.omcId,
  );
}

@Get('attendants/:id')
async getPumpAttendant(@Param('id', ParseIntPipe) id: number) {
  return this.userService.getPumpAttendant(id);
}

@Patch('update/attendants/:id')
async updatePumpAttendant(
  @Param('id', ParseIntPipe) id: number,
  @Body() body: {
    email?: string;
    password?: string;
    stationId?: number;
    omcId?: number | null;
  },
) {
  return this.userService.updatePumpAttendant(id, body.email, body.password, body.stationId, body.omcId);
}

@Delete('attendant/:id')
async deletePumpAttendant(@Param('id', ParseIntPipe) id: number) {
  return this.userService.deletePumpAttendant(id);
}
@Get('attendants')
async getAllPumpAttendants() {
  return this.userService.getAllPumpAttendants();
}
}
