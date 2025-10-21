import {
  Column,
  Model,
  Table,
  ForeignKey,
  BelongsTo,
  DataType,
} from 'sequelize-typescript';
import { Dealership } from '../dealership/dealership.model';

export enum UserRole {
  ADMIN = 'admin',
  DEALER = 'dealer',
}

export interface UserFields {
  id: number;
  email: string;
  passwordHash: string;
  role: UserRole;

  dealershipId: string;
}

@Table({
  tableName: 'users',
  timestamps: true,
})
export class User extends Model<User> implements UserFields {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare email: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare passwordHash: string;

  @Column({
    type: DataType.ENUM(...Object.values(UserRole)),
    allowNull: false,
    defaultValue: UserRole.DEALER,
  })
  declare role: UserRole;

  @ForeignKey(() => Dealership)
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare dealershipId: string;

  @BelongsTo(() => Dealership)
  declare dealership: Dealership;
}
