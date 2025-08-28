const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Seed Roles
  const roles = [
    { name: 'OMC_ADMIN' },
    { name: 'STATION_MANAGER' },
    { name: 'PUMP_ATTENDANT' },
    { name: 'DRIVER' },
  ];

  const createdRoles = [];
  for (const role of roles) {
    const existingRole = await prisma.role.findUnique({
      where: { name: role.name },
    });
    if (!existingRole) {
      const newRole = await prisma.role.create({
        data: role,
      });
      createdRoles.push(newRole);
      console.log(`Created role: ${newRole.name}`);
    } else {
      createdRoles.push(existingRole);
      console.log(`Role already exists: ${existingRole.name}`);
    }
  }

  // Seed OMCs
  const omcs = [
    { name: 'Oil Marketing Co 1' },
    { name: 'Oil Marketing Co 2' },
  ];

  const createdOmcs = [];
  for (const omc of omcs) {
    const existingOmc = await prisma.omc.findFirst({
      where: { name: omc.name },
    });
    if (!existingOmc) {
      const newOmc = await prisma.omc.create({
        data: omc,
      });
      createdOmcs.push(newOmc);
      console.log(`Created OMC: ${newOmc.name}`);
    } else {
      createdOmcs.push(existingOmc);
      console.log(`OMC already exists: ${existingOmc.name}`);
    }
  }

// Seed Stations
const stations = [
  {
    name: 'Station A',
    pumpNo: 'PUMP001', // was 'code'
    region: 'Greater Accra', // replaced 'location'
    district: 'Accra Metropolitan',
    town: 'Accra',
    managerName: 'John Doe',
    managerContact: '1234567890',
    omcId: createdOmcs[0].id,
  },
  {
    name: 'Station B',
    pumpNo: 'PUMP002',
    region: 'Ashanti',
    district: 'Kumasi Metropolitan',
    town: 'Kumasi',
    managerName: 'Jane Smith',
    managerContact: '0987654321',
    omcId: createdOmcs[1].id,
  },
];

const createdStations = [];
for (const station of stations) {
  const existingStation = await prisma.station.findUnique({
    where: { pumpNo: station.pumpNo }, // use pumpNo since it's unique
  });
  if (!existingStation) {
    const newStation = await prisma.station.create({
      data: station,
    });
    createdStations.push(newStation);
    console.log(`Created station: ${newStation.name}`);
  } else {
    createdStations.push(existingStation);
    console.log(`Station already exists: ${existingStation.name}`);
  }
}

  // Seed Users
  const users = [
    {
      email: 'admin@example.com',
      password: await bcrypt.hash('password123', 10),
      roleId: createdRoles.find((r) => r.name === 'OMC_ADMIN').id,
      omcId: createdOmcs[0].id,
    },
    {
      email: 'station_manager@example.com',
      password: await bcrypt.hash('password123', 10),
      roleId: createdRoles.find((r) => r.name === 'STATION_MANAGER').id,
      stationId: createdStations[0].id,
    },
    {
      email: 'pump_attendant@example.com',
      password: await bcrypt.hash('password123', 10),
      roleId: createdRoles.find((r) => r.name === 'PUMP_ATTENDANT').id,
      stationId: createdStations[0].id,
    },
    {
      email: 'driver@example.com',
      password: await bcrypt.hash('password123', 10),
      roleId: createdRoles.find((r) => r.name === 'DRIVER').id,
    },
  ];

  const createdUsers = [];
  for (const user of users) {
    const existingUser = await prisma.user.findUnique({
      where: { email: user.email },
    });
    if (!existingUser) {
      const newUser = await prisma.user.create({
        data: user,
      });
      createdUsers.push(newUser);
      console.log(`Created user: ${newUser.email}`);
    } else {
      createdUsers.push(existingUser);
      console.log(`User already exists: ${existingUser.email}`);
    }
  }

  // Seed Drivers
  const drivers = [
    {
      ghanaCard: 'GHA-123456789',
      mobileNumber: '1234567890',
      vehicleCount: 2,
      region: 'Greater Accra',
      district: 'Accra Central',
      companyName: 'Freight Co',
    },
  ];

  const createdDrivers = [];
  for (const driver of drivers) {
    const existingDriver = await prisma.driver.findUnique({
      where: { ghanaCard: driver.ghanaCard },
    });
    if (!existingDriver) {
      const newDriver = await prisma.driver.create({
        data: driver,
      });
      createdDrivers.push(newDriver);
      console.log(`Created driver: ${newDriver.ghanaCard}`);
    } else {
      createdDrivers.push(existingDriver);
      console.log(`Driver already exists: ${existingDriver.ghanaCard}`);
    }
  }

  // Seed Products
  const products = [
    {
      type: 'Gasoline',
      liters: 1000.0,
      amount: 15000.0,
      stationId: createdStations[0].id,
    },
    {
      type: 'Diesel',
      liters: 800.0,
      amount: 12000.0,
      stationId: createdStations[0].id,
    },
  ];

  const createdProducts = [];
  for (const product of products) {
    const existingProduct = await prisma.product.findFirst({
      where: {
        type: product.type,
        stationId: product.stationId,
      },
    });
    if (!existingProduct) {
      const newProduct = await prisma.product.create({
        data: product,
      });
      createdProducts.push(newProduct);
      console.log(`Created product: ${newProduct.type}`);
    } else {
      createdProducts.push(existingProduct);
      console.log(`Product already exists: ${existingProduct.type}`);
    }
  }

  // Seed Transactions
  const transactions = [
    {
      mobileNumber: '1234567890',
      productId: createdProducts[0].id,
      liters: 50.0,
      amount: 750.0,
      pumpAttendantId: createdUsers.find((u) => u.email === 'pump_attendant@example.com').id,
      stationId: createdStations[0].id,
      driverId: createdDrivers[0].id,
      token: 'TXN-001',
    },
  ];

  for (const transaction of transactions) {
    const existingTransaction = await prisma.transaction.findUnique({
      where: { token: transaction.token },
    });
    if (!existingTransaction) {
      const newTransaction = await prisma.transaction.create({
        data: transaction,
      });
      console.log(`Created transaction: ${newTransaction.token}`);
    } else {
      console.log(`Transaction already exists: ${existingTransaction.token}`);
    }
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });