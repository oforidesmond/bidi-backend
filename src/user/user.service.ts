import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';

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
        catalog: {
        select: {
          id: true,
          name: true,
          defaultPrice: true,
          createdAt: true,
        },
      },
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }  

async getStations(omcId?: number) {
  const where: any = { deletedAt: null };

  if (omcId) {
    const omc = await this.prisma.omc.findUnique({
      where: { id: omcId, deletedAt: null },
    });
    if (!omc) {
      throw new BadRequestException('Invalid OMC ID');
    }

    where.omcId = omcId;
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

      // ✅ Include dispensers and pumps with productCatalog
      dispensers: {
        select: {
          id: true,
          dispenserNumber: true,
          pumps: {
            select: {
              id: true,
              pumpNumber: true,
              productCatalog: {
                select: {
                  id: true,
                  name: true,
                  defaultPrice: true,
                },
              },
            },
          },
        },
      },

      stationProductPrices: {
        where: { deletedAt: null },
        select: {
          id: true,
          price: true,
          effectiveFrom: true,
          catalog: {
            select: {
              id: true,
              name: true,
              defaultPrice: true,
            },
          },
        },
      },

      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
} 
  
async count(omcId?: number) {
  const where: any = { deletedAt: null };

  if (omcId) {
    // Validate OMC exists
    const omc = await this.prisma.omc.findUnique({
      where: { id: omcId, deletedAt: null },
    });
    if (!omc) {
      throw new BadRequestException('Invalid OMC ID');
    }

    where.omcId = omcId;
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


async countAttendants(omcId?: number) {
  const where: any = {
    role: { name: 'PUMP_ATTENDANT' },
    deletedAt: null,
  };

  if (omcId) {
    // Validate OMC exists
    const omc = await this.prisma.omc.findUnique({
      where: { id: omcId, deletedAt: null },
    });
    if (!omc) {
      throw new BadRequestException('Invalid OMC ID');
    }

    where.omcId = omcId;
  }

  const count = await this.prisma.user.count({ where });
  return { attendants: count };
}
 

async updateStation(
  id: number,
  data: {
    name?: string;
    region?: string;
    district?: string;
    town?: string;
    managerName?: string;
    managerContact?: string;
    pumps?: {
      productName: string;
      pumpNumber: string;
      dispenserNumber: string;
      attendantIds?: number[];
    }[];
    stationProductPrices?: { id?:number; catalogId: number; price: number; effectiveFrom?: string }[],
  },
) {
  // Validate that the station exists
  const station = await this.prisma.station.findUnique({
    where: { id, deletedAt: null },
    include: {
      omc: true,
      dispensers: true,
      stationProductPrices: true,
    },
  });

  if (!station) throw new NotFoundException('Station not found');

  // Validate pump numbers for uniqueness
  if (data.pumps) {
    const pumpNumbers = data.pumps.map((p) => p.pumpNumber);
    const uniquePumpNumbers = new Set(pumpNumbers);
    if (uniquePumpNumbers.size !== pumpNumbers.length)
      throw new BadRequestException('Pump numbers must be unique');

    // Ensure no pumpNumber already exists elsewhere
    const existingPumps = await this.prisma.pump.findMany({
      where: {
        pumpNumber: { in: pumpNumbers },
        dispenser: { stationId: { not: id } },
      },
    });

    if (existingPumps.length > 0)
      throw new BadRequestException('One or more pump numbers already exist in another station');
  }

  return this.prisma.$transaction(async (prisma) => {
    await prisma.station.update({
      where: { id },
      data: {
        name: data.name,
        region: data.region,
        district: data.district,
        town: data.town,
        managerName: data.managerName,
        managerContact: data.managerContact,
      },
    });

    // ✅ Update pumps if provided
    if (data.pumps && data.pumps.length > 0) {
      // Delete all existing pumps linked to this station’s dispensers
      const dispenserIds = station.dispensers.map((d) => d.id);
      if (dispenserIds.length > 0) {
        await prisma.pump.deleteMany({ where: { dispenserId: { in: dispenserIds } } });
      }

      // Ensure all referenced products exist in the OMC’s ProductCatalog
      const omcCatalog = await prisma.productCatalog.findMany({
        where: { omcId: station.omcId, deletedAt: null },
      });

      for (const pump of data.pumps) {
        const catalogItem = omcCatalog.find((c) => c.name === pump.productName);
        if (!catalogItem) {
          throw new BadRequestException(
            `Product "${pump.productName}" does not exist in OMC's catalog`,
          );
        }

        // Find dispenser within this station
        const dispenser = station.dispensers.find(
          (d) => d.dispenserNumber === pump.dispenserNumber,
        );
        if (!dispenser) {
          throw new BadRequestException(
            `Dispenser ${pump.dispenserNumber} not found in this station`,
          );
        }

        // Validate attendants (if any)
        if (pump.attendantIds?.length) {
          const attendants = await prisma.user.findMany({
            where: {
              id: { in: pump.attendantIds },
              role: { name: 'PUMP_ATTENDANT' },
              stationId: id,
              deletedAt: null,
            },
          });

          if (attendants.length !== pump.attendantIds.length) {
            throw new BadRequestException(
              'One or more attendant IDs are invalid or not assigned to this station',
            );
          }
        }

        // Create the pump
        await prisma.pump.create({
          data: {
            pumpNumber: pump.pumpNumber,
            productCatalogId: catalogItem.id,
            dispenserId: dispenser.id,
            attendants: pump.attendantIds
              ? { connect: pump.attendantIds.map((attId) => ({ id: attId })) }
              : undefined,
          },
        });

        // Ensure station has a price record for this product
        const existingPrice = await prisma.stationProductPrice.findFirst({
          where: { catalogId: catalogItem.id, stationId: id },
        });

        if (!existingPrice) {
          await prisma.stationProductPrice.create({
            data: {
              catalogId: catalogItem.id,
              stationId: id,
              price: catalogItem.defaultPrice ?? 0,
            },
          });
        }
      }
    }
     if (data.stationProductPrices?.length) {
      for (const sp of data.stationProductPrices) {
        const effectiveFrom = sp.effectiveFrom ? new Date(sp.effectiveFrom) : new Date();

        if (sp.id) {
          // Update by id (ensure it belongs to this station)
          await prisma.stationProductPrice.update({
            where: { id: sp.id },
            data: { price: sp.price, effectiveFrom },
          });
        } else if (sp.catalogId) {
          // Upsert by (stationId, catalogId). If you don't have a unique constraint, emulate with findFirst.
          const existing = await prisma.stationProductPrice.findFirst({
            where: { stationId: id, catalogId: sp.catalogId, deletedAt: null },
            select: { id: true },
          });
          if (existing) {
            await prisma.stationProductPrice.update({
              where: { id: existing.id },
              data: { price: sp.price, effectiveFrom },
            });
          } else {
            await prisma.stationProductPrice.create({
              data: { stationId: id, catalogId: sp.catalogId, price: sp.price, effectiveFrom },
            });
          }
        }
      }
    }

    // ✅ Return updated station details
    return prisma.station.findUnique({
      where: { id },
      include: {
        omc: { select: { id: true, name: true } },
        dispensers: {
          select: {
            id: true,
            dispenserNumber: true,
            pumps: {
              select: {
                id: true,
                pumpNumber: true,
                productCatalog: { select: { id: true, name: true } },
                attendants: { select: { id: true, name: true } },
              },
            },
          },
        },
        stationProductPrices: {
          select: {
            id: true,
            price: true,
            effectiveFrom: true,
            catalog: { select: { id: true, name: true } },
          },
        },
      },
    });
  });
}

 
async updateOmc(
  id: number,
  data: {
    name?: string;
    location?: string;
    logo?: string;
    contactPerson?: string;
    contact?: string;
    email?: string;
    products?: { name: string; defaultPrice: number }[];
  },
) {
  // 1️⃣ Check if OMC exists
  const omc = await this.prisma.omc.findFirst({
    where: { id, deletedAt: null },
    include: { catalog: true },
  });

  if (!omc) throw new NotFoundException('OMC not found');

  // 2️⃣ Validate unique email if provided
  if (data.email) {
    const existingEmail = await this.prisma.omc.findFirst({
      where: {
        email: data.email,
        id: { not: id },
        deletedAt: null,
      },
    });
    if (existingEmail) throw new BadRequestException('Email already in use by another OMC');
  }

  // 3️⃣ Validate products if provided
  if (data.products) {
    if (!Array.isArray(data.products)) {
      throw new BadRequestException('Products must be an array');
    }

    for (const product of data.products) {
      if (typeof product.name !== 'string' || typeof product.defaultPrice !== 'number') {
        throw new BadRequestException('Each product must have a name (string) and defaultPrice (number)');
      }
    }

    // 4️⃣ Update or create products in ProductCatalog
    for (const product of data.products) {
      const existingProduct = await this.prisma.productCatalog.findFirst({
        where: { omcId: id, name: product.name, deletedAt: null },
      });

      if (existingProduct) {
        // Update existing product
        await this.prisma.productCatalog.update({
          where: { id: existingProduct.id },
          data: { defaultPrice: product.defaultPrice },
        });
      } else {
        // Create new product
        await this.prisma.productCatalog.create({
          data: {
            name: product.name,
            defaultPrice: product.defaultPrice,
            omcId: id,
          },
        });
      }
    }
  }

  // 5️⃣ Update OMC details
  const updatedOmc = await this.prisma.omc.update({
    where: { id },
    data: {
      name: data.name,
      location: data.location,
      logo: data.logo,
      contactPerson: data.contactPerson,
      contact: data.contact,
      email: data.email,
    },
    include: {
      catalog: true, // Return all updated products
    },
  });

  return updatedOmc;
}


async createPumpAttendant(
  name: string,
  nationalId: string,
  contact: string,
  gender: string,
  cardImage: string | undefined,
  email: string,
  password: string,
  stationId: number,
  omcId?: number,
) {
  // Validate cardImage extension if provided
  if (cardImage) {
  const dotIndex = cardImage.lastIndexOf('.');
  if (dotIndex === -1) {
    throw new BadRequestException('Card image path must have a valid extension (JPG, JPEG, or PNG)');
  }
  const extension = cardImage.slice(dotIndex).toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png'];
  if (!validExtensions.includes(extension)) {
    throw new BadRequestException('Card image must be a JPG, JPEG, or PNG file');
  }
}  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Invalid email format');
  }  // Validate stationId exists
  const station = await this.prisma.station.findUnique({
    where: { id: stationId },
  });
  if (!station) {
    throw new BadRequestException('Invalid Station ID');
  }  // Validate omcId if provided
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
  }  // Validate role exists
  const role = await this.prisma.role.findUnique({
    where: { name: 'PUMP_ATTENDANT' },
  });
  if (!role) {
    throw new BadRequestException('Pump Attendant role does not exist');
  }  // Check if email is already in use
  const existingUser = await this.prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    throw new BadRequestException('Email already in use');
  }  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);  // Create the user
  return this.prisma.user.create({
    data: {
      name,
      nationalId,
      contact,
      gender,
      cardUrl: cardImage,
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
      pumps: { select: { id: true, pumpNumber: true, dispenser: { select: { station: { select: { id: true, name: true } } } } } }, // reflect dispenser relation
    },
  });  if (!user) {
    throw new NotFoundException('Pump Attendant not found or has been deleted');
  }  return user;
}

async updatePumpAttendant(
  id: number,
  name?: string,
  nationalId?: string,
  contact?: string,
  gender?: string,
  cardImage?: string,
  email?: string,
  password?: string,
  stationId?: number,
  omcId?: number | null,
) {
  // Validate cardImage extension if provided
  if (cardImage) {
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const extension = cardImage.slice(cardImage.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(extension)) {
      throw new BadRequestException('Card image must be a JPG, JPEG, or PNG file');
    }
  }  // Check if the user exists and is a pump attendant
  const user = await this.prisma.user.findFirst({
    where: {
      id,
      role: { name: 'PUMP_ATTENDANT' },
      deletedAt: null,
    },
  });  if (!user) {
    throw new NotFoundException('Pump Attendant not found or has been deleted');
  }  // Validate email if provided
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
  }  // Validate stationId if provided
  if (stationId) {
    const station = await this.prisma.station.findUnique({
      where: { id: stationId },
    });
    if (!station) {
      throw new BadRequestException('Invalid Station ID');
    }// Validate omcId if provided and ensure station belongs to it
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
}  }  // Hash password if provided
  const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;  // Update the user
  return this.prisma.user.update({
    where: { id },
    data: {
      name: name ?? undefined,
      nationalId: nationalId ?? undefined,
      contact: contact ?? undefined,
      gender: gender ?? undefined,
      cardUrl: cardImage ?? undefined,
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
  });  if (!user) {
    throw new NotFoundException('Pump Attendant not found or has been deleted');
  }  // Perform soft deletion
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
      pumps: { select: { id: true, pumpNumber: true, dispenser: { select: { station: { select: { id: true, name: true } } } } } }, // reflect dispenser relation
    },
  });
}

