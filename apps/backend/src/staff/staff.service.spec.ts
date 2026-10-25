import { StaffService } from './staff.service';
import { StaffRepository } from './staff.repository';

describe('StaffService', () => {
  let service: StaffService;
  let repository: jest.Mocked<StaffRepository>;
  let virtualAccounts: { ensureStaff: jest.Mock; getStaff: jest.Mock };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
        createWithUser: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
        emailExists: jest.fn().mockResolvedValue(false),
        staffIdExists: jest.fn().mockResolvedValue(false),
        count: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<StaffRepository>;

    virtualAccounts = { ensureStaff: jest.fn().mockResolvedValue({ status: 'PENDING' }), getStaff: jest.fn().mockResolvedValue({ providerCustomerCode: 'CUS_staff_test' }) };

    service = new StaffService(
      repository,
      {
        $executeRawUnsafe: jest.fn(),
        $queryRawUnsafe: jest.fn(),
        staff: { update: jest.fn().mockResolvedValue({}) },
      } as any,
      { isConfigured: jest.fn().mockReturnValue(false) } as any,
      virtualAccounts as any,
    );
    jest.spyOn(service, 'getBvnVerification').mockResolvedValue({
      verified: true,
      pending: false,
      reference: 'BVN-REF-1',
      firstName: 'John',
      middleName: '',
      lastName: 'Doe',
      fullName: 'John Doe',
      status: 'COMPLETED',
      message: '',
    } as any);
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
      bvnVerificationReference: 'BVN-REF-1',
    };

    const staff = { id: 'staff-1', employmentStatus: 'ACTIVE', ...dto };

    repository.createWithUser.mockResolvedValue({
      staff,
    } as any);

    const result = await service.create(dto as any);

    expect(result).toMatchObject({
      message: 'Staff created successfully',
      staff,
      login: {
        email: 'john.doe@pwfb.com',
      },
    });

    expect(result.login.temporaryPassword).toMatch(
      /^PWFB-[A-Z0-9]+-[0-9]{4}$/,
    );

    expect(repository.emailExists).toHaveBeenCalledWith(
      'john.doe@pwfb.com',
    );

    expect(repository.createWithUser).toHaveBeenCalledWith(
      expect.objectContaining({
        staffId: 'ST-001',
        firstName: 'John',
        middleName: undefined,
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '08000000000',
        department: 'dept-1',
        position: 'Officer',
        branch: 'branch-1',
      }),
      expect.objectContaining({
        staffId: 'ST-001',
        email: 'john.doe@pwfb.com',
        password: expect.any(String),
      }),
      undefined,
    );
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

  it('automatically resumes Paystack DVA assignment when a BVN-verified staff member becomes active', async () => {
    const staff = { id: 'staff-activated', employmentStatus: 'ACTIVE', bvnVerified: true };
    repository.update.mockResolvedValue(staff as any);
    virtualAccounts.getStaff.mockResolvedValue({ providerCustomerCode: 'CUS_staff_activated' });

    await expect(service.update('staff-activated', { employmentStatus: 'ACTIVE' } as any)).resolves.toBe(staff);

    expect(virtualAccounts.getStaff).toHaveBeenCalledWith('staff-activated');
    expect(virtualAccounts.ensureStaff).toHaveBeenCalledWith('staff-activated', 'CUS_staff_activated');
  });

  it('keeps staff activation successful when Paystack DVA assignment fails', async () => {
    const staff = { id: 'staff-activated', employmentStatus: 'ACTIVE', bvnVerified: true };
    repository.update.mockResolvedValue(staff as any);
    virtualAccounts.getStaff.mockResolvedValue({ providerCustomerCode: 'CUS_staff_activated' });
    virtualAccounts.ensureStaff.mockRejectedValue(new Error('Paystack unavailable'));

    await expect(service.update('staff-activated', { employmentStatus: 'ACTIVE' } as any)).resolves.toBe(staff);
    expect(virtualAccounts.ensureStaff).toHaveBeenCalledWith('staff-activated', 'CUS_staff_activated');
  });

  it('does not attempt Paystack DVA assignment for staff who are not BVN verified', async () => {
    const staff = { id: 'staff-not-verified', employmentStatus: 'ACTIVE', bvnVerified: false };
    repository.update.mockResolvedValue(staff as any);

    await expect(service.update('staff-not-verified', { employmentStatus: 'ACTIVE' } as any)).resolves.toBe(staff);
    expect(virtualAccounts.getStaff).not.toHaveBeenCalled();
    expect(virtualAccounts.ensureStaff).not.toHaveBeenCalled();
  });

  it('should remove staff', async () => {
    const result = { id: 'staff-1' };
    repository.remove.mockResolvedValue(result as any);

    await expect(service.remove('staff-1')).resolves.toBe(result);
    expect(repository.remove).toHaveBeenCalledWith('staff-1');
  });
});
