import { Column, Model, Table, DataType, HasMany } from 'sequelize-typescript';
import { User } from '../user/user.model';
import { Vehicle } from '../vehicle/vehicle.model';
import { BillOfSale } from '../bill-of-sale/bill-of-sale.model';

export interface DealershipFields {
  name: string;
  address: string;
}

@Table({
  tableName: 'dealerships',
  timestamps: true,
})
export class Dealership extends Model<Dealership> implements DealershipFields {
  @Column({
    type: DataType.STRING,
    unique: true,
    allowNull: false,
    primaryKey: true,
  })
  declare id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.STRING,
  })
  address: string;

  @HasMany(() => User)
  users: User[];

  @HasMany(() => Vehicle)
  vehicles: Vehicle[];

  @HasMany(() => BillOfSale)
  billsOfSale: BillOfSale[];
}
