import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = [
    ["Электроника", "Электроника"],
    ["Для дома", "Для дома"],
    ["Одежда", "Одежда"],
    ["Красота", "Красота"],
    ["Аксессуары", "Аксессуары"],
    ["Sport", "Спорт"],
    ["Oyoq kiyim", "Обувь"],
    ["Sumkalar va ryukzaklar", "Сумки и рюкзаки"],
    ["Soatlar", "Часы"],
    ["Zargarlik buyumlari", "Ювелирные украшения"],
    ["Bolalar mahsulotlari", "Детские товары"],
    ["Oshxona va idishlar", "Кухня и посуда"],
    ["Avtomobil mahsulotlari", "Автотовары"],
    ["Uy hayvonlari uchun mahsulotlar", "Товары для животных"],
    ["Kanselyariya va kitoblar", "Канцтовары и книги"],
    ["Sayohat va dam olish", "Туризм и отдых"],
    ["Bog‘ va dala hovli", "Сад и дача"]
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
