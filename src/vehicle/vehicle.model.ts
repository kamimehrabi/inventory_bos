import {
  Column,
  Model,
  Table,
  ForeignKey,
  BelongsTo,
  HasOne,
  DataType,
} from 'sequelize-typescript';
import { Dealership } from '../dealership/dealership.model';
import { BillOfSale } from '../bill-of-sale/bill-of-sale.model';

export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  SOLD = 'SOLD',
  PENDING = 'PENDING',
}

export interface VehicleFields {
  dealershipId: string;
  year: number;
  make: string;
  model: string;
  price: number;
  status: VehicleStatus;
}

@Table({
  tableName: 'vehicles',
  timestamps: true,
})
export class Vehicle extends Model<Vehicle> {
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

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  vin: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  year: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  make: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  model: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  price: number;

  @Column({
    type: DataType.ENUM(...Object.values(VehicleStatus)),
    allowNull: false,
    defaultValue: VehicleStatus.AVAILABLE,
  })
  status: VehicleStatus;

  @HasOne(() => BillOfSale)
  billOfSale: BillOfSale;
}
