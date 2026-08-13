import { BranchService } from './branch.service';

describe('BranchService', () => {
  let service: BranchService;

  beforeEach(() => {
    service = new BranchService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a branch', () => {
    const dto = {
      name: 'Main Branch',
      code: 'MAIN',
      address: 'Lagos',
      phone: '08000000000',
      manager: 'Manager One',
    };

    const result = service.create(dto);

    expect(result).toMatchObject({
      id: 1,
      ...dto,
    });

    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('should return all branches', () => {
    service.create({ name: 'Main Branch' });
    service.create({ name: 'Ikeja Branch' });

    const result = service.findAll();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Main Branch');
    expect(result[1].name).toBe('Ikeja Branch');
  });

  it('should return a branch by id', () => {
    const branch = service.create({
      name: 'Main Branch',
    });

    expect(
      service.findOne(branch.id),
    ).toBe(branch);
  });

  it('should return undefined for a missing branch', () => {
    expect(
      service.findOne(999),
    ).toBeUndefined();
  });

  it('should update an existing branch', () => {
    const branch = service.create({
      name: 'Main Branch',
    });

    const result = service.update(
      branch.id,
      {
        name: 'Updated Main Branch',
        phone: '08111111111',
      },
    );

    expect(result).toMatchObject({
      id: branch.id,
      name: 'Updated Main Branch',
      phone: '08111111111',
    });
  });

  it('should return not found when updating a missing branch', () => {
    expect(
      service.update(999, {
        name: 'Missing Branch',
      }),
    ).toEqual({
      message: 'Branch not found',
    });
  });

  it('should delete an existing branch', () => {
    const branch = service.create({
      name: 'Main Branch',
    });

    expect(
      service.remove(branch.id),
    ).toEqual({
      message: 'Branch deleted successfully',
    });

    expect(
      service.findOne(branch.id),
    ).toBeUndefined();
  });

  it('should keep other branches when deleting one', () => {
    const first = service.create({
      name: 'Main Branch',
    });

    const second = service.create({
      name: 'Ikeja Branch',
    });

    service.remove(first.id);

    expect(service.findAll()).toEqual([second]);
  });
});
