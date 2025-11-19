import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { AuthService } from 'src/auth/auth.service';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { RolesGuard } from 'src/common/guards/roles-guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';

@Module({
  controllers: [TransactionController],
  providers: [TransactionService, UserService, AuthService, JwtStrategy, PrismaService, RolesGuard, JwtAuthGuard, JwtService],

   exports: [AuthService, JwtStrategy],
})
export class TransactionModule {}
