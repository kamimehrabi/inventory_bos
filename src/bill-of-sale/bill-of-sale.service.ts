import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { BillOfSale, BosStatus } from './bill-of-sale.model';
import { Vehicle } from 'src/vehicle/vehicle.model';
import { CreateBillOfSaleDto } from './dto/create-bill-of-sale.dto';
import { UpdateBillOfSaleDto } from './dto/update-bill-of-sale.dto'; // <-- NEW IMPORT
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize'; // <-- FIX: Imported Op directly from sequelize

@Injectable()
export class BillOfSaleService {
  constructor(
    @InjectModel(BillOfSale)
    private readonly bosModel: typeof BillOfSale,
    @InjectModel(Vehicle)
    private readonly vehicleModel: typeof Vehicle,
    private readonly logger: WinstonLogger,
    private readonly sequelize: Sequelize,
  ) {
    this.logger.setContext(BillOfSaleService.name);
  }

  // --- Helper for Authorization and Retrieval ---
  private async findBosById(
    id: number,
    dealershipId: string,
  ): Promise<BillOfSale> {
    const bos = await this.bosModel.findOne({
      where: { id, dealershipId },
    });

    if (!bos) {
      throw new NotFoundException(`Bill of Sale with ID ${id} not found.`);
    }
    return bos;
  }

  private async isVehicleAlreadySold(
    vehicleId: number,
    excludeBosId?: number,
  ): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereCondition: any = { vehicleId, bosStatus: BosStatus.SOLD };

    if (excludeBosId) {
      whereCondition.id = { [Op.ne]: excludeBosId };
    }

    const soldBOS = await this.bosModel.findOne({
      where: whereCondition,
    });

    return !!soldBOS;
  }

  async create(
    dealershipId: string,
    dto: CreateBillOfSaleDto,
  ): Promise<BillOfSale> {
    const {
      vehicleId,
      finalPrice,
      buyerName,
      buyerAddress,
      bosStatus = BosStatus.SOLD,
    } = dto;

    this.logger.log(
      `Dealership ${dealershipId}: Attempting to create BOS for Vehicle ${vehicleId}`,
    );

    const vehicle = await this.vehicleModel.findOne({
      where: { id: vehicleId, dealershipId },
    });

    if (!vehicle) {
      throw new NotFoundException(
        `Vehicle with ID ${vehicleId} not found in inventory.`,
      );
    }

    if (bosStatus === BosStatus.SOLD) {
      if (await this.isVehicleAlreadySold(vehicleId)) {
        throw new ConflictException(
          `Vehicle ${vehicleId} is already SOLD. Cannot create a new SOLD Bill of Sale.`,
        );
      }
    }

    const bos = await this.bosModel.create({
      dealershipId,
      vehicleId,
      finalPrice,
      buyerName,
      buyerAddress,
      bosStatus,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    this.logger.log(
      `Successfully created BOS ${bos.id} for Vehicle ${vehicleId} with status ${bos.bosStatus}.`,
    );

    return bos;
  }

  async update(
    id: number,
    dealershipId: string,
    dto: UpdateBillOfSaleDto,
  ): Promise<BillOfSale> {
    this.logger.log(
      `Dealership ${dealershipId}: Attempting to update BOS with ID ${id}`,
    );

    const bos = await this.findBosById(id, dealershipId);

    const updateData: Partial<BillOfSale> = {};

    if (dto.finalPrice !== undefined) {
      updateData.finalPrice = dto.finalPrice;
    }

    if (dto.bosStatus !== undefined && dto.bosStatus !== bos.bosStatus) {
      if (dto.bosStatus === BosStatus.SOLD) {
        if (
          await this.isVehicleAlreadySold(
            bos.dataValues.vehicleId,
            bos.dataValues.id,
          )
        ) {
          throw new ConflictException(
            `Vehicle ${bos.vehicleId} is already SOLD via another Bill of Sale. Cannot set this BOS to SOLD.`,
          );
        }
      }
      updateData.bosStatus = dto.bosStatus;
    }

    // 3. Perform update only if there are changes
    if (Object.keys(updateData).length === 0) {
      this.logger.warn(`BOS ${id}: No changes detected in the update payload.`);
      return bos;
    }

    // 4. Apply the update
    const updatedBos = await bos.update(updateData);

    this.logger.log(
      `BOS ${id} updated successfully. Status: ${updatedBos.bosStatus}, Price: ${updatedBos.finalPrice}`,
    );

    return updatedBos;
  }

  // 22. Implement GET /bills-of-sale/:id (View BOS Details)
  async findOne(id: number, dealershipId: string): Promise<BillOfSale> {
    this.logger.log(`Dealership ${dealershipId}: Fetching BOS with ID ${id}`);
    return this.findBosById(id, dealershipId);
  }
}
