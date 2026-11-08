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
    } as unknown as jest.Mocked<StaffService>;

    controller = new StaffController(service);
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
