import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SellerCatalogController } from "./seller-catalog.controller";
import { SellerCatalogService } from "./seller-catalog.service";
import { R2StorageService } from "./r2-storage.service";

@Module({
  imports: [AuthModule],
  controllers: [SellerCatalogController],
  providers: [SellerCatalogService, R2StorageService],
})
export class SellerCatalogModule {}