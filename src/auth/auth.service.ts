import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { sub: user.id, email: user.email, role: user.role.name };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  // auth.service.ts
async validateToken(token: string) {
  try {
    const payload = await this.jwtService.verifyAsync(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return { success: true, user: { id: user.id, email: user.email, role: user.role.name } };
  } catch (error) {
    return { success: false, message: 'Invalid token' };
  }
}

async registerOmc(
  name: string,
  location: string,
  logo: string | undefined,
  contactPerson: string,
  contact: string,
  email: string | undefined,
  products: { name: string; defaultPrice: number }[],
) {
  // Validate email
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Invalid email format');
  }

  // Validate contact (10-digit phone)
  if (!/^[0-9]{10}$/.test(contact)) {
    throw new BadRequestException('Contact must be a valid 10-digit phone number');
  }

  // Validate logo extension
  if (logo) {
    const extension = logo.slice(logo.lastIndexOf('.')).toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    if (!validExtensions.includes(extension)) {
      throw new BadRequestException('Logo must be a JPG, JPEG, or PNG file');
    }
  }

  // Validate products
  if (!products || products.length === 0) {
    throw new BadRequestException('At least one product must be provided');
  }
  for (const product of products) {
    if (!product.name || typeof product.defaultPrice !== 'number' || product.defaultPrice <= 0) {
      throw new BadRequestException('Each product must have a valid name and defaultPrice > 0');
    }
  }

  // Create OMC + ProductCatalog entries in transaction
  return this.prisma.$transaction(async (prisma) => {
    const omc = await prisma.omc.create({
      data: {
        name,
        location,
        logo,
        contactPerson,
        contact,
        email,
      },
    });

    // Create product catalog entries
    await prisma.productCatalog.createMany({
      data: products.map((p) => ({
        name: p.name,
        omcId: omc.id,
        defaultPrice: p.defaultPrice,
      })),
    });

    const catalog = await prisma.productCatalog.findMany({
      where: { omcId: omc.id },
      select: { id: true, name: true, defaultPrice: true },
    });

    // Generate JWT
    const payload = { sub: omc.id, name: omc.name, role: 'OMC_ADMIN' };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      omc: {
        ...omc,
        catalog,
      },
    };
  });
}

  // Create a new station with validation
