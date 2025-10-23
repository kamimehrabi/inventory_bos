import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Vehicle } from '../vehicle/vehicle.model';
import { Dealership } from '../dealership/dealership.model';
import * as fs from 'fs';
import * as path from 'path';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';

interface SyncJobPayload {
  dealershipId: string;
  message: string;
}

@Injectable()
export class MarketingSyncProcessor {
  constructor(
    @InjectModel(Dealership)
    private readonly dealershipModel: typeof Dealership,
    @InjectModel(Vehicle)
    private readonly vehicleModel: typeof Vehicle,
    private readonly logger: WinstonLogger,
  ) {
    this.logger.setContext('MarketingSyncProcessor');
  }

  public async processSyncJob(payload: SyncJobPayload): Promise<void> {
    const { dealershipId, message } = payload;
    this.logger.log(`Starting sync for Dealership ID: ${dealershipId}`);

    try {
      const dealershipWithVehicles = await this.dealershipModel.findByPk(
        payload.dealershipId,
        {
          include: [
            {
              model: this.vehicleModel,
              as: 'vehicles',
              where: { deletedAt: null },
              required: false,
            },
          ],
        },
      );

      if (!dealershipWithVehicles) {
        this.logger.warn(
          `Dealership ID ${dealershipId} not found. Aborting sync.`,
        );
        throw new NotFoundException('Dealership not found. Aborting sync.');
      }

      const vehicleList = dealershipWithVehicles.dataValues.vehicles
        ? dealershipWithVehicles.dataValues.vehicles.map((v) => ({
            id: v.id,
            year: v.year,
            make: v.make,
            model: v.model,
          }))
        : [];

      const syncData = {
        syncTriggerMessage: message,
        dealershipId: dealershipId,
        dealershipName: dealershipWithVehicles.dataValues.name,
        totalVehicles: vehicleList.length,
        vehicles: vehicleList,
        syncTimestamp: new Date().toISOString(),
      };

      const fileName = `${dealershipId}_marketing_sync_${Date.now()}.json`;
      const exportDir = path.join(process.cwd(), 'sync_exports');
      const filePath = path.join(exportDir, fileName);

      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      await fs.promises.writeFile(
        filePath,
        JSON.stringify(syncData, null, 2),
        'utf-8',
      );

      this.logger.log(`Sync complete. Data saved to file: ${filePath}`);
    } catch (error) {
      this.logger.error(
        `Database/File error during sync for ${dealershipId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
