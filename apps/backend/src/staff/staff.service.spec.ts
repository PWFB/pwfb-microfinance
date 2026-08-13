import { StaffService } from './staff.service';
import { StaffRepository } from './staff.repository';

describe('StaffService', () => {
  let service: StaffService;
  let repository: jest.Mocked<StaffRepository>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<StaffRepository>;

    service = new StaffService(repository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
    repository.create.mockResolvedValue(result as any);

    await expect(service.create(dto as any)).resolves.toBe(result);
    expect(repository.create).toHaveBeenCalledWith(dto);
  });

  it('should return all staff without a filter', async () => {
    const result = [
      {
        id: 'staff-1',
        firstName: 'John',
        lastName: 'Doe',
        department: { name: 'Loans' },
        branch: { name: 'Main' },
        employmentStatus: 'ACTIVE',
      },
    ];

    repository.findAll.mockResolvedValue(result as any);

    await expect(service.findAll()).resolves.toBe(result);
  });

  it('should filter staff by department', async () => {
    const result = [
      {
        id: 'staff-1',
        firstName: 'John',
        lastName: 'Doe',
        department: { name: 'Loans' },
        branch: { name: 'Main' },
        employmentStatus: 'ACTIVE',
      },
      {
        id: 'staff-2',
        firstName: 'Jane',
        lastName: 'Doe',
        department: { name: 'Finance' },
        branch: { name: 'Main' },
        employmentStatus: 'ACTIVE',
      },
    ];

    repository.findAll.mockResolvedValue(result as any);

    const filtered = await service.findAll({
      department: 'Loans',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('staff-1');
  });

  it('should filter staff by branch', async () => {
    const result = [
      {
        id: 'staff-1',
        firstName: 'John',
        lastName: 'Doe',
        department: { name: 'Loans' },
        branch: { name: 'Main' },
        employmentStatus: 'ACTIVE',
      },
      {
        id: 'staff-2',
        firstName: 'Jane',
        lastName: 'Doe',
        department: { name: 'Finance' },
        branch: { name: 'Ikeja' },
        employmentStatus: 'ACTIVE',
      },
    ];

    repository.findAll.mockResolvedValue(result as any);

    const filtered = await service.findAll({
      branch: 'Ikeja',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('staff-2');
  });

  it('should filter staff by employment status', async () => {
    const result = [
      {
        id: 'staff-1',
        firstName: 'John',
        lastName: 'Doe',
        department: { name: 'Loans' },
        branch: { name: 'Main' },
        employmentStatus: 'ACTIVE',
      },
      {
        id: 'staff-2',
        firstName: 'Jane',
        lastName: 'Doe',
        department: { name: 'Finance' },
        branch: { name: 'Main' },
        employmentStatus: 'INACTIVE',
      },
    ];

    repository.findAll.mockResolvedValue(result as any);

    const filtered = await service.findAll({
      employmentStatus: 'INACTIVE',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('staff-2');
  });

  it('should filter staff by search text', async () => {
    const result = [
      {
        id: 'staff-1',
        firstName: 'John',
        lastName: 'Doe',
        department: { name: 'Loans' },
        branch: { name: 'Main' },
        employmentStatus: 'ACTIVE',
      },
      {
        id: 'staff-2',
        firstName: 'Jane',
        lastName: 'Smith',
        department: { name: 'Finance' },
        branch: { name: 'Main' },
        employmentStatus: 'ACTIVE',
      },
    ];

    repository.findAll.mockResolvedValue(result as any);

    const filtered = await service.findAll({
      search: 'jane smith',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('staff-2');
  });

  it('should return one staff member', async () => {
    const result = { id: 'staff-1' };
    repository.findOne.mockResolvedValue(result as any);

    await expect(service.findOne('staff-1')).resolves.toBe(result);
  });

  it('should update staff', async () => {
    const dto = { position: 'Manager' };
    const result = { id: 'staff-1', position: 'Manager' };

    repository.update.mockResolvedValue(result as any);

    await expect(
      service.update('staff-1', dto as any),
    ).resolves.toBe(result);

    expect(repository.update).toHaveBeenCalledWith(
      'staff-1',
      dto,
    );
  });

  it('should remove staff', async () => {
    const result = { id: 'staff-1' };
    repository.remove.mockResolvedValue(result as any);

    await expect(service.remove('staff-1')).resolves.toBe(result);
    expect(repository.remove).toHaveBeenCalledWith('staff-1');
  });
});
