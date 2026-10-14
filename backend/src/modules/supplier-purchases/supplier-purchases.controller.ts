import { Body, Controller, Headers, Param, Post, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import {
  IsInt, IsNotEmpty, IsString, Matches, Max, MaxLength, Min,
} from "class-validator";
import { AuthService } from "../auth/auth.service";
import { SupplierPurchasesService } from "./supplier-purchases.service";

class CreatePurchaseDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  orderId!: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  idempotencyKey!: string;
}

class ReadyPurchaseDto {
  @IsInt() @Min(1) @Max(2_147_483_647)
  supplierAmountMinor!: number;

  @IsInt() @Min(0) @Max(2_147_483_647)
  supplierShippingMinor!: number;

  @IsString() @Matches(/^[A-Za-z]{3}$/)
  currency!: string;
}

class CreateSettlementDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  idempotencyKey!: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  beneficiaryName!: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  beneficiaryBank!: string;

  @IsString() @IsNotEmpty() @MaxLength(300)
  beneficiaryAccountRef!: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  contractReference!: string;

  @IsString() @Matches(/^[A-Za-z]{3}$/)
  currency!: string;

  @IsInt() @Min(1) @Max(2_147_483_647)
  amountMinor!: number;
}

class MarkPlacedDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  externalOrderId!: string;

  @IsString() @IsNotEmpty() @MaxLength(500)
  confirmationReference!: string;
}

class BankReferenceDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  bankReference!: string;
}

class SettlementProofDto {
  @IsString() @IsNotEmpty() @MaxLength(500)
  proofStorageKey!: string;
}

@Controller("admin/supplier-purchases")
export class SupplierPurchasesController {
  constructor(
    private readonly auth: AuthService,
    private readonly supplierPurchases: SupplierPurchasesService,
  ) {}

  private async admin(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token) throw new UnauthorizedException("Authentication required");
    const user = await this.auth.validateSession(token);
    if (user.role !== "ADMIN") throw new ForbiddenException("Administrator role required");
    return user;
  }

  @Post()
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CreatePurchaseDto,
  ) {
    await this.admin(authorization);
    return this.supplierPurchases.createForPaidOrder(body.orderId, body.idempotencyKey);
  }

  @Post(":id/ready")
  async ready(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() body: ReadyPurchaseDto,
  ) {
    await this.admin(authorization);
    return this.supplierPurchases.markReady(id, body);
  }

  @Post(":id/settlements")
  async createSettlement(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() body: CreateSettlementDto,
  ) {
    await this.admin(authorization);
    const { idempotencyKey, ...input } = body;
    return this.supplierPurchases.createSettlement(id, idempotencyKey, input);
  }

  @Post(":id/mark-placed")
  async markPlaced(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() body: MarkPlacedDto,
  ) {
    await this.admin(authorization);
    return this.supplierPurchases.markPlaced(id, body);
  }

  @Post("settlements/:settlementId/approve")
  async approveSettlement(
    @Headers("authorization") authorization: string | undefined,
    @Param("settlementId") settlementId: string,
  ) {
    const user = await this.admin(authorization);
    return this.supplierPurchases.approveSettlement(settlementId, user.id);
  }

  @Post("settlements/:settlementId/mark-sent")
  async markSettlementSent(
    @Headers("authorization") authorization: string | undefined,
    @Param("settlementId") settlementId: string,
    @Body() body: BankReferenceDto,
  ) {
    await this.admin(authorization);
    return this.supplierPurchases.markSettlementSent(settlementId, body.bankReference);
  }

  @Post("settlements/:settlementId/mark-settled")
  async markSettlementSettled(
    @Headers("authorization") authorization: string | undefined,
    @Param("settlementId") settlementId: string,
    @Body() body: SettlementProofDto,
  ) {
    await this.admin(authorization);
    return this.supplierPurchases.markSettlementSettled(settlementId, body.proofStorageKey);
  }
}
