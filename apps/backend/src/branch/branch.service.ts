import { Injectable } from '@nestjs/common';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchService {
  private branches: any[] = [];
  private nextId = 1;

  create(createBranchDto: CreateBranchDto) {
    const branch = {
      id: this.nextId++,
      ...createBranchDto,
      createdAt: new Date(),
    };

    this.branches.push(branch);
    return branch;
  }

  findAll() {
    return this.branches;
  }

  findOne(id: number) {
    return this.branches.find(branch => branch.id === id);
  }

  update(id: number, updateBranchDto: UpdateBranchDto) {
    const branch = this.findOne(id);

    if (!branch) {
      return { message: 'Branch not found' };
    }

    Object.assign(branch, updateBranchDto);
    return branch;
  }

  remove(id: number) {
    this.branches = this.branches.filter(branch => branch.id !== id);
    return { message: 'Branch deleted successfully' };
  }
}
