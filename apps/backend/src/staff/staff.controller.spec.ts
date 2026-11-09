import { ForbiddenException } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

describe('StaffController', () => {
  let controller: StaffController;
  let service: jest.Mocked<StaffService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      assign: jest.fn(),
    } as unknown as jest.Mocked<StaffService>;

    const accessScope = {
      assertStaff: jest.fn().mockResolvedValue(true),
      assertBranch: jest.fn().mockResolvedValue(true),
      assertArea: jest.fn().mockResolvedValue(true),
      assertDivision: jest.fn().mockResolvedValue(true),
      assertRegion: jest.fn().mockResolvedValue(true),
    } as any;
    (controller as any).accessScope = accessScope;
    controller = new StaffController(service, accessScope);
  });

  it('checks the staff identity and assigned branch before creating a branch role assignment', async () => {
    const accessScope = (controller as any).accessScope;
    const result = { id: 'assignment-1' };
    service.assign.mockResolvedValue(result as any);

    await expect(controller.assign('staff-1', { role: Role.BRANCH_MANAGER, branchId: 'branch-1' }, {
      user: { id: 'admin-user', role: 'ADMIN' },
    } as any)).resolves.toBe(result);

    expect(accessScope.assertStaff).toHaveBeenCalledWith({ id: 'admin-user', role: 'ADMIN' }, 'staff-1');
    expect(accessScope.assertBranch).toHaveBeenCalledWith({ id: 'admin-user', role: 'ADMIN' }, 'branch-1');
    expect(service.assign).toHaveBeenCalledWith('staff-1', { role: Role.BRANCH_MANAGER, branchId: 'branch-1' });
  });

  it('prevents a branch Admin from creating an organization-wide Auditor assignment', async () => {
    await expect(controller.assign('staff-1', { role: Role.AUDITOR }, {
      user: { id: 'admin-user', role: 'ADMIN' },
    } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.assign).not.toHaveBeenCalled();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create staff', async () => {
    const dto = {
      staffId: 'ST-001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '08000000000',
      department: 'dept-1',
      position: 'Officer',
      branch: 'branch-1',
    };

    const result = { id: 'staff-1', ...dto };
    service.create.mockResolvedValue(result as any);

    await expect(controller.create(dto as any)).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should return filtered staff', async () => {
    const filter = { department: 'Loans' };
    const result = [{ id: 'staff-1' }];

    service.findAll.mockResolvedValue(result as any);

    await expect(controller.findAll(filter as any)).resolves.toBe(result);
    expect(service.findAll).toHaveBeenCalledWith(filter);
  });

  it('should return one staff member', async () => {
    const result = { id: 'staff-1' };
    service.findOne.mockResolvedValue(result as any);

    await expect(controller.findOne('staff-1')).resolves.toBe(result);
  });

  it('should update staff', async () => {
    const dto = { position: 'Manager' };
    const result = { id: 'staff-1', position: 'Manager' };

    service.update.mockResolvedValue(result as any);

    await expect(
      controller.update('staff-1', dto as any),
    ).resolves.toBe(result);

    expect(service.update).toHaveBeenCalledWith('staff-1', dto);
  });

  it('should remove staff', async () => {
    const result = { id: 'staff-1' };
    service.remove.mockResolvedValue(result as any);

    await expect(controller.remove('staff-1')).resolves.toBe(result);
    expect(service.remove).toHaveBeenCalledWith('staff-1');
  });
});
