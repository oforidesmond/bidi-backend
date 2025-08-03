import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
    constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getAllOmcs() {
    return this.prisma.omc.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        location: true,
        logo: true,
        contactPerson: true,
        contact: true,
        email: true,
        products: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });
  }

  async getStations(omcId?: number) {
    const where: any = { deletedAt: null };
    if (omcId) {
      where.omcId = omcId;
      // Validate omcId exists
      const omc = await this.prisma.omc.findUnique({
        where: { id: omcId },
      });
      if (!omc) {
        throw new BadRequestException('Invalid OMC ID');
      }
    }

    return this.prisma.station.findMany({
      where,
      select: {
        id: true,
        name: true,
        pumpNo: true,
        region: true,
        district: true,
        town: true,
        managerName: true,
        managerContact: true,
        omcId: true,
        omc: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });
  }

   async count(omcId?: number) {
    const where: any = { deletedAt: null };
    if (omcId) {
      where.omcId = omcId;
      const omc = await this.prisma.omc.findUnique({
        where: { id: omcId },
      });
      if (!omc) {
        throw new BadRequestException('Invalid OMC ID');
      }
    }

    const [stationCount, omcCount] = await Promise.all([
      this.prisma.station.count({ where }),
      this.prisma.omc.count({ where: { deletedAt: null } }),
    ]);

    return {
      stations: stationCount,
      omcs: omcCount,
    };
  }
}
