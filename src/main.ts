import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonLogger } from './common/logger/winston-logger/winston-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new WinstonLogger(),
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
