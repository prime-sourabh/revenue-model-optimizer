import { Module } from "@nestjs/common";
import { SimpleLtvCacController } from "./simple-ltv-cac.controller";

@Module({
  controllers: [SimpleLtvCacController],
  providers: [],
  exports: [],
})
export class AnalyticsModule {}
