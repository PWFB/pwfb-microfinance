import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VirtualAccountsModule } from '../virtual-accounts/virtual-accounts.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [PrismaModule, VirtualAccountsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
