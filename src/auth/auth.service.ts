import { Injectable, UnauthorizedException } from '@nestjs/common';
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

  async registerOmc(
    name: string,
    location: string,
    logo: string | undefined,
    contactPerson: string,
    contact: string,
    email: string | undefined,
    products: { name: string; price: number }[],
  ) {
    // Validate logo extension if provided
    if (logo) {
      const validExtensions = ['.jpg', '.jpeg', '.png'];
      const extension = logo.slice(logo.lastIndexOf('.')).toLowerCase();
      if (!validExtensions.includes(extension)) {
        throw new UnauthorizedException('Logo must be a JPG, JPEG, or PNG file');
      }
    }

    // Validate products
    if (!products || products.length === 0) {
      throw new UnauthorizedException('At least one product must be provided');
    }
    for (const product of products) {
      if (!product.name || typeof product.price !== 'number' || product.price <= 0) {
        throw new UnauthorizedException('Each product must have a valid name and price');
      }
    }

    // Create OMC
    const omc = await this.prisma.omc.create({
      data: {
        name,
        location,
        logo,
        contactPerson,
        contact,
        email,
        products, // Stored as JSON in Prisma
      },
    });

    // Generate JWT for the created OMC (optional, depending on your use case)
    const payload = { sub: omc.id, name: omc.name, role: 'OMC_ADMIN' };
    return {
      access_token: this.jwtService.sign(payload),
      omc,
    };
  }
}