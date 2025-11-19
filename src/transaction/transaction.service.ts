import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import Decimal from 'decimal.js';

type FilterParams = {
  omcId: number | null;
  stationId: number | null;
  page: number;
  limit: number;
};

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. GET /transactions/:token
  async getTokenDetails(token: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { token },
      include: {
        productCatalog: { select: { id: true, name: true, defaultPrice: true } },
        station: { select: { id: true, name: true, region: true, district: true, town: true } },
        dispenser: { select: { id: true, dispenserNumber: true } },
        pump: { select: { id: true, pumpNumber: true } },
        pumpAttendant: { select: { id: true, name: true, email: true, contact: true } },
        driver: { select: { id: true, name: true, contact: true, nationalId: true, vehicleCount: true, companyName: true } },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Token ${token} not found`);
    }

    return transaction;
  }

async searchTokens(q: string) {
  if (!q || q.length < 2) return [];
  return this.prisma.transaction.findMany({
    where: {
      token: { contains: q, mode: 'insensitive' },
      // deletedAt: null,
    },
    select: { token: true },
    take: 12,
    orderBy: { createdAt: 'desc' },
  });
}

  // 2. PATCH /transactions/:token - Mark as used
 async useToken(
  token: string,
  attendantId: number,
  data: {
    productCatalogId?: number;
    liters?: number;
    amount?: number;
    stationId?: number;
    dispenserId?: number;
    pumpId?: number;
  },
) {
  // 1. Find unused token
  const tokenRecord = await this.prisma.transaction.findUnique({
    where: { token, deletedAt: null },
    include: {
      driver: { select: { id: true, name: true, contact: true } },
      productCatalog: true,
      station: true,
    },
  });

  if (!tokenRecord) {
    throw new NotFoundException(`Token ${token} not found or already used`);
  }

  // 2. Validate attendant
  const attendant = await this.prisma.user.findFirst({
    where: {
      id: attendantId,
      role: { name: 'PUMP_ATTENDANT' },
      deletedAt: null,
      stationId: data.stationId ?? tokenRecord.stationId ?? undefined,
    },
  });

  if (!attendant) {
    throw new NotFoundException('Fuel attendant not found or not assigned to this station');
  }

  // 3. Resolve station (from input or token)
  const stationId = data.stationId ?? tokenRecord.stationId;
  if (!stationId) {
    throw new BadRequestException('Station ID is required');
  }

  const station = await this.prisma.station.findUnique({
    where: { id: stationId },
    include: { omc: true },
  });

  if (!station) throw new NotFoundException('Station not found');

  // 4. Validate pump → dispenser → station chain
  let pumpRecord: any = null;
  if (data.pumpId) {
    pumpRecord = await this.prisma.pump.findUnique({
      where: { id: data.pumpId },
      include: {
        dispenser: { include: { station: true } },
        productCatalog: true,
      },
    });

    if (!pumpRecord) throw new NotFoundException('Pump not found');
    if (pumpRecord.dispenser?.stationId !== stationId)
      throw new BadRequestException('Pump does not belong to the provided station');
    if (data.dispenserId && pumpRecord.dispenserId !== data.dispenserId)
      throw new BadRequestException('Pump does not belong to the provided dispenser');
  }

  // 5. Resolve product catalog and get **station-specific price**
  const catalogId = data.productCatalogId ?? tokenRecord.productCatalogId;
  if (!catalogId) {
    throw new BadRequestException('Product catalog ID is required');
  }

  const stationPrice = await this.prisma.stationProductPrice.findUnique({
    where: {
      catalogId_stationId: {
        catalogId,
        stationId,
      },
    },
    include: {
      catalog: true,
    },
  });

  if (!stationPrice) {
    throw new BadRequestException(
      'Product is not available at this station or price not set',
    );
  }

  // 6. Calculate amount if only liters provided (or validate consistency)
  let finalLiters = data.liters ?? tokenRecord.liters;
  let finalAmount = data.amount ?? tokenRecord.amount;

  const price = new Decimal(stationPrice.price);

if (!finalLiters && finalAmount) {
  // amount ÷ price = liters
  finalLiters = new Decimal(finalAmount).div(price).toDecimalPlaces(3).toNumber();
} else if (finalLiters && !finalAmount) {
  // liters × price = amount
  finalAmount = new Decimal(finalLiters).mul(price).toDecimalPlaces(2).toNumber();
} else if (finalLiters && finalAmount) {
  // verify consistency
  const expectedLiters = new Decimal(finalAmount).div(price).toDecimalPlaces(3);
  const diff = new Decimal(finalLiters).minus(expectedLiters).abs();
  if (diff.greaterThan(0.01)) {
    console.warn(
      `⚠️ Warning: entered liters (${finalLiters}) differ slightly from expected (${expectedLiters.toNumber()})`,
    );
  }
}

  // 7. Update transaction: mark as used + fill details
  return this.prisma.transaction.update({
    where: { token },
    data: {
      deletedAt: new Date(), // Mark as used
      pumpAttendant: { connect: { id: attendantId } },
      station: { connect: { id: stationId } },
      productCatalog: { connect: { id: catalogId } },
      dispenser: data.dispenserId ? { connect: { id: data.dispenserId } } : undefined,
      pump: data.pumpId ? { connect: { id: data.pumpId } } : undefined,
      liters: finalLiters,
      amount: finalAmount,
    },
    include: {
      productCatalog: {
        select: { id: true, name: true, defaultPrice: true },
      },
      station: {
        select: { id: true, name: true, region: true, district: true, town: true },
      },
      dispenser: {
        select: { id: true, dispenserNumber: true },
      },
      pump: {
        select: { id: true, pumpNumber: true },
      },
      pumpAttendant: {
        select: { id: true, name: true, email: true, contact: true },
      },
      driver: {
        select: { id: true, name: true, contact: true, vehicleCount: true, companyName: true },
      },
    },
  });
}

  // 3. GET /transactions?pumpAttendantId={id}
  async getSalesHistory(attendantId: number) {
    // Validate attendant
    const attendant = await this.prisma.user.findFirst({
      where: {
        id: attendantId,
        role: { name: 'PUMP_ATTENDANT' },
        deletedAt: null,
      },
    });

    if (!attendant) {
      throw new NotFoundException('Fuel attendant not found');
    }

    return this.prisma.transaction.findMany({
      where: {
        pumpAttendantId: attendantId,
        deletedAt: { not: null }, // Only completed (used) sales
      },
      include: {
        productCatalog: { select: { id: true, name: true} },
        station: { select: { id: true, name: true, region: true, district: true, town: true } },
        dispenser: { select: { id: true, dispenserNumber: true } },
        pump: { select: { id: true, pumpNumber: true } },
        driver: { select: { id: true, contact: true, vehicleCount: true, companyName: true  } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

   async calculateLitersByToken(
    token: string,
    productName: string,
    attendantId: number,
  ) {
    // 1. Find token + ensure it's unused
    const transaction = await this.prisma.transaction.findUnique({
      where: { token, deletedAt: null },
      include: {
        driver: true,
        station: true,
      },
    });

    if (!transaction) throw new NotFoundException(`Token ${token} not found or already used`);
    if (!transaction.amount) throw new BadRequestException('Token has no amount');

    // 2. Validate attendant
    const attendant = await this.prisma.user.findFirst({
      where: {
        id: attendantId,
        role: { name: 'PUMP_ATTENDANT' },
        deletedAt: null,
        stationId: {not: null},
      },
      include: {
      station: {
        include: {
          omc: true,
          stationProductPrices: {
            include: {
              catalog: true,
            },
          },
        },
      },
    },
  });

    if (!attendant?.station) {
      throw new NotFoundException('Attendant not assigned to a station');
    }

     const stationId = attendant.station.id;

  // 3. Find matching product catalog by name (case-insensitive)
  const catalog = attendant.station.stationProductPrices
    .map((sp: any) => sp.catalog)
    .find(
      (c: any) =>
        c.name.toLowerCase() === productName.toLowerCase() && c.deletedAt === null,
    );

  if (!catalog) {
    const available = attendant.station.stationProductPrices
      .map((sp: any) => sp.catalog.name)
      .filter(Boolean)
      .join(', ');
    throw new BadRequestException(
      `Product "${productName}" not available at this station. Available: ${available || 'none'}`,
    );
  }

  // 4. Get current station price for this product
  const stationPrice = attendant.station.stationProductPrices.find(
    (sp: any) => sp.catalogId === catalog.id,
  );

  if (!stationPrice || !stationPrice.price || stationPrice.price <= 0) {
    throw new BadRequestException('No valid price set for this product at the station');
  }

  // 5. Calculate liters
 const pricePerLiter = new Decimal(stationPrice.price);
const liters = new Decimal(transaction.amount).div(pricePerLiter).toDecimalPlaces(6).toNumber();

  return {
    token: transaction.token,
    amount: transaction.amount,
    product: catalog.name,
    pricePerLiter,
    liters: parseFloat(liters.toFixed(6)),
    station: {
      id: attendant.station.id,
      name: attendant.station.name,
    },
  };
}

 async getTransactionDetails(id: number) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id }, // soft-delete guard
      select: {
        id: true,
        token: true,
        amount: true,
        liters: true,
        createdAt: true,
        deletedAt: true,

        // ----- PRODUCT -----
        productCatalog: {
          select: {
            id: true,
            name: true,
            defaultPrice: true,
            omc: { select: { id: true, name: true } },
          },
        },

        // ----- STATION -----
        station: {
          select: {
            id: true,
            name: true,
            region: true,
            district: true,
            town: true,
            omc: { select: { id: true, name: true } },
          },
        },

        // ----- DISPENSER -----
        dispenser: {
          select: {
            id: true,
            dispenserNumber: true,
          },
        },

        // ----- PUMP -----
        pump: {
          select: {
            id: true,
            pumpNumber: true,
            productCatalog: {
              select: { id: true, name: true },
            },
          },
        },

        // ----- ATTENDANT -----
        pumpAttendant: {
          select: {
            id: true,
            name: true,
            email: true,
            contact: true,
          },
        },

        // ----- DRIVER (if any) -----
        driver: {
          select: {
            id: true,
            name: true,
            nationalId: true,
            contact: true,
            vehicleCount: true,
            companyName: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }
  

  async getFilteredTransactions({ omcId, stationId, page, limit }: FilterParams) {
  const skip = (page - 1) * limit;

  const where: any = {};

  if (stationId) {
    where.stationId = stationId;
  } else if (omcId) {
    // Join through station → omc
    where.station = { omcId };
  }

  return this.prisma.transaction.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      token: true,
      amount: true,
      liters: true,
      createdAt: true,
      deletedAt: true,

      productCatalog: { select: { name: true } },
      station: { select: { name: true, omc: { select: { name: true } } } },
      dispenser: { select: { dispenserNumber: true } },
      pump: { select: { pumpNumber: true } },
      pumpAttendant: { select: { name: true } },
      driver: { select: { name: true, companyName: true } },
    },
  });
}

 async getOmcFilters(omcId?: number) {
    const [omcs, stations] = await Promise.all([
      // Always get all active OMCs
      this.prisma.omc.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),

      // Only get stations if omcId is provided
      omcId
        ? this.prisma.station.findMany({
            where: { deletedAt: null, omcId },
            select: {
              id: true,
              name: true,
              omc: { select: { name: true } },
            },
            orderBy: { name: 'asc' },
          })
        : [],
    ]);

    return {
      omcs,
      stations: omcId ? stations : [],
    };
  }
}