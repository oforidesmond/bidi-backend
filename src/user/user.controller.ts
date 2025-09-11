import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles-guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

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
// @UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
// @Roles('OMC_ADMIN')
@UseInterceptors(FileInterceptor('cardImage'))
async createPumpAttendant(
  @Body() body: {
    name: string;
    nationalId: string;
    contact: string;
    gender: string;
    email: string;
    password: string;
    stationId: string; // String because FormData sends strings
    omcId?: string;
  },
  @UploadedFile() cardImage?: Express.Multer.File,
) {
  return this.userService.createPumpAttendant(
    body.name,
    body.nationalId,
    body.contact,
    body.gender,
    cardImage ? cardImage.path : undefined,
    body.email,
    body.password,
    parseInt(body.stationId, 10),
    body.omcId ? parseInt(body.omcId, 10) : undefined,
  );
}

@Get('attendants/:id')
async getPumpAttendant(@Param('id', ParseIntPipe) id: number) {
  return this.userService.getPumpAttendant(id);
}

@Patch('update/attendants/:id')
// @UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
// @Roles('OMC_ADMIN')
@UseInterceptors(FileInterceptor('cardImage'))
async updatePumpAttendant(
  @Param('id', ParseIntPipe) id: number,
  @Body() body: {
    name?: string;
    nationalId?: string;
    contact?: string;
    gender?: string;
    email?: string;
    password?: string;
    stationId?: string;
    omcId?: string | null;
  },
  @UploadedFile() cardImage?: Express.Multer.File,
) {
  return this.userService.updatePumpAttendant(
    id,
    body.name,
    body.nationalId,
    body.contact,
    body.gender,
    cardImage ? cardImage.path : undefined,
    body.email,
    body.password,
    body.stationId ? parseInt(body.stationId, 10) : undefined,
    body.omcId === 'null' ? null : body.omcId ? parseInt(body.omcId, 10) : undefined,
  );
}

@Delete('attendant/:id')
async deletePumpAttendant(@Param('id', ParseIntPipe) id: number) {
  return this.userService.deletePumpAttendant(id);
}
@Get('attendants')
async getAllPumpAttendants() {
  return this.userService.getAllPumpAttendants();
}


// Assign attendants to a pump
@Post('pump/:pumpId/attendants')
async assignAttendantsToPump(
  @Param('pumpId', ParseIntPipe) pumpId: number,
  @Body('attendantIds') attendantIds: number[], // Array of User IDs
) {
  return this.userService.assignAttendantsToPump(pumpId, attendantIds);
}

// Remove attendants from a pump
@Delete('pump/:pumpId/attendants')
async removeAttendantsFromPump(
  @Param('pumpId', ParseIntPipe) pumpId: number,
  @Body('attendantIds') attendantIds: number[], // Array of User IDs
) {
  return this.userService.removeAttendantsFromPump(pumpId, attendantIds);
}

// Get attendants assigned to a pump
@Get('pump/:pumpId/attendants')
async getPumpAttendants(@Param('pumpId', ParseIntPipe) pumpId: number) {
  return this.userService.getPumpAttendants(pumpId);
}

// Get pumps assigned to an attendant
@Get('attendant/:attendantId/pumps')
async getAttendantPumps(@Param('attendantId', ParseIntPipe) attendantId: number) {
  return this.userService.getAttendantPumps(attendantId);
  }

@Get('pumps')
async getPumpsByStation(@Query('stationId', ParseIntPipe) stationId: number) {
  return this.userService.getPumpsByStation(stationId);
}
}
