// Long-tail SEO guides (Goal 5 / T44 "guides/blog scaffolding"). Static,
// evergreen editorial content rendered at /guides/[slug] with Article JSON-LD.
// Keep answers practical and honest — these pages earn trust AND rankings.

export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  datePublished: string; // ISO date
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "how-to-choose-a-boarding-barn",
    title: "How to Choose a Boarding Barn: A Horse Owner's Checklist",
    description:
      "What to look for when touring boarding stables — care standards, turnout, contracts, and the red flags experienced owners never ignore.",
    datePublished: "2026-07-03",
    sections: [
      {
        heading: "Start with the horses, not the barn aisle",
        paragraphs: [
          "A freshly painted barn tells you about the owner's budget; the horses tell you about the care. On your tour, look at body condition, hooves, and water buckets. Calm, well-fleshed horses with trimmed feet and clean water are the single best signal a barn is run right.",
          "Visit at feeding time if you can. Watch whether hay is plentiful and whether the crew knows each horse by name and quirk.",
        ],
      },
      {
        heading: "Turnout is the deal-breaker",
        paragraphs: [
          "Horses are built to move 10+ hours a day. Ask exactly how many hours of turnout your horse gets, in what size paddock, and with how many other horses. \"Daily turnout\" can mean 30 minutes in a round pen — get specifics, and match them to your horse's needs.",
        ],
      },
      {
        heading: "Read the contract like it matters — because it does",
        paragraphs: [
          "A good boarding contract spells out feed and hay amounts, blanketing and holding fees, vet/farrier policy, emergency authorization, liability, and notice periods. A barn with no contract is a barn where every dispute becomes personal.",
          "Ask how rate increases are handled and what happens if your horse needs stall rest or special feeding.",
        ],
      },
      {
        heading: "The questions that separate good barns from great ones",
        paragraphs: [
          "Who is on the property overnight? How do you handle colic at 2 a.m. if I can't be reached? Which farrier and vet do most boarders use? How long has your longest boarder been here? Long-tenured boarders are the strongest endorsement a barn can have.",
        ],
      },
      {
        heading: "Use the directory to shortlist, then trust your visit",
        paragraphs: [
          "Filter stables near you by board type, turnout, arenas, and verified reviews — then visit your top two or three. No listing replaces standing in the barn aisle, but a good shortlist saves weekends of dead-end tours.",
        ],
      },
    ],
  },
  {
    slug: "horse-boarding-costs-explained",
    title: "Horse Boarding Costs Explained: What You'll Really Pay",
    description:
      "Full board vs partial vs pasture: typical price ranges, what's included, and the add-on fees that surprise first-time horse owners.",
    datePublished: "2026-07-03",
    sections: [
      {
        heading: "The three basic boarding tiers",
        paragraphs: [
          "Pasture board (roughly $150–$400/month in most regions) covers group turnout with shelter, hay, and a shared water source. Partial board ($250–$600) adds a stall and splits labor or feed costs. Full board ($400–$1,200+) covers stall, feed, hay, turnout, and daily care — you just show up and ride.",
          "Metro areas, show barns, and facilities with indoor arenas run well above these ranges; rural pasture setups run below.",
        ],
      },
      {
        heading: "What full board actually includes — and what it doesn't",
        paragraphs: [
          "Standard full board covers feeding, stall cleaning, turnout, and basic monitoring. It usually does NOT cover blanketing changes, holding for the vet or farrier, medications, extra feedings, or supplements — each of those is commonly a $5–$30 line item or an hourly fee.",
        ],
      },
      {
        heading: "The hidden costs to budget for",
        paragraphs: [
          "Beyond board: farrier every 4–8 weeks ($40–$250), annual vet care ($300–$800 in a normal year), dentistry ($100–$300), deworming, and insurance if you carry it. A realistic all-in budget for a full-board horse is typically $700–$1,800/month depending on region.",
        ],
      },
      {
        heading: "How to compare barns fairly",
        paragraphs: [
          "Two $600 barns are rarely the same product. Normalize by what's included: hay quantity and quality, grain program, turnout hours, arena access, and care add-ons. A $700 barn that includes blanketing, holding, and unlimited quality hay often beats a $550 barn that nickel-and-dimes.",
          "Listings on the directory show starting prices and facility details where owners have published them — use the price filter as a starting point, not the whole answer.",
        ],
      },
    ],
  },
  {
    slug: "summer-horse-camps-guide",
    title: "Finding a Great Summer Horse Camp: A Parent's Guide",
    description:
      "How to evaluate summer horseback riding camps — safety, instructor quality, horse welfare, and the questions to ask before you book.",
    datePublished: "2026-07-03",
    sections: [
      {
        heading: "Day camp or overnight?",
        paragraphs: [
          "Day camps (typically $250–$600/week) suit first-time riders and younger kids; overnight camps ($800–$2,500+/week) suit confident kids ready for full immersion. For a first summer, a week of day camp at a local lesson barn is the low-risk way to find out if the horse bug is real.",
        ],
      },
      {
        heading: "Safety signals to check before booking",
        paragraphs: [
          "Helmets on every mounted rider, no exceptions. Certified or demonstrably experienced instructors, small mounted groups (6 or fewer per instructor for beginners), and school horses that look relaxed and well-fed. Ask about their emergency plan and how they match kids to horses.",
        ],
      },
      {
        heading: "What a good camp day looks like",
        paragraphs: [
          "The best camps mix riding with horsemanship: grooming, tacking, feeding, barn chores, and unmounted learning. If the brochure promises hours in the saddle every day for total beginners, quality instruction is unlikely — beginner riders build seat and safety in shorter, focused sessions.",
        ],
      },
      {
        heading: "Booking timeline and questions to ask",
        paragraphs: [
          "Popular camps fill by early spring. Ask: What's the rider-to-instructor ratio? What happens on rain days? Is there a waitlist or sibling discount? Can my child ride the same horse all week? What should we NOT bring?",
          "Browse upcoming camps on our events calendar — barns list dates, prices, and registration links, and you can check the hosting stable's reviews on the same page.",
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}
