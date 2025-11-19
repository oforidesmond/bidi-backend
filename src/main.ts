import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  app.enableCors({
        origin: [
       'http://localhost:5173', 
        'https://bidi-omc.vercel.app', 
        'http://localhost:3000',
        'http://192.168.247.72:3000'
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });

  // app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  await app.listen(port);
  console.log(`Application is running on port ${port}`);
}

bootstrap();
