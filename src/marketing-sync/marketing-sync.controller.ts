import {
  Controller,
  Post,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/user.model';
import { MarketingSyncProducer } from './marketing-sync-producer/marketing-sync-producer.service';
import { DealershipContext } from 'src/auth/decorators/dealership-context.decorator';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('marketing')
export class MarketingSyncController {
  constructor(private readonly producer: MarketingSyncProducer) {}

  @Post('sync')
  async triggerSync(@DealershipContext() dealershipId: string) {
    const success = await this.producer.triggerSync(
      dealershipId,
      'Manual API Trigger by Admin',
    );

    if (success) {
      return {
        message: `Sync job for dealership ${dealershipId} successfully queued.`,
        status: 'queued',
      };
    } else {
      throw new HttpException(
        'Failed to queue sync job. RabbitMQ connection might be down or misconfigured.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
