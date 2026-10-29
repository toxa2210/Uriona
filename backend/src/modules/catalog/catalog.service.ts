import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
@Injectable()
export class CatalogService {
 constructor(private readonly prisma:PrismaService){}
 listCategories(){return this.prisma.category.findMany({orderBy:{nameUz:"asc"}});}
 async getProduct(id:string){const product=await this.prisma.product.findFirst({where:{id,status:"ACTIVE",sellerId:{not:null}},include:{category:true}});if(!product)throw new NotFoundException({code:"PRODUCT_NOT_FOUND",message:"Товар не найден"});return product;}
 async listProducts(p:{categoryId?:string;search?:string;page?:number;limit?:number;minPrice?:number;maxPrice?:number;sort?:string;source?:string}) {
  const page=Math.max(p.page??1,1),limit=Math.min(Math.max(p.limit??20,1),100);
  const where: Prisma.ProductWhereInput={status:"ACTIVE",sellerId:{not:null},...(p.categoryId?{categoryId:p.categoryId}:{}),...(p.search?{OR:[{titleUz:{contains:p.search,mode:"insensitive"}},{titleRu:{contains:p.search,mode:"insensitive"}}]}:{}),...(p.minPrice!==undefined||p.maxPrice!==undefined?{priceMinor:{...(p.minPrice!==undefined?{gte:p.minPrice}:{}),...(p.maxPrice!==undefined?{lte:p.maxPrice}:{})}}:{})};
    const orderBy: Prisma.ProductOrderByWithRelationInput = p.sort==="price_asc"?{priceMinor:"asc"}:p.sort==="price_desc"?{priceMinor:"desc"}:{createdAt:"desc"};
  const [items,total]=await Promise.all([this.prisma.product.findMany({where,orderBy,skip:(page-1)*limit,take:limit,include:{category:true}}),this.prisma.product.count({where})]);
  return {items,page,limit,total,pages:Math.ceil(total/limit)};
 }
}