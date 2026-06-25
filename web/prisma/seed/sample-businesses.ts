// Dev/preview-only sample businesses. Seeded only when SEED_SAMPLES=1.
// These are illustrative fixtures (NOT real businesses) so the UI is
// demonstrable before the crawl4ai pipeline lands real data.

import { PrismaClient, CategoryGrade, GradeSource, ReviewStatus } from "@prisma/client";

interface SampleCategory {
  slug: string;
  primary?: boolean;
  grade?: CategoryGrade; // default GRADE_3_CONFIRMED
  evidence?: string;
}

interface Sample {
  name: string;
  citySlug: string;
  lat: number;
  lng: number;
  address: string;
  phone?: string;
  website?: string;
  description: string;
  amenities?: string[];
  attributes?: Record<string, unknown>;
  rating?: number;
  reviewCount?: number;
  isFeatured?: boolean;
  verification?: "UNVERIFIED" | "VERIFIED" | "TRUSTED" | "PREMIUM";
  categories: SampleCategory[];
}

const SAMPLES: Sample[] = [
  {
    name: "Live Oak Stables",
    citySlug: "ocala",
    lat: 29.1995,
    lng: -82.187,
    address: "4200 NW Hwy 225, Ocala, FL 34482",
    phone: "(352) 555-0142",
    website: "https://liveoakstables.example.com",
    description:
      "Full-service boarding and training facility on 80 acres in NW Ocala. Full board, pasture board, and self-care available with indoor and outdoor arenas.",
    amenities: ["Indoor arena", "Outdoor arena", "Wash stalls", "Tack rooms", "Trails", "Round pen"],
    attributes: { boardingTypes: ["full", "pasture", "self-care"], stallCount: 60, acreage: 80 },
    rating: 4.8,
    reviewCount: 24,
    isFeatured: true,
    verification: "TRUSTED",
    categories: [
      { slug: "horse-boarding", primary: true, evidence: "Full board, pasture board, and self-care available." },
      { slug: "training-facilities" },
    ],
  },
  {
    name: "Wellington Sport Horses",
    citySlug: "wellington",
    lat: 26.659,
    lng: -80.27,
    address: "13500 South Shore Blvd, Wellington, FL 33414",
    phone: "(561) 555-0199",
    website: "https://wellingtonsporthorses.example.com",
    description:
      "Premier hunter/jumper training and boarding minutes from the Wellington International showgrounds. Show coaching across all levels.",
    amenities: ["Indoor arena", "Grand prix field", "Hot walker", "EuroXciser"],
    attributes: { disciplines: ["hunter", "jumper"], boardingTypes: ["full"], stallCount: 36 },
    rating: 4.9,
    reviewCount: 41,
    isFeatured: true,
    verification: "PREMIUM",
    categories: [
      { slug: "trainer-instructor", primary: true, evidence: "Show coaching across all levels." },
      { slug: "horse-boarding" },
    ],
  },
  {
    name: "Marion County Equine Hospital",
    citySlug: "ocala",
    lat: 29.155,
    lng: -82.13,
    address: "7350 SW 60th Ave, Ocala, FL 34476",
    phone: "(352) 555-0177",
    website: "https://marionequinehospital.example.com",
    description:
      "Full-service equine hospital offering 24/7 emergency care, lameness diagnostics, surgery, and reproduction services.",
    attributes: { credentials: ["DVM"], specialties: ["lameness", "surgery", "reproduction"], emergencyAvailable: true },
    rating: 4.7,
    reviewCount: 33,
    verification: "VERIFIED",
    categories: [{ slug: "equine-veterinarian", primary: true, evidence: "24/7 emergency care, lameness, surgery." }],
  },
  {
    name: "Hooves & Steel Farrier Service",
    citySlug: "ocala",
    lat: 29.18,
    lng: -82.2,
    address: "Mobile service, Ocala, FL",
    phone: "(352) 555-0121",
    description: "Mobile farrier serving Marion County. Corrective shoeing, trims, and lameness-support shoeing.",
    attributes: { credentials: ["AFA Certified"], mobileService: true },
    rating: 4.9,
    reviewCount: 18,
    verification: "VERIFIED",
    categories: [{ slug: "farrier", primary: true, evidence: "Corrective shoeing, trims, lameness-support shoeing." }],
  },
  {
    name: "Sunshine Tack & Feed",
    citySlug: "ocala",
    lat: 29.176,
    lng: -82.16,
    address: "2901 N Pine Ave, Ocala, FL 34475",
    phone: "(352) 555-0188",
    website: "https://sunshinetackfeed.example.com",
    description: "Family-owned tack and feed store carrying English and Western tack, plus quality feed and forage.",
    attributes: { brandsCarried: ["Purina", "Triple Crown", "Weaver"], inventoryType: "new" },
    rating: 4.6,
    reviewCount: 52,
    verification: "VERIFIED",
    categories: [
      { slug: "tack-shop", primary: true, evidence: "English and Western tack." },
      { slug: "feed-forage", evidence: "Quality feed and forage." },
    ],
  },
  {
    name: "Gulf Coast Horse Transport",
    citySlug: "tampa",
    lat: 27.95,
    lng: -82.45,
    address: "Tampa, FL",
    phone: "(813) 555-0150",
    website: "https://gulfcoasthorsetransport.example.com",
    description: "Local and long-distance horse hauling with climate-controlled, air-ride trailers. Fully insured and DOT-registered.",
    attributes: { haulType: ["local", "long-distance"], climateControl: true, insuranceVerified: true },
    rating: 4.8,
    reviewCount: 27,
    verification: "VERIFIED",
    categories: [{ slug: "horse-hauling", primary: true, evidence: "Local and long-distance hauling, DOT-registered." }],
  },
  {
    name: "Sarasota Equestrian Center",
    citySlug: "sarasota",
    lat: 27.31,
    lng: -82.45,
    address: "8451 Fruitville Rd, Sarasota, FL 34240",
    phone: "(941) 555-0166",
    website: "https://sarasotaequestrian.example.com",
    description: "Boarding, lessons, and a busy local show series. Lighted arenas and covered round pen.",
    amenities: ["Lighted arena", "Covered round pen", "Cross-ties"],
    attributes: { boardingTypes: ["full", "partial"], stallCount: 44 },
    rating: 4.5,
    reviewCount: 30,
    verification: "TRUSTED",
    categories: [
      { slug: "horse-boarding", primary: true, evidence: "Full and partial board." },
      { slug: "trainer-instructor" },
      { slug: "show-organizer" },
    ],
  },
  {
    name: "Brooksville Trail Rides & Ranch",
    citySlug: "brooksville",
    lat: 28.555,
    lng: -82.39,
    address: "15400 Cortez Blvd, Brooksville, FL 34601",
    phone: "(352) 555-0133",
    description: "Guided trail rides and a working guest ranch experience in the Withlacoochee area.",
    attributes: { recreationType: ["trail rides"], bookingAvailable: true },
    rating: 4.4,
    reviewCount: 61,
    categories: [{ slug: "recreational-trail-guest-ranch", primary: true, evidence: "Guided trail rides and guest ranch." }],
  },
  // ── Moderation-queue fixtures (grades 1 & 2 → PENDING_REVIEW) ──
  {
    name: "Whispering Pines Farm",
    citySlug: "newberry",
    lat: 29.646,
    lng: -82.607,
    address: "Newberry, FL 32669",
    description:
      "Private 40-acre farm with several stalls and an arena. Listed as possible boarding — needs verification (calls itself a 'farm', no explicit boarding offer found).",
    amenities: ["Arena", "Stalls"],
    rating: 4.2,
    reviewCount: 5,
    categories: [
      // Grade 2: suggestive (stalls/arena) but no explicit boarding offer -> review queue
      { slug: "horse-boarding", primary: true, grade: CategoryGrade.GRADE_2_UNSURE, evidence: "Has stalls and an arena; no explicit boarding language found." },
    ],
  },
  {
    name: "Citra Cattle & Hay Co.",
    citySlug: "citra",
    lat: 29.41,
    lng: -82.11,
    address: "Citra, FL 32113",
    description:
      "Cattle operation and hay supplier. Auto-classified into boarding by a source aggregator — likely incorrect; flagged for review.",
    categories: [
      // Grade 1: no evidence of boarding -> review queue (misclassification catch)
      { slug: "horse-boarding", primary: true, grade: CategoryGrade.GRADE_1_NOT, evidence: "No evidence of horse boarding; appears to be cattle/hay." },
      { slug: "feed-forage", evidence: "Hay supplier." },
    ],
  },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function seedSampleBusinesses(prisma: PrismaClient) {
  // Map city slug -> location id
  const cities = await prisma.location.findMany({ where: { type: "CITY" }, select: { id: true, slug: true } });
  const cityId = new Map(cities.map((c) => [c.slug, c.id]));
  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  let created = 0;
  for (const s of SAMPLES) {
    const locationId = cityId.get(s.citySlug);
    if (!locationId) {
      console.warn(`  ! sample ${s.name}: unknown city ${s.citySlug}`);
      continue;
    }
    const slug = `${slugify(s.name)}-${s.citySlug}`;

    // A business is published if it has >=1 publishable category (grade 3 auto-approved).
    const hasPublishable = s.categories.some(
      (c) => (c.grade ?? CategoryGrade.GRADE_3_CONFIRMED) === CategoryGrade.GRADE_3_CONFIRMED,
    );

    const business = await prisma.business.upsert({
      where: { slug },
      update: {},
      create: {
        name: s.name,
        slug,
        description: s.description,
        phone: s.phone ?? null,
        website: s.website ?? null,
        address: s.address,
        latitude: s.lat,
        longitude: s.lng,
        locationId,
        amenities: s.amenities ?? [],
        attributes: (s.attributes as object) ?? undefined,
        rating: s.rating ?? null,
        reviewCount: s.reviewCount ?? 0,
        isFeatured: s.isFeatured ?? false,
        isVerified: (s.verification ?? "UNVERIFIED") !== "UNVERIFIED",
        verificationBadge: s.verification ?? "UNVERIFIED",
        isPublished: hasPublishable,
        dataSourceUrl: null,
        externalSourceId: `sample:${slug}`,
      },
    });

    for (const [i, c] of s.categories.entries()) {
      const categoryId = catId.get(c.slug);
      if (!categoryId) {
        console.warn(`  ! sample ${s.name}: unknown category ${c.slug}`);
        continue;
      }
      const grade = c.grade ?? CategoryGrade.GRADE_3_CONFIRMED;
      const reviewStatus =
        grade === CategoryGrade.GRADE_3_CONFIRMED
          ? ReviewStatus.AUTO_APPROVED
          : ReviewStatus.PENDING_REVIEW;
      await prisma.businessCategory.upsert({
        where: { businessId_categoryId: { businessId: business.id, categoryId } },
        update: {},
        create: {
          businessId: business.id,
          categoryId,
          isPrimary: c.primary ?? false,
          rank: i,
          grade,
          gradeSource: GradeSource.LLM_EXTRACTION,
          confidence: grade === CategoryGrade.GRADE_3_CONFIRMED ? 0.95 : grade === CategoryGrade.GRADE_2_UNSURE ? 0.5 : 0.1,
          evidenceQuote: c.evidence ?? null,
          reviewStatus,
        },
      });
    }
    created++;
  }
  console.log(`  sample businesses: ${created} upserted (SEED_SAMPLES)`);
}
