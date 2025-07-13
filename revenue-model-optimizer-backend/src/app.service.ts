import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHello(): string {
    return "Revenue Model Optimizer API - Ready for testing with merchant credentials!";
  }
}
