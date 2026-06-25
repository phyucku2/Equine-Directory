import { PrismaClient, LocationType } from "@prisma/client";
import { CATEGORIES } from "./seed/categories";
import { FLORIDA, COUNTIES, CITIES } from "./seed/locations";

const prisma = new PrismaClient();

// Idempotent get-or-create for a Location node (compound natural key:
// slug + type + parentId, where parentId may be null for the country root).
async function upsertLocation(args: {
  type: LocationType;
  name: string;
  slug: string;
  code?: string | null;
  parentId?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const existing = await prisma.location.findFirst({
    where: { slug: args.slug, type: args.type, parentId: args.parentId ?? null },
  });
  if (existing) {
    return prisma.location.update({
      where: { id: existing.id },
      data: {
        name: args.name,
        code: args.code ?? null,
        latitude: args.lat ?? null,
        longitude: args.lng ?? null,
      },
    });
  }
  return prisma.location.create({
    data: {
      type: args.type,
      name: args.name,
      slug: args.slug,
      code: args.code ?? null,
      parentId: args.parentId ?? null,
      latitude: args.lat ?? null,
      longitude: args.lng ?? null,
    },
  });
}

async function seedLocations() {
  const usa = await upsertLocation({
    type: LocationType.COUNTRY,
    name: "United States",
    slug: "us",
    code: "US",
    parentId: null,
    lat: 39.8283,
    lng: -98.5795,
  });

  const fl = await upsertLocation({
    type: LocationType.STATE,
    name: FLORIDA.name,
    slug: FLORIDA.slug,
    code: FLORIDA.code,
    parentId: usa.id,
    lat: FLORIDA.lat,
    lng: FLORIDA.lng,
  });

  const countyByFips = new Map<string, string>();
  for (const c of COUNTIES) {
    const county = await upsertLocation({
      type: LocationType.COUNTY,
      name: c.name,
      slug: c.slug,
      code: c.fips,
      parentId: fl.id,
      lat: c.lat,
      lng: c.lng,
    });
    countyByFips.set(c.fips, county.id);
  }

  let cityCount = 0;
  for (const city of CITIES) {
    const parentId = countyByFips.get(city.countyFips);
    if (!parentId) {
      console.warn(`  ! city ${city.name}: unknown county FIPS ${city.countyFips}`);
      continue;
    }
    await upsertLocation({
      type: LocationType.CITY,
      name: city.name,
      slug: city.slug,
      parentId,
      lat: city.lat,
      lng: city.lng,
    });
    cityCount++;
  }

  console.log(
    `  locations: 1 country, 1 state, ${COUNTIES.length} counties, ${cityCount} cities`,
  );
}

async function seedCategories() {
  let top = 0;
  let sub = 0;
  for (const cat of CATEGORIES) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon, description: cat.description },
      create: { name: cat.name, slug: cat.slug, icon: cat.icon, description: cat.description },
    });
    top++;
    for (const child of cat.children) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, description: child.description, parentId: parent.id },
        create: {
          name: child.name,
          slug: child.slug,
          description: child.description,
          parentId: parent.id,
        },
      });
      sub++;
    }
  }
  console.log(`  categories: ${top} top-level, ${sub} subcategories`);
}

async function main() {
  console.log("Seeding Equine Directory...");
  await seedLocations();
  await seedCategories();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
