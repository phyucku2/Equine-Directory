// Equine business category taxonomy (design-dossier.md §2).
// 14 top-level categories; each with subcategories. `phase1` marks launch-scope
// categories that are surfaced first. `icon` is a lucide-react icon name.

export interface CategorySeed {
  name: string;
  slug: string;
  icon: string;
  description: string;
  phase1?: boolean;
  children: Array<{
    name: string;
    slug: string;
    description: string;
    phase1?: boolean;
  }>;
}

export const CATEGORIES: CategorySeed[] = [
  {
    name: "Facilities & Accommodations",
    slug: "facilities",
    icon: "Warehouse",
    description:
      "Barns, stables, boarding, training and breeding facilities, and rescues.",
    phase1: true,
    children: [
      { name: "Boarding Facilities", slug: "horse-boarding", phase1: true, description: "Full, partial, self-care, pasture, and stall board." },
      { name: "Training Facilities", slug: "training-facilities", phase1: true, description: "Barns and centers offering on-site training." },
      { name: "Breeding Facilities", slug: "breeding-facilities", description: "Farms specializing in breeding and foaling." },
      { name: "Rescues & Sanctuaries", slug: "rescues-sanctuaries", description: "Equine rescue, rehabilitation, and retirement." },
      { name: "Specialized Accommodation", slug: "specialized-accommodation", description: "Quarantine, layup, and specialty boarding." },
    ],
  },
  {
    name: "Health & Veterinary Services",
    slug: "health-veterinary",
    icon: "Stethoscope",
    description: "Veterinarians, dentists, farriers, bodywork, nutrition, and rehab.",
    phase1: true,
    children: [
      { name: "Equine Veterinarians", slug: "equine-veterinarian", phase1: true, description: "Ambulatory and clinic-based equine vets." },
      { name: "Equine Dentistry", slug: "equine-dentistry", phase1: true, description: "Floating, extractions, and dental care." },
      { name: "Farriers", slug: "farrier", phase1: true, description: "Shoeing, trimming, and corrective farriery." },
      { name: "Chiropractic & Bodywork", slug: "chiropractic-bodywork", description: "Equine chiropractic, massage, and acupuncture." },
      { name: "Nutrition & Supplements", slug: "nutrition-supplements", description: "Equine nutritionists and feeding consults." },
      { name: "Therapy & Rehabilitation", slug: "therapy-rehabilitation", description: "Rehab, conditioning, and recovery services." },
    ],
  },
  {
    name: "Training & Instruction",
    slug: "training-instruction",
    icon: "GraduationCap",
    description: "Trainers, riding instructors, clinicians, and coaching programs.",
    phase1: true,
    children: [
      { name: "Trainers & Instructors", slug: "trainer-instructor", phase1: true, description: "Riding lessons and horse training across disciplines." },
      { name: "Clinicians & Specialists", slug: "clinician-specialist", description: "Traveling clinicians and discipline specialists." },
      { name: "Coaching Programs", slug: "coaching-program", description: "Competition coaching and structured programs." },
    ],
  },
  {
    name: "Specialized Care Services",
    slug: "care-services",
    icon: "Sparkles",
    description: "Grooming, stall cleaning, and exercise/conditioning services.",
    children: [
      { name: "Grooming & Spa", slug: "grooming-spa", description: "Body clipping, bathing, and show grooming." },
      { name: "Stall & Barn Cleaning", slug: "stall-cleaning", description: "Mucking, stall cleaning, and barn maintenance." },
      { name: "Exercise & Conditioning", slug: "exercise-conditioning", description: "Exercise riders, hot walkers, and conditioning." },
    ],
  },
  {
    name: "Breeding & Genetics",
    slug: "breeding-genetics",
    icon: "Dna",
    description: "Stallion services and reproductive/genetic services.",
    children: [
      { name: "Stallion Services", slug: "stallion-services", description: "Stud services, stallion stations, and rosters." },
      { name: "Reproductive & Genetic Services", slug: "reproductive-genetic-services", description: "AI, embryo transfer, and genetic testing." },
    ],
  },
  {
    name: "Sales, Marketing & Business",
    slug: "sales-marketing",
    icon: "Megaphone",
    description: "Horse sales, photography, marketing, and consulting.",
    children: [
      { name: "Horse Sales & Auctions", slug: "horse-sales-auctions", description: "Sales barns, agents, and auctions." },
      { name: "Equine Photography", slug: "equine-photography", description: "Show, portrait, and sales photography." },
      { name: "Digital Marketing & Web", slug: "digital-marketing-web", description: "Marketing and web services for equine businesses." },
      { name: "Business Consulting", slug: "business-consulting", description: "Operations and business consulting." },
    ],
  },
  {
    name: "Real Estate & Property",
    slug: "real-estate",
    icon: "Home",
    description: "Equine real estate and farm construction/management.",
    children: [
      { name: "Equine Real Estate", slug: "equine-real-estate", description: "Agents and brokers for horse properties." },
      { name: "Farm Construction & Management", slug: "farm-construction-management", description: "Arena, barn, stall, and fencing construction." },
    ],
  },
  {
    name: "Products & Supplies",
    slug: "products-supplies",
    icon: "ShoppingBag",
    description: "Tack shops, feed & forage, apparel, gear, and supplies.",
    children: [
      { name: "Tack Shops", slug: "tack-shop", description: "Saddles, bridles, and riding equipment." },
      { name: "Feed & Forage", slug: "feed-forage", description: "Feed stores, hay, and forage suppliers." },
      { name: "Apparel", slug: "apparel", description: "Riding apparel and footwear." },
      { name: "Blankets & Gear", slug: "blankets-gear", description: "Blankets, sheets, and barn gear." },
      { name: "Stable Supplies", slug: "stable-supplies", description: "Bedding, buckets, and stable essentials." },
      { name: "Supplements & Medications", slug: "supplements-medications", description: "Supplements and over-the-counter medications." },
    ],
  },
  {
    name: "Transportation & Logistics",
    slug: "transportation",
    icon: "Truck",
    description: "Horse hauling and trailer sales, rental, and repair.",
    children: [
      { name: "Horse Hauling", slug: "horse-hauling", description: "Local, long-distance, and specialty transport." },
      { name: "Trailer Sales, Rental & Repair", slug: "trailer-sales-rental-repair", description: "Trailer dealers, rentals, and service." },
    ],
  },
  {
    name: "Events & Competition",
    slug: "events-competition",
    icon: "Trophy",
    description: "Show organizers, venues, clinicians, and event insurance.",
    children: [
      { name: "Show Organizers", slug: "show-organizer", description: "Producers of shows and competitions." },
      { name: "Event Venues", slug: "event-venue", description: "Show grounds and equestrian venues." },
      { name: "Clinician Services", slug: "clinician-services", description: "Clinic organizers and hosts." },
      { name: "Event Insurance", slug: "event-insurance", description: "Insurance for shows and events." },
    ],
  },
  {
    name: "Breed & Discipline Associations",
    slug: "associations",
    icon: "Users",
    description: "Breed registries and discipline associations.",
    children: [
      { name: "Breed Registries", slug: "breed-registry", description: "Breed registration and records." },
      { name: "Discipline Associations", slug: "discipline-association", description: "Discipline-focused member organizations." },
    ],
  },
  {
    name: "Educational & Development",
    slug: "education",
    icon: "BookOpen",
    description: "Equine education academies and youth programs.",
    children: [
      { name: "Education & Academies", slug: "equine-education-academy", description: "Equine studies and certification programs." },
      { name: "Youth Programs", slug: "youth-program", description: "4-H, Pony Club, and breed youth programs." },
    ],
  },
  {
    name: "Specialized Professional Services",
    slug: "professional-services",
    icon: "Wrench",
    description: "Saddle fitting, behavior, and specialist consultants.",
    children: [
      { name: "Saddle Fitting", slug: "saddle-fitting", description: "Professional saddle fitting services." },
      { name: "Behavioral Specialists", slug: "behavioral-specialist", description: "Equine behavior and groundwork specialists." },
      { name: "Breeding & Genetics Consultants", slug: "genetics-breeding-consultant", description: "Breeding and genetics consulting." },
      { name: "Lameness & Rehab Experts", slug: "lameness-rehab-expert", description: "Lameness evaluation and rehab specialists." },
    ],
  },
  {
    name: "Ancillary Services",
    slug: "ancillary",
    icon: "ShieldCheck",
    description: "Equine insurance, records, rescue resources, and recreation.",
    children: [
      { name: "Equine Insurance", slug: "equine-insurance", description: "Mortality, major medical, and liability insurance." },
      { name: "Registry & Record Services", slug: "registry-record-services", description: "Registration and record-keeping services." },
      { name: "Rescue Resources", slug: "rescue-resources", description: "Resources supporting equine rescue." },
      { name: "Recreation & Guest Ranches", slug: "recreational-trail-guest-ranch", description: "Trail riding and guest ranch experiences." },
    ],
  },
];
