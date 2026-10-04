import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { FinanceEntrySource, FinanceEntryType, OrderStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

const MAX_PAGE_SIZE = 100;

function pagination(pageValue?: string, limitValue?: string) {
  const page = pageValue === undefined ? 1 : Number(pageValue);
  const limit = limitValue === undefined ? 25 : Number(limitValue);
  if (!Number.isInteger(page) || page < 1) throw new BadRequestException("page must be a positive integer");
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new BadRequestException(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}`);
  }
  return { page, limit, skip: (page - 1) * limit };
}

function dateRange(from?: string, to?: string) {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const date = new Date(from);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("from must be a valid date");
    range.gte = date;
  }
  if (to) {
    const date = new Date(to);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("to must be a valid date");
    range.lte = date;
  }
  if (range.gte && range.lte && range.gte > range.lte) {
    throw new BadRequestException("from must be earlier than or equal to to");
  }
  return Object.keys(range).length ? range : undefined;
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [customers, orders, activeOrders, income, expenses, recentOrders] = await Promise.all([
      this.prisma.user.count({ where: { role: "CUSTOMER" } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: { in: ["PAID", "PROCESSING", "SHIPPED"] } } }),
      this.prisma.financeEntry.aggregate({
        where: { type: FinanceEntryType.INCOME, currency: "UZS" },
        _sum: { amountMinor: true }
      }),
      this.prisma.financeEntry.aggregate({
        where: { type: FinanceEntryType.EXPENSE, currency: "UZS" },
        _sum: { amountMinor: true }
      }),
      this.prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { id: true, name: true, email: true, phone: true } } }
      })
    ]);
    const incomeMinor = income._sum.amountMinor ?? 0;
    const expenseMinor = expenses._sum.amountMinor ?? 0;
    return {
      customers,
      orders,
      activeOrders,
      incomeMinor,
      expenseMinor,
      balanceMinor: incomeMinor - expenseMinor,
      currency: "UZS",
      recentOrders
    };
  }

  async customers(searchValue?: string, pageValue?: string, limitValue?: string) {
    const { page, limit, skip } = pagination(pageValue, limitValue);
    const search = searchValue?.trim();
    const where = {
      role: "CUSTOMER" as const,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } }
        ]
      } : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          createdAt: true,
          _count: { select: { orders: true } },
          orders: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, totalMinor: true, currency: true, status: true }
          }
        }
      }),
      this.prisma.user.count({ where })
    ]);
    return { items, page, limit, total, pages: Math.ceil(total / limit) };
  }

  async customer(id: string) {
    const customer = await this.prisma.user.findFirst({
      where: { id, role: "CUSTOMER" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        address: true,
        language: true,
        createdAt: true,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { items: { include: { product: true } }, payments: true, trackingEvents: { orderBy: { occurredAt: "desc" } } }
        }
      }
    });
    if (!customer) throw new NotFoundException("Customer not found");
    return customer;
  }

  async orders(searchValue?: string, statusValue?: string, pageValue?: string, limitValue?: string) {
    const { page, limit, skip } = pagination(pageValue, limitValue);
    if (statusValue && !Object.values(OrderStatus).includes(statusValue as OrderStatus)) {
      throw new BadRequestException("status is not a valid order status");
    }
    const search = searchValue?.trim();
    const where = {
      ...(statusValue ? { status: statusValue as OrderStatus } : {}),
      ...(search ? {
        OR: [
          { id: { contains: search, mode: "insensitive" as const } },
          { recipientName: { contains: search, mode: "insensitive" as const } },
          { recipientPhone: { contains: search } },
          { trackingNumber: { contains: search, mode: "insensitive" as const } },
          { user: { email: { contains: search, mode: "insensitive" as const } } }
        ]
      } : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          _count: { select: { items: true, trackingEvents: true } }
        }
      }),
      this.prisma.order.count({ where })
    ]);
    return { items, page, limit, total, pages: Math.ceil(total / limit) };
  }

  async order(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, city: true, address: true } },
        items: { include: { product: true } },
        payments: { orderBy: { createdAt: "desc" } },
        trackingEvents: {
          orderBy: { occurredAt: "desc" },
          include: { createdBy: { select: { id: true, name: true, email: true } } }
        }
      }
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async updateShipping(id: string, input: { carrier: string; trackingNumber: string; actorId: string }) {
    const carrier = input.carrier.trim();
    const trackingNumber = input.trackingNumber.trim();
    if (!carrier || !trackingNumber) throw new BadRequestException("Carrier and tracking number are required");
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, select: { id: true } });
      if (!order) throw new NotFoundException("Order not found");
      const updated = await tx.order.update({
        where: { id },
        data: { shippingCarrier: carrier, trackingNumber, trackingUpdatedAt: new Date() }
      });
      await tx.orderTrackingEvent.create({
        data: {
          orderId: id,
          status: "TRACKING_ADDED",
          description: `Трек-номер добавлен: ${carrier}, ${trackingNumber}`,
          occurredAt: new Date(),
          createdById: input.actorId
        }
      });
      return updated;
    });
  }

  async updateOrderStatus(id: string, status: OrderStatus, actorId: string, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) throw new NotFoundException("Order not found");
      if (order.status === status) return order;
      const allowed: Record<OrderStatus, OrderStatus[]> = {
        CREATED: [OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED],
        AWAITING_PAYMENT: [OrderStatus.CANCELLED],
        PAID: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
        PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
        SHIPPED: [OrderStatus.DELIVERED],
        DELIVERED: [],
        CANCELLED: []
      };
      if (!allowed[order.status].includes(status)) {
        throw new ConflictException(`Order cannot move from ${order.status} to ${status}`);
      }
      if (status === OrderStatus.SHIPPED && !order.trackingNumber) {
        throw new BadRequestException("Add a carrier and tracking number before marking the order as shipped");
      }
      const updated = await tx.order.update({ where: { id }, data: { status } });
      await tx.orderTrackingEvent.create({
        data: {
          orderId: id,
          status,
          description: note?.trim() || `Статус заказа изменён на ${status}`,
          occurredAt: new Date(),
          createdById: actorId
        }
      });
      return updated;
    });
  }

  async addTrackingEvent(id: string, input: {
    status: string;
    description: string;
    location?: string;
    occurredAt?: string;
    actorId: string;
  }) {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) throw new NotFoundException("Order not found");
    return this.prisma.orderTrackingEvent.create({
      data: {
        orderId: id,
        status: input.status.trim(),
        description: input.description.trim(),
        location: input.location?.trim() || null,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        createdById: input.actorId
      }
    });
  }

  async financeSummary(fromValue?: string, toValue?: string) {
    const occurredAt = dateRange(fromValue, toValue);
    const [income, expenses] = await Promise.all([
      this.prisma.financeEntry.aggregate({
        where: { occurredAt, type: FinanceEntryType.INCOME, currency: "UZS" },
        _sum: { amountMinor: true },
        _count: true
      }),
      this.prisma.financeEntry.aggregate({
        where: { occurredAt, type: FinanceEntryType.EXPENSE, currency: "UZS" },
        _sum: { amountMinor: true },
        _count: true
      })
    ]);
    const incomeMinor = income._sum.amountMinor ?? 0;
    const expenseMinor = expenses._sum.amountMinor ?? 0;
    return {
      incomeMinor,
      expenseMinor,
      balanceMinor: incomeMinor - expenseMinor,
      incomeEntries: income._count,
      expenseEntries: expenses._count,
      currency: "UZS"
    };
  }

  async financeEntries(fromValue?: string, toValue?: string, pageValue?: string, limitValue?: string) {
    const { page, limit, skip } = pagination(pageValue, limitValue);
    const occurredAt = dateRange(fromValue, toValue);
    const where = { occurredAt };
    const [items, total] = await Promise.all([
      this.prisma.financeEntry.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          order: { select: { id: true, status: true } },
          createdBy: { select: { id: true, name: true, email: true } }
        }
      }),
      this.prisma.financeEntry.count({ where })
    ]);
    return { items, page, limit, total, pages: Math.ceil(total / limit) };
  }

  createManualFinanceEntry(type: FinanceEntryType, input: {
    category: string;
    description: string;
    amountMinor: number;
    occurredAt?: string;
    actorId: string;
  }) {
    const category = input.category.trim();
    const description = input.description.trim();
    if (!category || !description) throw new BadRequestException("Category and description are required");
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1 || input.amountMinor > 2_147_483_647) {
      throw new BadRequestException("amountMinor must be a positive supported integer amount");
    }
    return this.prisma.financeEntry.create({
      data: {
        type,
        source: FinanceEntrySource.MANUAL,
        category,
        description,
        amountMinor: input.amountMinor,
        currency: "UZS",
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        createdById: input.actorId
      }
    });
  }
}
