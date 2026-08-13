import { BranchController } from './branch.controller';
import { BranchService } from './branch.service';

describe('BranchController', () => {
  let controller: BranchController;
  let service: jest.Mocked<BranchService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<BranchService>;

    controller = new BranchController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a branch', async () => {
    const dto = {
      name: 'Main Branch',
      code: 'MAIN',
    };

    const result = {
      id: 1,
      ...dto,
    };

    service.create.mockReturnValue(result as any);

    expect(controller.create(dto)).toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should return all branches', () => {
    const result = [
      {
        id: 1,
        name: 'Main Branch',
      },
    ];

    service.findAll.mockReturnValue(result as any);

    expect(controller.findAll()).toBe(result);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should return one branch', () => {
    const result = {
      id: 1,
      name: 'Main Branch',
    };

    service.findOne.mockReturnValue(result as any);

    expect(controller.findOne('1')).toBe(result);
    expect(service.findOne).toHaveBeenCalledWith(1);
  });

  it('should update a branch', () => {
    const dto = {
      name: 'Updated Branch',
    };

    const result = {
      id: 1,
      name: 'Updated Branch',
    };

    service.update.mockReturnValue(result as any);

    expect(
      controller.update('1', dto),
    ).toBe(result);

    expect(service.update).toHaveBeenCalledWith(
      1,
      dto,
    );
  });

  it('should delete a branch', () => {
    const result = {
      message: 'Branch deleted successfully',
    };

    service.remove.mockReturnValue(result);

    expect(controller.remove('1')).toBe(result);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
