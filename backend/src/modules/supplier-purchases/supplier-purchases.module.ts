import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SupplierPurchasesController } from "./supplier-purchases.controller";
import { SupplierPurchasesService } from "./supplier-purchases.service";

@Module({
  imports: [AuthModule],
  controllers: [SupplierPurchasesController],
  providers: [SupplierPurchasesService],
  exports: [SupplierPurchasesService],
})
export class SupplierPurchasesModule {}
