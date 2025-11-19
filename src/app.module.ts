import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { use } from 'passport';
import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';
import { TransactionModule } from './transaction/transaction.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UserModule,
    TransactionModule,
  ],
  controllers: [AppController, UserController],
  providers: [AppService, PrismaService, UserService],
  exports: [PrismaService],
})
export class AppModule {}
