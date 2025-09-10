import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

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
        where: { id: omcId, deletedAt: null },
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
      region: true,
      district: true,
      town: true,
      managerName: true,
      managerContact: true,
      omcId: true,
      omc: { select: { id: true, name: true } },
      pumps: {
        select: {
          id: true,
          pumpNumber: true,
          product: { select: { id: true, type: true } },
        },
      },
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
  
  //update station and omc
  async updateStation(
    id: number,
    data: {
      name?: string;
      region?: string;
      district?: string;
      town?: string;
      managerName?: string;
      managerContact?: string;
      pumps?: { productName: string; pumpNumber: string }[];
    },
  ) {
    // Validate station exists
    const station = await this.prisma.station.findUnique({
      where: { id, deletedAt: null },
      include: { pumps: true, products: true },
    });
    if (!station) {
      throw new NotFoundException('Station not found');
    }

    // Validate pump numbers are unique if provided
    if (data.pumps) {
      const pumpNumbers = data.pumps.map((p) => p.pumpNumber);
      const uniquePumpNumbers = new Set(pumpNumbers);
      if (uniquePumpNumbers.size !== pumpNumbers.length) {
        throw new BadRequestException('Pump numbers must be unique');
      }

      // Check for existing pump numbers (excluding current station's pumps)
      const existingPumps = await this.prisma.pump.findMany({
        where: {
          pumpNumber: { in: pumpNumbers },
          stationId: { not: id },
        },
      });
      if (existingPumps.length > 0) {
        throw new BadRequestException('One or more pump numbers already exist');
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      // Update station details
      const updatedStation = await prisma.station.update({
        where: { id },
        data: {
          name: data.name,
          region: data.region,
          district: data.district,
          town: data.town,
          managerName: data.managerName,
          managerContact: data.managerContact,
        },
        include: {
          omc: { select: { id: true, name: true } },
          products: { select: { id: true, type: true } },
          pumps: { select: { id: true, pumpNumber: true, productId: true } },
        },
      });

      // Update pumps and products if provided
      if (data.pumps) {
        // Delete existing pumps
        await prisma.pump.deleteMany({ where: { stationId: id } });

        // Create or update products
        const productNames = [...new Set(data.pumps.map((p) => p.productName))];
        await prisma.product.deleteMany({
          where: { stationId: id, type: { notIn: productNames } },
        });

        // Create new products if they don't exist
        for (const productName of productNames) {
          const existingProduct = await prisma.product.findFirst({
            where: { stationId: id, type: productName },
          });
          if (!existingProduct) {
            await prisma.product.create({
              data: {
                type: productName,
                liters: 0,
                amount: 0,
                stationId: id,
              },
            });
          }
        }

        // Create new pumps
        await prisma.pump.createMany({
          data: data.pumps.map((pump) => {
            const product = updatedStation.products.find((p) => p.type === pump.productName);
            if (!product) {
              throw new BadRequestException(`Product ${pump.productName} not found`);
            }
            return {
              pumpNumber: pump.pumpNumber,
              productId: product.id,
              stationId: id,
            };
          }),
        });
      }

      // Return updated station
      return prisma.station.findUnique({
        where: { id },
        include: {
          omc: { select: { id: true, name: true } },
          products: { select: { id: true, type: true } },
          pumps: { select: { id: true, pumpNumber: true, productId: true } },
        },
      });
    });
  }

  // Update OMC
 async updateOmc(
  id: number,
  data: {
    name?: string;
    location?: string;
    logo?: string;
    contactPerson?: string;
    contact?: string;
    email?: string;
    products?: { name: string; price: number }[];
  },
) {
  // Validate OMC exists and fetch products
  const omc = await this.prisma.omc.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      location: true,
      logo: true,
      contactPerson: true,
      contact: true,
      email: true,
      products: true, // Fetch the Json field directly
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!omc) {
    throw new NotFoundException('OMC not found');
  }

  // Validate email if provided
  if (data.email) {
    const existingEmail = await this.prisma.omc.findFirst({
      where: { email: data.email, id: { not: id }, deletedAt: null },
    });
    if (existingEmail) {
      throw new BadRequestException('Email already in use by another OMC');
    }
  }

  // Validate products if provided
  if (data.products) {
    if (!Array.isArray(data.products)) {
      throw new BadRequestException('Products must be an array');
    }
    for (const product of data.products) {
      if (typeof product.name !== 'string' || typeof product.price !== 'number') {
        throw new BadRequestException('Each product must have a name (string) and price (number)');
      }
    }
  }

  // Merge products if provided
  const existingProducts = (omc.products as { name: string; price: number }[]) || [];
  let updatedProducts = existingProducts;
  if (data.products) {
    updatedProducts = existingProducts.map((existingProduct) => {
      const updatedProduct = data.products?.find((p) => p.name === existingProduct.name);
      if (updatedProduct) {
        return { ...existingProduct, price: updatedProduct.price };
      }
      return existingProduct;
    });
  }

  // Update OMC
  return this.prisma.omc.update({
    where: { id },
    data: {
      name: data.name,
      location: data.location,
      logo: data.logo,
      contactPerson: data.contactPerson,
      contact: data.contact,
      email: data.email,
      products: data.products ? updatedProducts : undefined,
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
    },
  });
}

