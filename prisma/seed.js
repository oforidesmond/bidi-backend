const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // === 1. Seed Roles ===
  const roleNames = ['OMC_ADMIN', 'STATION_MANAGER', 'PUMP_ATTENDANT', 'DRIVER'];
  const createdRoles = [];

  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    createdRoles.push(role);
    console.log(`Role: ${role.name}`);
  }

  // === 2. Seed OMCs ===
  const omcData = [
    { name: 'Oil Marketing Co 1' },
    { name: 'Oil Marketing Co 2' },
  ];

  const createdOmcs = [];
  for (const data of omcData) {
    const omc = await prisma.omc.upsert({
      where: { name: data.name },
      update: {},
      create: data,
    });
    createdOmcs.push(omc);
    console.log(`OMC: ${omc.name}`);
  }

  // === 3. Seed Product Catalog ===
  const catalogData = [
    { omcId: createdOmcs[0].id, name: 'Diesel', defaultPrice: 25.00 },
    { omcId: createdOmcs[0].id, name: 'Gasoline', defaultPrice: 28.50 },
    { omcId: createdOmcs[1].id, name: 'Diesel', defaultPrice: 24.80 },
  ];

  const createdCatalogs = [];
  for (const data of catalogData) {
    const catalog = await prisma.productCatalog.upsert({
      where: {
        omcId_name: { omcId: data.omcId, name: data.name },
      },
      update: { defaultPrice: data.defaultPrice },
      create: data,
    });
    createdCatalogs.push(catalog);
    console.log(`Catalog: ${catalog.name} @ ${catalog.defaultPrice} GHS/L`);
  }

  // === 4. Seed Stations ===
  const stationData = [
    {
      name: 'Station A',
      region: 'Greater Accra',
      district: 'Accra Metropolitan',
      town: 'Accra',
      managerName: 'John Doe',
      managerContact: '1234567890',
      omcId: createdOmcs[0].id,
    },
    {
      name: 'Station B',
      region: 'Ashanti',
      district: 'Kumasi Metropolitan',
      town: 'Kumasi',
      managerName: 'Jane Smith',
      managerContact: '0987654321',
      omcId: createdOmcs[1].id,
    },
  ];

  const createdStations = [];
  for (const data of stationData) {
    const station = await prisma.station.upsert({
      where: { name_omcId: { name: data.name, omcId: data.omcId } },
      update: {},
      create: data,
    });
    createdStations.push(station);
    console.log(`Station: ${station.name}`);
  }

  // === 5. Seed Station-Specific Prices ===
  const priceData = [
    {
      catalogId: createdCatalogs.find(c => c.name === 'Diesel' && c.omcId === createdOmcs[0].id)?.id,
      stationId: createdStations[0].id,
      price: 25.50,
    },
  ].filter(p => p.catalogId);

  for (const data of priceData) {
    await prisma.stationProductPrice.upsert({
      where: { catalogId_stationId: { catalogId: data.catalogId, stationId: data.stationId } },
      update: { price: data.price },
      create: data,
    });
    const catalog = await prisma.productCatalog.findUnique({ where: { id: data.catalogId } });
    console.log(`Price override: ${catalog?.name} @ ${data.price} GHS/L at ${createdStations.find(s => s.id === data.stationId)?.name}`);
  }

  // === 6. Seed Users ===
  const userData = [
    {
      email: 'admin@example.com',
      password: await bcrypt.hash('password123', 10),
      roleId: createdRoles.find(r => r.name === 'OMC_ADMIN').id,
      omcId: createdOmcs[0].id,
    },
    {
      email: 'station_manager@example.com',
      password: await bcrypt.hash('password123', 10),
      roleId: createdRoles.find(r => r.name === 'STATION_MANAGER').id,
      stationId: createdStations[0].id,
    },
    {
      email: 'attendant@example.com',
      password: await bcrypt.hash('password123', 10),
      roleId: createdRoles.find(r => r.name === 'PUMP_ATTENDANT').id,
      stationId: createdStations[0].id,
    },
    {
      email: 'driver@example.com',
      password: await bcrypt.hash('password123', 10),
      roleId: createdRoles.find(r => r.name === 'DRIVER').id,
      name: 'Driver One',
      contact: '1234567890',
      nationalId: 'GHA-123456789',
      vehicleCount: 2,
      companyName: 'Freight Co',
      region: 'Greater Accra',
      district: 'Accra Central',
    },
  ];

  const createdUsers = [];
  for (const data of userData) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: data,
    });
    createdUsers.push(user);
    console.log(`User: ${user.email} (${user.roleId === createdRoles.find(r => r.name === 'DRIVER')?.id ? 'Driver' : 'Staff'})`);
  }

  // === 7. Seed Dispensers ===
  const dispenserData = [
    { dispenserNumber: 'DISP-001', stationId: createdStations[0].id },
    { dispenserNumber: 'DISP-002', stationId: createdStations[1].id },
  ];

  const createdDispensers = [];
  for (const data of dispenserData) {
    const dispenser = await prisma.dispenser.upsert({
      where: { dispenserNumber: data.dispenserNumber },
      update: {},
      create: data,
    });
    createdDispensers.push(dispenser);
    console.log(`Dispenser: ${dispenser.dispenserNumber}`);
  }

  // === 8. Seed Pumps ===
  const pumpData = [
    {
      pumpNumber: 'PUMP-001A',
      productCatalogId: createdCatalogs.find(c => c.name === 'Diesel' && c.omcId === createdOmcs[0].id)?.id,
      dispenserId: createdDispensers[0].id,
    },
    {
      pumpNumber: 'PUMP-002A',
      productCatalogId: createdCatalogs.find(c => c.name === 'Diesel' && c.omcId === createdOmcs[1].id)?.id,
      dispenserId: createdDispensers[1].id,
    },
  ].filter(p => p.productCatalogId);

  const createdPumps = [];
  for (const data of pumpData) {
    const pump = await prisma.pump.upsert({
      where: { pumpNumber: data.pumpNumber },
      update: {},
      create: data,
    });
    createdPumps.push(pump);
    console.log(`Pump: ${pump.pumpNumber}`);
  }

  // === 9. Assign Pump Attendant to Pump ===
  const attendant = createdUsers.find(u => u.email === 'pump_attendant@example.com');
  const pumpToAssign = createdPumps[0];
  if (attendant && pumpToAssign) {
    await prisma.pump.update({
      where: { id: pumpToAssign.id },
      data: {
        attendants: {
          connect: { id: attendant.id },
        },
      },
    });
    console.log(`Assigned ${attendant.email} to ${pumpToAssign.pumpNumber}`);
  }

  // === 10. Seed Transaction (Correct: Use driverId, not driver) ===
  const driverUser = createdUsers.find(u => u.email === 'driver@example.com');
  const dieselCatalog = createdCatalogs.find(c => c.name === 'Diesel' && c.omcId === createdOmcs[0].id);
  const station = createdStations[0];
  const dispenser = createdDispensers[0];
  const pump = createdPumps[0];

  if (!dieselCatalog || !driverUser || !attendant || !station || !dispenser || !pump) {
    throw new Error('Missing required seed data for transaction');
  }

  const stationPrice = await prisma.stationProductPrice.findUnique({
    where: { catalogId_stationId: { catalogId: dieselCatalog.id, stationId: station.id } },
  });
  const pricePerLiter = stationPrice?.price ?? dieselCatalog.defaultPrice;
  const liters = 50.0;
  const amount = liters * pricePerLiter;

  await prisma.transaction.upsert({
    where: { token: 'TXN-001' },
    update: {},
    create: {
      token: 'TXN-001',
      liters,
      amount,
      productCatalog: { connect: { id: dieselCatalog.id } },
      pumpAttendant: { connect: { id: attendant.id } },
      station: { connect: { id: station.id } },
      dispenser: { connect: { id: dispenser.id } },
      pump: { connect: { id: pump.id } },
      driver: { connect: { id: driverUser.id } }
    },
  });

  console.log(`Transaction: TXN-001 | ${liters}L × ${pricePerLiter} = ${amount} GHS`);
  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });