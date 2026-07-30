import { Injectable } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomerService {
  private customers: CreateCustomerDto[] = [];

  create(createCustomerDto: CreateCustomerDto) {
    const customer = {
      id: Date.now().toString(),
      customerNumber:
        createCustomerDto.customerNumber ??
        `CUST-${Date.now().toString().slice(-6)}`,
      ...createCustomerDto,
      status: createCustomerDto.status ?? 'ACTIVE',
      createdAt: new Date(),
    };

    this.customers.push(customer as any);
    return customer;
  }

  findAll() {
    return this.customers;
  }

  findOne(id: string) {
    return this.customers.find((customer: any) => customer.id === id);
  }

  update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const index = this.customers.findIndex(
      (customer: any) => customer.id === id,
    );

    if (index === -1) {
      return null;
    }

    this.customers[index] = {
      ...this.customers[index],
      ...updateCustomerDto,
    };

    return this.customers[index];
  }

  remove(id: string) {
    const index = this.customers.findIndex(
      (customer: any) => customer.id === id,
    );

    if (index === -1) {
      return null;
    }

    const customer = this.customers[index];
    this.customers.splice(index, 1);

    return customer;
  }
}
