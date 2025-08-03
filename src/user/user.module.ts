import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthService } from 'src/auth/auth.service';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { RolesGuard } from 'src/common/guards/roles-guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [UserController],
  providers: [UserService, AuthService, JwtStrategy, PrismaService, RolesGuard, JwtAuthGuard, JwtService],

  exports: [AuthService, JwtStrategy],
})

export class UserModule {}

  