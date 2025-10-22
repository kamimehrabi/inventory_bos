import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Patch,
} from '@nestjs/common'; // <-- PATCH IMPORTED
import { BillOfSaleService } from './bill-of-sale.service';
import { CreateBillOfSaleDto } from './dto/create-bill-of-sale.dto';
import { UpdateBillOfSaleDto } from './dto/update-bill-of-sale.dto'; // <-- NEW IMPORT
import { DealershipContext } from 'src/auth/decorators/dealership-context.decorator';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { BillOfSale } from './bill-of-sale.model';

@UseGuards(AuthGuard)
@Controller('bill-of-sale')
export class BillOfSaleController {
  constructor(private readonly bosService: BillOfSaleService) {}

  // 21. POST /bills-of-sale (Create BOS)
  @Post()
  create(
    @DealershipContext() dealershipId: string,
    @Body() createBosDto: CreateBillOfSaleDto,
  ): Promise<BillOfSale> {
    return this.bosService.create(dealershipId, createBosDto);
  }

  // NEW: PATCH /bills-of-sale/:id (Update BOS Status/Price)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @DealershipContext() dealershipId: string,
    @Body() updateBosDto: UpdateBillOfSaleDto,
  ): Promise<BillOfSale> {
    return this.bosService.update(id, dealershipId, updateBosDto);
  }

  // 22. GET /bills-of-sale/:id (View BOS Details)
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @DealershipContext() dealershipId: string,
  ): Promise<BillOfSale> {
    return this.bosService.findOne(id, dealershipId);
  }
}
