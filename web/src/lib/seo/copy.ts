// Unique per-category intro copy + FAQs for the SEO hub pages (Goal 5 / T44).
// Each catalog category gets a distinct intro (optionally localized with a place
// name) and a small evergreen FAQ set. FAQs render visibly on the page AND as
// FAQPage JSON-LD — Google requires the content to be user-visible.

export interface HubFaq {
  q: string;
  a: string;
}

interface CategoryCopy {
  /** Intro paragraph. `place` (e.g. "Ocala, Florida") localizes it when given. */
  intro: (place?: string) => string;
  faqs: HubFaq[];
}

const IN = (place?: string) => (place ? ` in ${place}` : " near you");

export const CATEGORY_COPY: Record<string, CategoryCopy> = {
  "horse-boarding": {
    intro: (place) =>
      `Compare horse boarding stables and barns${IN(place)} — full board, partial board, pasture and self-care options. Check stall counts, turnout, arenas, and real reviews from horse owners before you visit.`,
    faqs: [
      {
        q: "How much does horse boarding cost?",
        a: "Boarding rates vary widely by region and services: pasture board often runs $150–$400/month, while full-care stall board at facilities with arenas and daily turnout commonly runs $400–$1,200+/month. Listings that publish pricing show a starting rate on their profile.",
      },
      {
        q: "What's the difference between full board, partial board, and self-care?",
        a: "Full board covers stall or pasture, feed, hay, and daily care. Partial board splits chores or feed costs between you and the barn. Self-care means the barn provides the space and you handle feeding, mucking, and turnout yourself.",
      },
      {
        q: "What should I look for when visiting a boarding barn?",
        a: "Look at hay quality and water buckets, turnout space and herd sizes, stall condition, arena footing, tack room security, and how calm the horses seem. Ask about feeding schedules, vet/farrier policies, and contract terms.",
      },
      {
        q: "Do barns have waiting lists?",
        a: "Good barns often do. Listings with a “Spots available” badge have told us they currently have openings — filter for availability on the map to save calls.",
      },
    ],
  },
  "training-facilities": {
    intro: (place) =>
      `Find horse training facilities${IN(place)} — colt starting, problem-horse work, tune-ups, and full training programs across disciplines. Compare programs, read reviews, and contact barns directly.`,
    faqs: [
      {
        q: "How much does horse training cost?",
        a: "Full training (5–6 sessions a week with board included) commonly runs $800–$2,500+/month depending on discipline and the trainer's record. Tune-ups and partial programs cost less.",
      },
      {
        q: "How long does it take to start a horse under saddle?",
        a: "Most reputable trainers quote 60–120 days for a solid foundation, but the timeline depends on the horse's age, temperament, and prior handling. Be wary of promises to fix everything in 30 days.",
      },
      {
        q: "Should I choose a trainer by discipline?",
        a: "Yes — a reining trainer and a hunter/jumper trainer build very different foundations. Filter by discipline on each listing and watch a training session before committing.",
      },
    ],
  },
  "trainer-instructor": {
    intro: (place) =>
      `Browse riding instructors and horse trainers${IN(place)} for lessons, coaching, and horse training across English and Western disciplines — beginners through competitive riders.`,
    faqs: [
      {
        q: "How much do riding lessons cost?",
        a: "Group lessons typically run $40–$75, private lessons $60–$150+ per hour depending on the instructor's credentials and region. Many barns discount lesson packages.",
      },
      {
        q: "What age can kids start riding lessons?",
        a: "Many programs start structured lessons around age 6–8; some offer led pony sessions earlier. Look for programs with appropriately sized school horses and certified instructors.",
      },
      {
        q: "What certifications should I look for in an instructor?",
        a: "In the US, common credentials include CHA and PATH Intl. (adaptive riding), plus discipline associations like USDF or USHJA programs. Experience, safety record, and how their students ride matter just as much.",
      },
    ],
  },
  "equine-veterinarian": {
    intro: (place) =>
      `Find equine and large-animal veterinarians${IN(place)} — ambulatory farm calls, lameness workups, dentistry, reproduction, and emergency care for horses.`,
    faqs: [
      {
        q: "How much does an equine vet visit cost?",
        a: "A routine farm call plus exam commonly runs $75–$200 before treatments; emergency and after-hours calls cost more. Annual spring shots and Coggins typically add $100–$300.",
      },
      {
        q: "How often does my horse need a vet?",
        a: "Healthy adult horses need at least an annual wellness exam with core vaccines and a Coggins test; most owners schedule twice-yearly visits, plus dental floating every 6–12 months.",
      },
      {
        q: "What counts as a horse emergency?",
        a: "Colic signs, uncontrolled bleeding, eye injuries, non-weight-bearing lameness, choke, and foaling trouble all warrant an immediate call. Know your vet's after-hours protocol before you need it.",
      },
    ],
  },
  farrier: {
    intro: (place) =>
      `Compare farriers${IN(place)} for trimming, shoeing, and corrective work. Regular hoof care every 4–8 weeks is the foundation of a sound horse — find a professional who shows up on schedule.`,
    faqs: [
      {
        q: "How much does a farrier cost?",
        a: "A barefoot trim commonly runs $40–$75; standard front shoes $80–$150; four shoes $110–$250+. Corrective or therapeutic work costs more depending on materials and complexity.",
      },
      {
        q: "How often should my horse see the farrier?",
        a: "Most horses need attention every 4–8 weeks — faster-growing feet, shod horses, and horses in work sit at the shorter end. Long gaps cause flares, cracks, and soreness.",
      },
      {
        q: "Does my horse need shoes?",
        a: "Many horses do well barefoot with a good trim cycle and appropriate workload. Shoes help when workload, terrain, conformation, or therapeutic needs demand extra protection or support — ask your farrier and vet together.",
      },
    ],
  },
  "tack-shop": {
    intro: (place) =>
      `Shop local tack stores${IN(place)} for saddles, bridles, bits, blankets, and riding apparel — English and Western. Local shops mean you can try before you buy and get proper fitting help.`,
    faqs: [
      {
        q: "Why buy from a local tack shop instead of online?",
        a: "Saddle and bit fit are hard to get right sight-unseen. Local shops let you try equipment on your horse, handle leather quality in person, and many offer trial periods and consignment.",
      },
      {
        q: "Do tack shops buy or consign used tack?",
        a: "Many do — consignment is a great way to move outgrown saddles and find quality used gear. Call ahead to ask about their consignment terms and what brands they accept.",
      },
    ],
  },
  "feed-forage": {
    intro: (place) =>
      `Find feed and forage suppliers${IN(place)} — hay, grain, supplements, shavings, and farm supplies. Compare local feed stores and hay dealers to keep your barn stocked.`,
    faqs: [
      {
        q: "How much hay does a horse eat?",
        a: "A typical 1,000 lb horse eats 15–25 lbs of forage daily — roughly half a small square bale, or 2%+ of body weight. Plan storage for at least a few weeks' supply.",
      },
      {
        q: "Do feed stores deliver?",
        a: "Many local feed stores and hay suppliers deliver by the ton or pallet, often with a minimum order. Check each listing's details or call to ask about delivery radius and rates.",
      },
    ],
  },
};

/** Copy for a category slug, or null when we have none (hidden categories). */
export function categoryCopy(slug: string): CategoryCopy | null {
  return CATEGORY_COPY[slug] ?? null;
}
