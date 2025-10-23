import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper, AmqpConnectionManager } from 'amqp-connection-manager';
import { ConfigService } from '@nestjs/config';
import { MarketingSyncProcessor } from '../marketing-sync-processor.service';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';

@Injectable()
export class MarketingSyncConsumer implements OnModuleInit, OnModuleDestroy {
  private connection: AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  constructor(
    private readonly processor: MarketingSyncProcessor,
    private readonly logger: WinstonLogger,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext('MarketingSyncConsumer');
  }

  async onModuleInit() {
    const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URI');

    const rabbitmqQueue = this.configService.get<string>(
      'RABBITMQ_QUEUE',
      'auto_trader_sync_queue',
    );

    this.connection = amqp.connect([rabbitmqUrl!]);

    this.connection.on('connect', () =>
      this.logger.log('Connected to RabbitMQ!'),
    );
    this.connection.on('disconnect', (err) =>
      this.logger.error(
        `Disconnected from RabbitMQ: ${err.err.message}`,
        err.err.stack,
      ),
    );

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: (channel: amqp.Channel) => {
        return channel.assertQueue(rabbitmqQueue!, { durable: true });
      },
    });

    this.channelWrapper.consume(rabbitmqQueue!, async (msg) => {
      if (msg) {
        let jobData;
        try {
          let rawContentString = msg.content.toString();

          if (rawContentString.startsWith('{"type":"Buffer"')) {
            const bufferObject = JSON.parse(rawContentString);

            const payloadBuffer = Buffer.from(bufferObject.data);
            rawContentString = payloadBuffer.toString();
          }

          jobData = JSON.parse(rawContentString);

          this.logger.log(
            `Job received for dealership: ${jobData.dealershipId}`,
          );

          await this.processor.processSyncJob(jobData);

          this.channelWrapper.ack(msg);
          this.logger.log(
            `Job for ${jobData.dealershipId} successfully processed and acknowledged. Status: completed`,
          );
        } catch (error) {
          this.logger.error(
            `Processor execution error for job ${jobData?.dealershipId}: ${error.message}`,
            error.stack,
          );

          this.channelWrapper.ack(msg);

          this.logger.warn(
            `Job cleared from queue. Inspect logs for the full error trace!`,
          );
        }
      }
    });
  }

  async onModuleDestroy() {
    await this.connection?.close();
  }
}
