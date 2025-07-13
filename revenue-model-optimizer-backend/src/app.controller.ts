import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("health")
  getHealth() {
    return {
      status: "ok",
      message: "Revenue Model Optimizer API is running",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      endpoints: {
        products: "/api/v1/products/fetch",
        orders: "/api/v1/orders/fetch",
        customers: "/api/v1/customers/fetch",
      },
    };
  }
}
