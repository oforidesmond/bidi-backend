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
  products: { name: string; price: number }[],
) {
  // Optional: Validate email (add if missing)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Invalid email format');
  }

  // Optional: Validate contact as phone (e.g., 10 digits)
  if (!/^[0-9]{10}$/.test(contact)) {
    throw new BadRequestException('Contact must be a valid 10-digit phone number');
  }

  // Validate logo extension if provided (minor fix: handle no extension)
  if (logo) {
    const dotIndex = logo.lastIndexOf('.');
    if (dotIndex === -1) {
      throw new BadRequestException('Logo path must have a valid extension (JPG, JPEG, or PNG)');
    }
    const extension = logo.slice(dotIndex).toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    if (!validExtensions.includes(extension)) {
      throw new BadRequestException('Logo must be a JPG, JPEG, or PNG file'); // <-- Fixed exception
    }
  }

  // Validate products (fixed exception)
  if (!products || products.length === 0) {
    throw new BadRequestException('At least one product must be provided');
  }
  for (const product of products) {
    if (!product.name || typeof product.price !== 'number' || product.price <= 0) {
      throw new BadRequestException('Each product must have a valid name and price > 0');
    }
  }

  // Create OMC (no change—JSON storage works if schema has Json field)
  const omc = await this.prisma.omc.create({
    data: {
      name,
      location,
      logo,
      contactPerson,
      contact,
      email,
      products, // <-- Auto-serializes to JSON
    },
  });

  // Generate JWT (no change)
  const payload = { sub: omc.id, name: omc.name, role: 'OMC_ADMIN' };
  return {
    access_token: this.jwtService.sign(payload),
    omc,
  };
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
  dispensers?: { dispenserNumber: string; pumps: { productName: string; pumpNumber: string }[] }[]
) {
  // Validate omcId exists
  const omc = await this.prisma.omc.findUnique({
    where: { id: omcId },
  });
  if (!omc) {
    throw new BadRequestException('Invalid OMC ID');
  }

  // Validate dispenser numbers are unique (with station name prepended)
  if (dispensers) {
    const dispenserNumbers = dispensers.map((d) => `${name}-${d.dispenserNumber}`);
    const uniqueDispenserNumbers = new Set(dispenserNumbers);
    if (uniqueDispenserNumbers.size !== dispenserNumbers.length) {
      throw new BadRequestException('Dispenser numbers must be unique');
    }

    // Check for existing dispensers
    const existingDispensers = await this.prisma.dispenser.findMany({
      where: { dispenserNumber: { in: dispenserNumbers } },
    });
    if (existingDispensers.length > 0) {
      throw new BadRequestException('One or more dispenser numbers already exist');
    }

    // Validate pump numbers are unique across all dispensers
    const allPumps = dispensers.flatMap((d) => d.pumps);
    const pumpNumbers = allPumps.map((p) => p.pumpNumber);
    const uniquePumpNumbers = new Set(pumpNumbers);
    if (uniquePumpNumbers.size !== pumpNumbers.length) {
      throw new BadRequestException('Pump numbers must be unique');
    }

    // Check for existing pumps
    const existingPumps = await this.prisma.pump.findMany({
      where: { pumpNumber: { in: pumpNumbers } },
    });
    if (existingPumps.length > 0) {
      throw new BadRequestException('One or more pump numbers already exist');
    }
  }

  // Create station, dispensers, products, and pumps in a transaction
  return this.prisma.$transaction(async (prisma) => {
    // Step 1: Create the station with products
    const allPumps = dispensers ? dispensers.flatMap((d) => d.pumps) : [];
    const station = await prisma.station.create({
      data: {
        name,
        omc: { connect: { id: omcId } },
        region,
        district,
        town,
        managerName,
        managerContact,
        products: allPumps.length
          ? {
              create: [...new Set(allPumps.map((p) => p.productName))].map((productName) => ({
                type: productName,
                liters: 0,
                amount: 0,
              })),
            }
          : undefined,
      },
      include: {
        omc: { select: { id: true, name: true } },
        products: { select: { id: true, type: true } },
      },
    });

    // Step 2: Create dispensers and their pumps
    if (dispensers && dispensers.length > 0) {
      for (const disp of dispensers) {
        const dispenserNumber = `${name}-${disp.dispenserNumber}`;
        const dispenser = await prisma.dispenser.create({
          data: {
            dispenserNumber,
            station: { connect: { id: station.id } },
          },
        });

        // Create pumps for this dispenser
        if (disp.pumps && disp.pumps.length > 0) {
          await prisma.pump.createMany({
            data: disp.pumps.map((pump) => {
              const product = station.products.find((p) => p.type === pump.productName);
              if (!product) {
                throw new BadRequestException(`Product ${pump.productName} not found in created station`);
              }
              return {
                pumpNumber: pump.pumpNumber,
                productId: product.id,
                dispenserId: dispenser.id,
              };
            }),
          });
        }
      }
    }

    // Step 3: Fetch the station with dispensers and pumps included
    return prisma.station.findUnique({
      where: { id: station.id },
      include: {
        omc: { select: { id: true, name: true } },
        products: { select: { id: true, type: true } },
        dispensers: {
          select: {
            id: true,
            dispenserNumber: true,
            pumps: { select: { id: true, pumpNumber: true, productId: true } },
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