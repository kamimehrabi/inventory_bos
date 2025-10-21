import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonLogger } from './common/logger/winston-logger/winston-logger.service';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new WinstonLogger(),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  await app.listen(port);
}
bootstrap();
