import {
  Column,
  Model,
  Table,
  ForeignKey,
  BelongsTo,
  DataType,
} from 'sequelize-typescript';
import { Dealership } from '../dealership/dealership.model';
import { Vehicle } from '../vehicle/vehicle.model';

export interface BillOfSaleFields {
  dealershipId: string;
  vehicleId: number;
  saleDate: Date;
  finalPrice: number;
  buyerName: string;
  buyerAddress: string;
}

@Table({
  tableName: 'bills_of_sale',
  timestamps: true,
})
export class BillOfSale extends Model<BillOfSale> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @ForeignKey(() => Dealership)
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  dealershipId: string;

  @BelongsTo(() => Dealership)
  dealership: Dealership;

  // --- Vehicle Link ---

  @ForeignKey(() => Vehicle)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  vehicleId: number;

  @BelongsTo(() => Vehicle)
  vehicle: Vehicle;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  saleDate: Date;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  finalPrice: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  buyerName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  buyerAddress: string;
}
