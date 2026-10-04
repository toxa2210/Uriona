
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./database/prisma.module";
import { HealthController } from "./health.controller";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CartModule } from "./modules/cart/cart.module";
import { CheckoutModule } from "./modules/checkout/checkout.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { CrmModule } from "./modules/crm/crm.module";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { RequestIdMiddleware } from "./common/request-id.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env.local", ".env"] }),
    PrismaModule,
    AuthModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    CheckoutModule,
    IntegrationsModule,
    CrmModule
  ],
  controllers: [HealthController]
})
export class AppModule implements NestModule { configure(consumer: MiddlewareConsumer){ consumer.apply(RequestIdMiddleware).forRoutes("*"); } }
