import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper, AmqpConnectionManager } from 'amqp-connection-manager';
import { ConfigService } from '@nestjs/config';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';

@Injectable()
export class MarketingSyncProducer implements OnModuleInit {
  private connection: AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  constructor(
    private readonly logger: WinstonLogger,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext('MarketingSyncProducer');
  }

  async onModuleInit() {
    const queue_name = this.configService.get<string>(
      'RABBITMQ_QUEUE',
      'auto_trader_sync_queue',
    );
    const rabbitmqUrl = this.configService.get<string>(
      'RABBITMQ_URI',
      'amqp://guest:guest@localhost:5672',
    );

    this.connection = amqp.connect([rabbitmqUrl]);

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: (channel: amqp.Channel) => {
        return channel.assertQueue(queue_name, { durable: true });
      },
    });
  }

  public async triggerSync(
    dealershipId: string,
    message: string = 'Manual API Trigger',
  ): Promise<boolean> {
    const payload = {
      dealershipId,
      message,
      timestamp: new Date().toISOString(),
    };

    try {
      const result = this.channelWrapper.sendToQueue(
        this.configService.get<string>(
          'RABBITMQ_QUEUE',
          'auto_trader_sync_queue',
        ),
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
      );
      this.logger.log(
        `Successfully published sync job for dealership: ${dealershipId}. Status: queued`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to publish sync job for ${dealershipId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
