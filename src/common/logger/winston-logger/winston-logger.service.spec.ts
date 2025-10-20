import { Test, TestingModule } from '@nestjs/testing';
import { WinstonLogger } from './winston-logger.service';

describe('WinstonLogger', () => {
  let service: WinstonLogger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WinstonLogger],
    }).compile();

    service = module.get<WinstonLogger>(WinstonLogger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
