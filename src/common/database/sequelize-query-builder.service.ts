import { Injectable, BadRequestException } from '@nestjs/common';
import { FindAndCountOptions, Order, WhereOptions, Op } from 'sequelize';
import { GetVehiclesDto } from 'src/vehicle/dto/get-vehicles.dto';

export interface QueryConfig<T> {
  searchFields: (keyof T)[];
  sortableFields: (keyof T)[];
  filterableFields?: {
    dtoKey: keyof GetVehiclesDto;
    modelKey: keyof T;
    operator?: symbol | string;
  }[];
}

@Injectable()
export class SequelizeQueryBuilderService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public buildQueryOptions<T extends Record<string, any>>(
    query: GetVehiclesDto,
    config: QueryConfig<T>,
    initialWhere: WhereOptions<T> = {},
  ): FindAndCountOptions<T> {
    const { page = 1, limit = 10, sort, filter, includeDeleted } = query;
    const where: WhereOptions<T> = { ...initialWhere };

    // 1. Pagination
    const offset = (page - 1) * limit;

    // 2. Sorting
    let order: Order = [['createdAt', 'DESC']]; // Default sort
    if (sort) {
      const [field, direction] = sort.split(':');
      const sortField = field as keyof T;

      if (!config.sortableFields.includes(sortField)) {
        throw new BadRequestException(
          `Sorting by field '${field}' is not allowed.`,
        );
      }
      if (direction && ['ASC', 'DESC'].includes(direction.toUpperCase())) {
        order = [
          [sortField as string, direction.toUpperCase() as 'ASC' | 'DESC'],
        ];
      } else {
        throw new BadRequestException(
          'Invalid sort parameter format. Use "field:direction".',
        );
      }
    }

    // 3. Search & Filter
    if (filter && config.searchFields.length > 0) {
      const searchConditions = config.searchFields.map((field) => ({
        [field]: { [Op.iLike]: `%${filter}%` },
      }));

      where[Op.and] = [...(where[Op.and] || []), { [Op.or]: searchConditions }];
    }

    const paranoid = !includeDeleted;

    return {
      where,
      limit,
      offset,
      order,
      paranoid,
    };
  }
}
