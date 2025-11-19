import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles-guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get('filtered')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('ADMIN')
  async getFiltered(
    @Query('omcId') omcIdRaw: string | undefined,
    @Query('stationId') stationIdRaw: string | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const omcId = omcIdRaw === undefined || omcIdRaw === '' ? null : Number(omcIdRaw);
    const stationId = stationIdRaw === undefined || stationIdRaw === '' ? null : Number(stationIdRaw);
    return this.transactionService.getFilteredTransactions({ omcId, stationId, page, limit });
  }

  @Get('filters/omcs')
  async getOmcFilters(
    @Query('omcId') omcIdRaw: string | undefined,
  ) {
    const omcId = omcIdRaw === undefined || omcIdRaw === '' ? undefined : Number(omcIdRaw);
    return this.transactionService.getOmcFilters(omcId);
  }

  @Get('tokens/search')
  @UseGuards(JwtAuthGuard)
  async searchTokens(@Query('q') q: string) {
    return this.transactionService.searchTokens(q);
  }

  // GET /transactions/:token
  @Get(':token')
  @UseGuards(JwtAuthGuard)
  async getTokenDetails(@Param('token') token: string) {
    return this.transactionService.getTokenDetails(token);
  }

  // PATCH /transactions/:token
  @Patch('token/:token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PUMP_ATTENDANT')
  async useToken(
    @Param('token') token: string,
    @Request() req,
    @Body()
    body: {
      productCatalogId?: number;
      liters?: number;
      amount?: number;
      stationId?: number;
      dispenserId?: number;
      pumpId?: number;
    },
  ) {
    const attendantId = req.user.id; // From JWT
    return this.transactionService.useToken(token, attendantId, body);
  }

  // GET /transactions?sales&pumpAttendantId={id}
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PUMP_ATTENDANT')
  async getSalesHistory(
    @Query('pumpAttendantId') pumpAttendantId: string,
    @Request() req,
  ) {
    const id = parseInt(pumpAttendantId, 10);
    if (isNaN(id)) throw new BadRequestException('Invalid pumpAttendantId');

    // Optional: Enforce that attendant can only view their own sales
    if (req.user.id !== id && !req.user.roles.includes('ADMIN')) {
      throw new ForbiddenException('You can only view your own sales');
    }

    return this.transactionService.getSalesHistory(id);
  }

  @Get(':token/calculate-liters')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PUMP_ATTENDANT')
async calculateLiters(
  @Param('token') token: string,
  @Query('product') productName: string,
  @Request() req,
) {
  if (!productName) {
    throw new BadRequestException('Query param "product" is required');
  }

  const attendantId = req.user.id;
  return this.transactionService.calculateLitersByToken(
    token,
    productName,
    attendantId,
    )
  }

   @Get(':id')
   @UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
  async getTransactionDetails(@Param('id', ParseIntPipe) id: number) {
    return this.transactionService.getTransactionDetails(id);
  }
}