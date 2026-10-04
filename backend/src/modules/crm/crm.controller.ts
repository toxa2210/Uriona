import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { FinanceEntryType, OrderStatus } from "@prisma/client";
import { AuthService } from "../auth/auth.service";
import { CrmService } from "./crm.service";

class UpdateShippingDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  carrier!: string;

  @IsString() @IsNotEmpty() @MaxLength(128)
  trackingNumber!: string;
}

class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

class CreateTrackingEventDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  status!: string;

  @IsString() @IsNotEmpty() @MaxLength(1000)
  description!: string;

  @IsOptional() @IsString() @MaxLength(160)
  location?: string;

  @IsOptional() @IsDateString()
  occurredAt?: string;
}

class CreateExpenseDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  category!: string;

  @IsString() @IsNotEmpty() @MaxLength(500)
  description!: string;

  @IsInt() @Min(1) @Max(2_147_483_647)
  amountMinor!: number;

  @IsOptional() @IsDateString()
  occurredAt?: string;
}

class CreateIncomeDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  category!: string;

  @IsString() @IsNotEmpty() @MaxLength(500)
  description!: string;

  @IsInt() @Min(1) @Max(2_147_483_647)
  amountMinor!: number;

  @IsOptional() @IsDateString()
  occurredAt?: string;
}

@Controller("crm")
export class CrmController {
  constructor(private readonly crm: CrmService, private readonly auth: AuthService) {}

  @Get("overview")
  async overview(@Headers("authorization") authorization?: string) {
    await this.requireAdmin(authorization);
    return this.crm.overview();
  }

  @Get("customers")
  async customers(
    @Headers("authorization") authorization: string | undefined,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    await this.requireAdmin(authorization);
    return this.crm.customers(search, page, limit);
  }

  @Get("customers/:id")
  async customer(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string
  ) {
    await this.requireAdmin(authorization);
    return this.crm.customer(id);
  }

  @Get("orders")
  async orders(
    @Headers("authorization") authorization: string | undefined,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    await this.requireAdmin(authorization);
    return this.crm.orders(search, status, page, limit);
  }

  @Get("orders/:id")
  async order(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string
  ) {
    await this.requireAdmin(authorization);
    return this.crm.order(id);
  }

  @Patch("orders/:id/shipping")
  async updateShipping(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() body: UpdateShippingDto
  ) {
    const admin = await this.requireAdmin(authorization);
    return this.crm.updateShipping(id, { ...body, actorId: admin.id });
  }

  @Patch("orders/:id/status")
  async updateOrderStatus(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() body: UpdateOrderStatusDto
  ) {
    const admin = await this.requireAdmin(authorization);
    return this.crm.updateOrderStatus(id, body.status, admin.id, body.note);
  }

  @Post("orders/:id/tracking-events")
  async addTrackingEvent(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() body: CreateTrackingEventDto
  ) {
    const admin = await this.requireAdmin(authorization);
    return this.crm.addTrackingEvent(id, { ...body, actorId: admin.id });
  }

  @Get("finance/summary")
  async financeSummary(
    @Headers("authorization") authorization: string | undefined,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    await this.requireAdmin(authorization);
    return this.crm.financeSummary(from, to);
  }

  @Get("finance/entries")
  async financeEntries(
    @Headers("authorization") authorization: string | undefined,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    await this.requireAdmin(authorization);
    return this.crm.financeEntries(from, to, page, limit);
  }

  @Post("finance/expenses")
  async createExpense(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CreateExpenseDto
  ) {
    const admin = await this.requireAdmin(authorization);
    return this.crm.createManualFinanceEntry(FinanceEntryType.EXPENSE, { ...body, actorId: admin.id });
  }

  @Post("finance/income")
  async createIncome(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CreateIncomeDto
  ) {
    const admin = await this.requireAdmin(authorization);
    return this.crm.createManualFinanceEntry(FinanceEntryType.INCOME, { ...body, actorId: admin.id });
  }

  private async requireAdmin(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new UnauthorizedException("Authorization token is required");
    const user = await this.auth.validateSession(token);
    if (user.role !== "ADMIN") throw new ForbiddenException("CRM access is restricted to administrators");
    return user;
  }
}
