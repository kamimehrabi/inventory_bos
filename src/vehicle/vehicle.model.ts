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
  id: number;
  year: number;
  make: string;
  model: string;
  price: number;
  status: VehicleStatus;
  imageUrl: string | null;

  dealershipId: string;
}

@Table({
  tableName: 'vehicles',
  timestamps: true,
  paranoid: true,
})
export class Vehicle extends Model<Vehicle> implements VehicleFields {
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
  declare dealershipId: string;

  @BelongsTo(() => Dealership)
  dealership: Dealership;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare vin: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare year: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare make: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare model: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare price: number;

  @Column({
    type: DataType.ENUM(...Object.values(VehicleStatus)),
    allowNull: false,
    defaultValue: VehicleStatus.AVAILABLE,
  })
  declare status: VehicleStatus;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare imageUrl: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare deletedAt: Date | null;

  @HasOne(() => BillOfSale)
  declare billOfSale: BillOfSale;
}