async createPumpAttendant(
  email: string,
  password: string,
  stationId: number,
  omcId?: number,
) {
  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Invalid email format');
  }

  // Validate stationId exists
  const station = await this.prisma.station.findUnique({
    where: { id: stationId },
  });
  if (!station) {
    throw new BadRequestException('Invalid Station ID');
  }

  // Validate omcId if provided
  if (omcId) {
    const omc = await this.prisma.omc.findUnique({
      where: { id: omcId },
    });
    if (!omc) {
      throw new BadRequestException('Invalid OMC ID');
    }
    // Ensure the station belongs to the provided OMC
    if (station.omcId !== omcId) {
      throw new BadRequestException('Station does not belong to the provided OMC');
    }
  }

  // Validate role exists
  const role = await this.prisma.role.findUnique({
    where: { name: 'PUMP_ATTENDANT' },
  });
  if (!role) {
    throw new BadRequestException('Pump Attendant role does not exist');
  }

  // Check if email is already in use
  const existingUser = await this.prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    throw new BadRequestException('Email already in use');
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create the user
  return this.prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: { connect: { id: role.id } },
      station: { connect: { id: stationId } },
      omc: omcId ? { connect: { id: omcId } } : undefined,
    },
    include: {
      role: { select: { id: true, name: true } },
      station: { select: { id: true, name: true } },
      omc: { select: { id: true, name: true } },
    },
  });
}

async getPumpAttendant(id: number) {
  const user = await this.prisma.user.findFirst({
    where: {
      id,
      role: { name: 'PUMP_ATTENDANT' },
      deletedAt: null,
    },
    include: {
      role: { select: { id: true, name: true } },
      station: { select: { id: true, name: true, region: true, district: true, town: true, managerName: true, managerContact: true } },
      omc: { select: { id: true, name: true, location: true, contactPerson: true, contact: true, email: true } },
    },
  });

  if (!user) {
    throw new NotFoundException('Pump Attendant not found or has been deleted');
  }

  return user;
}

async updatePumpAttendant(id: number, email?: string, password?: string, stationId?: number, omcId?: number | null) {
  // Check if the user exists and is a pump attendant
  const user = await this.prisma.user.findFirst({
    where: {
      id,
      role: { name: 'PUMP_ATTENDANT' },
      deletedAt: null,
    },
  });

  if (!user) {
    throw new NotFoundException('Pump Attendant not found or has been deleted');
  }

  // Validate email if provided
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Invalid email format');
    }
    const existingUser = await this.prisma.user.findFirst({
      where: { email, id: { not: id }, deletedAt: null },
    });
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }
  }

  // Validate stationId if provided
  if (stationId) {
    const station = await this.prisma.station.findUnique({
      where: { id: stationId },
    });
    if (!station) {
      throw new BadRequestException('Invalid Station ID');
    }

    // Validate omcId if provided and ensure station belongs to it
    if (omcId) {
      const omc = await this.prisma.omc.findUnique({
        where: { id: omcId },
      });
      if (!omc) {
        throw new BadRequestException('Invalid OMC ID');
      }
      if (station.omcId !== omcId) {
        throw new BadRequestException('Station does not belong to the provided OMC');
      }
    }
  }

  // Hash password if provided
  const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

  // Update the user
  return this.prisma.user.update({
    where: { id },
    data: {
      email: email ?? undefined,
      password: hashedPassword ?? undefined,
      station: stationId ? { connect: { id: stationId } } : undefined,
      omc: omcId !== undefined ? (omcId ? { connect: { id: omcId } } : { disconnect: true }) : undefined,
    },
    include: {
      role: { select: { id: true, name: true } },
      station: { select: { id: true, name: true } },
      omc: { select: { id: true, name: true } },
    },
  });
}

async deletePumpAttendant(id: number) {
  // Check if the user exists and is a pump attendant
  const user = await this.prisma.user.findFirst({
    where: {
      id,
      role: { name: 'PUMP_ATTENDANT' },
      deletedAt: null,
    },
  });

  if (!user) {
    throw new NotFoundException('Pump Attendant not found or has been deleted');
  }

  // Perform soft deletion
  return this.prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
    include: {
      role: { select: { id: true, name: true } },
      station: { select: { id: true, name: true } },
      omc: { select: { id: true, name: true } },
    },
  });
}

async getAllPumpAttendants() {
  return this.prisma.user.findMany({
    where: {
      role: { name: 'PUMP_ATTENDANT' },
      deletedAt: null,
    },
    include: {
      role: { select: { id: true, name: true } },
      station: { select: { id: true, name: true } },
      omc: { select: { id: true, name: true } },
    },
  });
}
}