async createStation(
  name: string,
  omcId: number,
  region?: string,
  district?: string,
  town?: string,
  managerName?: string,
  managerContact?: string,
  dispensers?: {
    dispenserNumber: string;
    pumps: { productName: string; pumpNumber: string }[];
    
  }[],
  stationProductPrices?: { catalogId: number; price: number; effectiveFrom?: string }[],
) {
  // Validate OMC exists
  const omc = await this.prisma.omc.findUnique({
    where: { id: omcId },
    include: { catalog: true },
  });
  if (!omc) {
    throw new BadRequestException('Invalid OMC ID');
  }

  // Validate uniqueness of dispenser and pump numbers
  if (dispensers) {
    const dispenserNumbers = dispensers.map((d) => `${name}-${d.dispenserNumber}`);
    const uniqueDispensers = new Set(dispenserNumbers);
    if (uniqueDispensers.size !== dispenserNumbers.length) {
      throw new BadRequestException('Dispenser numbers must be unique within station');
    }

    const allPumpNumbers = dispensers.flatMap((d) => d.pumps.map((p) => p.pumpNumber));
    const uniquePumps = new Set(allPumpNumbers);
    if (uniquePumps.size !== allPumpNumbers.length) {
      throw new BadRequestException('Pump numbers must be unique across all dispensers');
    }

    // Check global uniqueness
    const [existingDispensers, existingPumps] = await Promise.all([
      this.prisma.dispenser.findMany({
        where: { dispenserNumber: { in: dispenserNumbers } },
        select: { dispenserNumber: true },
      }),
      this.prisma.pump.findMany({
        where: { pumpNumber: { in: allPumpNumbers } },
        select: { pumpNumber: true },
      }),
    ]);

    if (existingDispensers.length > 0) {
      throw new BadRequestException(
        `Dispenser(s) already exist: ${existingDispensers.map((d) => d.dispenserNumber).join(', ')}`,
      );
    }
    if (existingPumps.length > 0) {
      throw new BadRequestException(
        `Pump(s) already exist: ${existingPumps.map((p) => p.pumpNumber).join(', ')}`,
      );
    }
  }

  // Validate product names exist in OMC catalog
  const productNames = dispensers
    ? [...new Set(dispensers.flatMap((d) => d.pumps.map((p) => p.productName)))]
    : [];

  const invalidProducts = productNames.filter(
    (name) => !omc.catalog.some((c) => c.name === name && c.deletedAt === null),
  );
  if (invalidProducts.length > 0) {
    throw new BadRequestException(
      `Product(s) not found in OMC catalog: ${invalidProducts.join(', ')}`,
    );
  }

  // Create station + dispensers + pumps + station prices
  return this.prisma.$transaction(async (prisma) => {
    // 1. Create Station
    const station = await prisma.station.create({
      data: {
        name,
        omc: { connect: { id: omcId } },
        region,
        district,
        town,
        managerName,
        managerContact,
      },
    });

   // Map OMC catalog by id & name for validation
    const catalogById = new Map(omc.catalog.map((c) => [c.id, c]));
    const catalogByName = new Map(omc.catalog.map((c) => [c.name, c]));

    // Apply station price overrides if provided
    if (stationProductPrices?.length) {
      // Validate all catalogIds belong to this OMC
      for (const sp of stationProductPrices) {
        if (!catalogById.has(sp.catalogId)) {
          throw new BadRequestException(`Invalid catalogId ${sp.catalogId} for this OMC`);
        }
      }
      await prisma.stationProductPrice.createMany({
        data: stationProductPrices.map((sp) => ({
          stationId: station.id,
          catalogId: sp.catalogId,
          price: sp.price,
          effectiveFrom: sp.effectiveFrom ? new Date(sp.effectiveFrom) : new Date(),
        })),
      });
    } else {
      // Fallback: seed defaults based on pumps (existing behavior)
      const productNames = dispensers
        ? [...new Set(dispensers.flatMap((d) => d.pumps.map((p) => p.productName)))]
        : [];
      const stationPrices = productNames.map((name) => {
        const catalog = catalogByName.get(name)!;
        return {
          catalogId: catalog.id,
          stationId: station.id,
          price: catalog.defaultPrice ?? 0,
          effectiveFrom: new Date(),
        };
      });
      if (stationPrices.length) {
        await prisma.stationProductPrice.createMany({ data: stationPrices });
      }
    }

    // 3. Create Dispensers & Pumps
    if (dispensers && dispensers.length > 0) {
      for (const disp of dispensers) {
        const dispenserNumber = `${name}-${disp.dispenserNumber}`;
        const dispenser = await prisma.dispenser.create({
          data: {
            dispenserNumber,
            station: { connect: { id: station.id } },
          },
        });

        if (disp.pumps.length > 0) {
          await prisma.pump.createMany({
            data: disp.pumps.map((pump) => {
              const catalog = catalogByName.get(pump.productName)!;
              return {
                pumpNumber: pump.pumpNumber,
                productCatalogId: catalog.id,
                dispenserId: dispenser.id,
              };
            }),
          });
        }
      }
    }

    // 4. Return full station with relations
    return prisma.station.findUnique({
      where: { id: station.id },
      include: {
        omc: { select: { id: true, name: true } },
        stationProductPrices: {
          include: {
            catalog: { select: { id: true, name: true, defaultPrice: true } },
          },
        },
        dispensers: {
          include: {
            pumps: {
              include: {
                productCatalog: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  });
}

  async logout(userId: number) {
    // Implement logout logic, e.g., invalidate the JWT or remove session
    // For simplicity, we can just return a success message
    return { message: 'Logged out successfully' };
  }

 async getProfile(userId: number) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new HttpException('User not found or deleted', HttpStatus.NOT_FOUND);
  }

  return {
    id: user.id,
    email: user.email || null,
    role: user.role,
  };
}
}