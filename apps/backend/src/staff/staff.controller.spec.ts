import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

describe('StaffController', () => {
  let controller: StaffController;
  let service: any;
  const req = { user: { id: 'admin-user', role: 'ADMIN' } };

  beforeEach(() => {
    service = { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };
    controller = new StaffController(
      service as StaffService,
      {
        filterList: jest.fn((user, resource, rows) => rows),
        assertStaff: jest.fn().mockResolvedValue(true),
      } as any,
    );
  });

  it('creates staff', async () => {
    const dto = { staffId: 'ST-001', firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '08000000000', department: 'dept-1', position: 'Officer', branch: 'branch-1' };
    const result = { id: 'staff-1', ...dto };
    service.create.mockResolvedValue(result);
    await expect(controller.create(dto as any)).resolves.toBe(result);
  });

  it('returns filtered staff within scope', async () => {
    const filter = { department: 'Loans' };
    const result = [{ id: 'staff-1' }];
    service.findAll.mockResolvedValue(result);
    await expect(controller.findAll(filter as any, req as any)).resolves.toBe(result);
    expect(service.findAll).toHaveBeenCalledWith(filter);
  });

  it('returns one staff member in scope', async () => {
    const result = { id: 'staff-1' };
    service.findOne.mockResolvedValue(result);
    await expect(controller.findOne('staff-1', req as any)).resolves.toBe(result);
    expect(service.findOne).toHaveBeenCalledWith('staff-1');
  });

  it('updates staff', async () => {
    const dto = { position: 'Manager' };
    const result = { id: 'staff-1', position: 'Manager' };
    service.update.mockResolvedValue(result);
    await expect(controller.update('staff-1', dto as any)).resolves.toBe(result);
  });

  it('removes staff', async () => {
    const result = { id: 'staff-1' };
    service.remove.mockResolvedValue(result);
    await expect(controller.remove('staff-1')).resolves.toBe(result);
  });
});
