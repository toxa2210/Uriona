import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = [
    ["Электроника", "Электроника"],
    ["Для дома", "Для дома"],
    ["Одежда", "Одежда"],
    ["Красота", "Красота"],
    ["Аксессуары", "Аксессуары"],
    ["Спорт", "Sport"],
    ["Обувь", "Oyoq kiyim"],
    ["Сумки и рюкзаки", "Sumkalar va ryukzaklar"],
    ["Часы", "Soatlar"],
    ["Ювелирные украшения", "Zargarlik buyumlari"],
    ["Детские товары", "Bolalar mahsulotlari"],
    ["Кухня и посуда", "Oshxona va idishlar"],
    ["Автотовары", "Avtomobil mahsulotlari"],
    ["Товары для животных", "Uy hayvonlari uchun mahsulotlar"],
    ["Канцтовары и книги", "Kanselyariya va kitoblar"],
    ["Туризм и отдых", "Sayohat va dam olish"],
    ["Сад и дача", "Bog‘ va dala hovli"]
  ] as const;

  const categoryMap = new Map<string, string>();

  for (const [nameUz, nameRu] of categories) {
    const category = await prisma.category.upsert({
      where: { nameUz },
      update: { nameRu },
      create: { nameUz, nameRu }
    });
    categoryMap.set(nameUz, category.id);
  }

  const products = [
    ["Беспроводные наушники", "Simsiz quloqchinlar", "Электроника", 1990000],
    ["Умная лампа", "Aqlli chiroq", "Для дома", 1290000],
    ["Мужская худи", "Erkaklar hudisi", "Одежда", 2490000],
    ["Косметичка", "Kosmetichka", "Красота", 890000],
    ["Рюкзак", "Ryukzak", "Аксессуары", 3190000],
    ["Фитнес-браслет", "Fitnes bilaguzuk", "Спорт", 2790000]
  ] as const;

  for (const [titleRu, titleUz, categoryName, priceMinor] of products) {
    const supplierProductRef = `demo-${categoryName}-${titleRu}`;
    const existing = await prisma.product.findFirst({ where: { supplierProductRef } });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          titleRu,
          titleUz,
          categoryId: categoryMap.get(categoryName),
          currency: "UZS",
          priceMinor,
          status: "ACTIVE"
        }
      });
    } else {
      await prisma.product.create({
        data: {
          titleRu,
          titleUz,
          categoryId: categoryMap.get(categoryName),
          currency: "UZS",
          priceMinor,
          status: "ACTIVE",
          supplierProductRef
        }
      });
    }
  }

  console.log("Local demo catalog seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
