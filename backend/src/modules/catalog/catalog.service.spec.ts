import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CatalogService } from "./catalog.service";

describe("CatalogService", () => {
  let service: CatalogService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      category: { findMany: jest.fn() },
      product: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };
    service = new CatalogService(prisma as never);
  });

  it("lists only active products owned by sellers", async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);

    await expect(service.listProducts({})).resolves.toMatchObject({ items: [], total: 0 });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "ACTIVE", sellerId: { not: null } },
    }));
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: { status: "ACTIVE", sellerId: { not: null } },
    });
  });

  it("does not return an active product without a seller owner", async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.getProduct("imported-product")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: "imported-product", status: "ACTIVE", sellerId: { not: null } },
      include: { category: true },
    });
  });
});