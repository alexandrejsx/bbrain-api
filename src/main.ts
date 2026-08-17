import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
    const config = app.get(ConfigService);
    app.enableCors({
      origin: config.get<string[]>('cors.origins') || ['http://localhost:3000']
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
      })
    );

    const port = config.get<number>('port') || 9090;

    await app.listen(port);

    console.log(`App running on http://localhost:${port}`);
  } catch (error) {
    console.error(
      `Application startup failed errorType=${error instanceof Error ? error.name : 'unknown'}`
    );
    process.exit(1);
  }
}

void bootstrap();