async assignAttendantsToPump(pumpId: number, attendantIds: number[]) {
  // Validate pump exists
  const pump = await this.prisma.pump.findUnique({
    where: { id: pumpId, deletedAt: null },
    include: { dispenser: { include: { station: { include: { users: { where: { role: { name: 'PUMP_ATTENDANT' } } } } } } } },
  });
  if (!pump) {
    throw new NotFoundException('Pump not found');
  }  // Validate attendants exist and are pump attendants
  const attendants = await this.prisma.user.findMany({
    where: {
      id: { in: attendantIds },
      role: { name: 'PUMP_ATTENDANT' },
      deletedAt: null,
    },
  });
  if (attendants.length !== attendantIds.length) {
    throw new BadRequestException('One or more attendant IDs are invalid or not pump attendants');
  }  // Ensure attendants belong to the same station as the pump
  const stationUsers = pump.dispenser?.station.users;
  const stationAttendantIds = stationUsers?.map((user) => user.id);
  if (!attendantIds.every((id) => stationAttendantIds?.includes(id))) {
    throw new BadRequestException('All attendants must belong to the same station as the pump');
  }  // Update the pump with the new attendants
  return this.prisma.pump.update({
    where: { id: pumpId },
    data: {
      attendants: { connect: attendantIds.map((id) => ({ id })) },
    },
    include: {
      attendants: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

async removeAttendantsFromPump(pumpId: number, attendantIds: number[]) {
  // Validate pump exists
  const pump = await this.prisma.pump.findUnique({
    where: { id: pumpId, deletedAt: null },
  });
  if (!pump) {
    throw new NotFoundException('Pump not found');
  }  // Validate attendants exist
  const attendants = await this.prisma.user.findMany({
    where: {
      id: { in: attendantIds },
      role: { name: 'PUMP_ATTENDANT' },
      deletedAt: null,
    },
  });
  if (attendants.length !== attendantIds.length) {
    throw new BadRequestException('One or more attendant IDs are invalid');
  }  // Disconnect attendants from the pump
  return this.prisma.pump.update({
    where: { id: pumpId },
    data: {
      attendants: { disconnect: attendantIds.map((id) => ({ id })) },
    },
    include: {
      attendants: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

async getPumpAttendants(pumpId: number) {
  const pump = await this.prisma.pump.findUnique({
    where: { id: pumpId, deletedAt: null },
    include: {
      attendants: {
        where: { deletedAt: null },
        select: { id: true, name: true, email: true, station: { select: { id: true, name: true } } },
      },
    },
  });
  if (!pump) {
    throw new NotFoundException('Pump not found');
  }
  return pump.attendants;
}

async getAttendantPumps(attendantId: number) {
  const user = await this.prisma.user.findFirst({
    where: {
      id: attendantId,
      role: { name: 'PUMP_ATTENDANT' },
      deletedAt: null,
    },
    include: {
      pumps: {
        where: { deletedAt: null },
        select: { id: true, pumpNumber: true, dispenser: { select: { station: { select: { id: true, name: true } } } } },
      },
    },
  });
  if (!user) {
    throw new NotFoundException('Pump Attendant not found');
  }
  return user.pumps;
}

async getPumpsByStation(stationId: number) {
  // 1️⃣ Validate station existence
  const station = await this.prisma.station.findFirst({
    where: { id: stationId, deletedAt: null },
  });
  if (!station) {
    throw new NotFoundException('Station not found');
  }

  // 2️⃣ Fetch pumps through dispensers belonging to this station
  return this.prisma.pump.findMany({
    where: {
      dispenser: {
        stationId: stationId,
        deletedAt: null,
      },
      deletedAt: null,
    },
    select: {
      id: true,
      pumpNumber: true,
      productCatalog: {
        select: {
          id: true,
          name: true,
          defaultPrice: true,
        },
      },
      dispenser: {
        select: {
          id: true,
          dispenserNumber: true,
        },
      },
    },
  });
}

async buyFuelToken(userId: number, amount: number) {
  // 1️⃣ Validate driver
  const driver = await this.prisma.user.findFirst({
    where: {
      id: userId,
      role: { name: 'DRIVER' },
      deletedAt: null,
    },
  });

  if (!driver) {
    throw new NotFoundException('Driver not found or has been deleted');
  }

  // 2️⃣ Generate token
  const token = nanoid(12);

  // 3️⃣ Create bare transaction (station, product, liters filled in later by attendant)
  return this.prisma.transaction.create({
    data: {
      driver: { connect: { id: driver.id } },
      amount,
      token,
    },
    select: {
      id: true,
      token: true,
      amount: true,
      createdAt: true,
    },
  });
}

async getDriverTransactions(userId: number, status?: 'USED' | 'UNUSED') {
  // Validate driver (user with DRIVER role and corresponding Driver record)
  const driver = await this.prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { role: true },
  });
  if (!driver || driver.role.name !== 'DRIVER') {
    throw new NotFoundException('Driver not found or has been deleted');
  }

  // Build where clause based on status
  const where: any = {
    driverId: driver.id,
  };

   if (status === 'USED') {
    where.deletedAt = { not: null };
  } else if (status === 'UNUSED') {
    where.deletedAt = null;
  }

  // Fetch transactions
  return this.prisma.transaction.findMany({
    where,
    include: {
       productCatalog: {
        select: { id: true, name: true, defaultPrice: true },
      },
      station: { select: { id: true, name: true } },
      pumpAttendant: { select: { id: true, name: true, contact: true } },
      pump: { select: { id: true, pumpNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async getProducts() {
  return this.prisma.productCatalog.findMany({
    where: { deletedAt: null },
    distinct: ['name'],
    orderBy: { name: 'asc' },
    include: { stationPrices: true },
  });
}

async getAvailableProducts(attendantId: number) {
  const attendant = await this.prisma.user.findFirst({
    where: { id: attendantId, role: { name: 'PUMP_ATTENDANT' }, deletedAt: null },
    include: {
      station: {
        include: {
          stationProductPrices: {
            include: { catalog: true },
            where: { deletedAt: null },
          },
          dispensers: {
            include: {
              pumps: {
                include: { productCatalog: true },
                where: { deletedAt: null },
              },
            },
          },
        },
      },
      pumps: {
        include: { productCatalog: true, dispenser: true },
        where: { deletedAt: null },
      },
    },
  });

  if (!attendant?.station) throw new NotFoundException('Station not found');

  return {
    station: {
      id: attendant.station.id,
      name: attendant.station.name,
      products: attendant.station.stationProductPrices.map(sp => ({
        id: sp.catalog.id,
        name: sp.catalog.name,
        pricePerLiter: sp.price,
      })),
      dispensers: attendant.station.dispensers.map(d => ({
        id: d.id,
        dispenserNumber: d.dispenserNumber,
        pumps: d.pumps.map(p => ({
          id: p.id,
          pumpNumber: p.pumpNumber,
          product: p.productCatalog.name,
        })),
      })),
    },
    assignedPumps: attendant.pumps.map(p => ({
      id: p.id,
      pumpNumber: p.pumpNumber,
      product: p.productCatalog.name,
      dispenserNumber: p.dispenser?.dispenserNumber,
    })),
  };
}

async getDriverMobileNumber(userId: number) {
  const driver = await this.prisma.user.findFirst({
    where: { id: userId, deletedAt: null, role: { name: 'DRIVER' } },
  });
  if (!driver) {
    throw new NotFoundException('Driver not found or has been deleted');
  }
  return driver.contact;
}
}