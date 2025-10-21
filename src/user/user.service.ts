import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './user.model';
import * as bcrypt from 'bcrypt';
// import { Dealership } from 'src/dealership/dealership.model';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private logger: WinstonLogger,
  ) {
    this.logger.setContext(UserService.name);
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({
      where: { email },
      // include: [Dealership], // Include dealership data if needed
    });
  }

  async validateUser(
    email: string,
    pass: string,
  ): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.userModel.findOne({ where: { email } });

    if (!user) {
      this.logger.warn(
        `Validation attempt failed: User with email ${email} not found.`,
      );
      return null;
    }
    const isMatch = await bcrypt.compare(pass, user.passwordHash);

    if (!isMatch) {
      this.logger.warn(
        `Validation attempt failed: Password mismatch for user ${email}.`,
      );
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user.get({ plain: true });

    this.logger.log(`User ${email} successfully validated.`);
    return result as Omit<User, 'passwordHash'>;
  }
}
