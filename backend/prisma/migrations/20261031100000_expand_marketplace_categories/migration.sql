-- Add useful top-level marketplace categories without duplicating categories
-- already imported from supplier catalogs.
WITH new_categories(id, name_uz, name_ru) AS (
  VALUES
    ('cmh7shoe00000000000000001', 'Oyoq kiyim', 'Обувь'),
    ('cmh7bag000000000000000002', 'Sumkalar va ryukzaklar', 'Сумки и рюкзаки'),
    ('cmh7watch0000000000000003', 'Soatlar', 'Часы'),
    ('cmh7jewel0000000000000004', 'Zargarlik buyumlari', 'Ювелирные украшения'),
    ('cmh7kids00000000000000005', 'Bolalar mahsulotlari', 'Детские товары'),
    ('cmh7kitch0000000000000006', 'Oshxona va idishlar', 'Кухня и посуда'),
    ('cmh7auto00000000000000007', 'Avtomobil mahsulotlari', 'Автотовары'),
    ('cmh7pets00000000000000008', 'Uy hayvonlari uchun mahsulotlar', 'Товары для животных'),
    ('cmh7books0000000000000009', 'Kanselyariya va kitoblar', 'Канцтовары и книги'),
    ('cmh7travel000000000000010', 'Sayohat va dam olish', 'Туризм и отдых'),
    ('cmh7garden000000000000011', 'Bog‘ va dala hovli', 'Сад и дача')
)
INSERT INTO "Category" ("id", "nameUz", "nameRu", "attributes", "createdAt")
SELECT c.id, c.name_uz, c.name_ru, '{}'::jsonb, NOW()
FROM new_categories c
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" existing
  WHERE lower(existing."nameRu") = lower(c.name_ru)
     OR lower(existing."nameUz") = lower(c.name_uz)
);
