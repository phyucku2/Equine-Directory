// Florida location hierarchy: US → FL → all 67 counties → key cities.
// Coordinates are approximate county-seat / city centroids (good enough for
// location hubs and radius search; refined per-listing on geocode).

export interface CountySeed {
  name: string;
  slug: string;
  fips: string; // 3-digit county FIPS
  lat: number;
  lng: number;
}

export interface CitySeed {
  name: string;
  slug: string;
  countyFips: string;
  lat: number;
  lng: number;
}

export const FLORIDA = { name: "Florida", slug: "florida", code: "FL", lat: 27.994, lng: -81.760 };

export const COUNTIES: CountySeed[] = [
  { name: "Alachua County", slug: "alachua", fips: "001", lat: 29.6516, lng: -82.3248 },
  { name: "Baker County", slug: "baker", fips: "003", lat: 30.3308, lng: -82.2845 },
  { name: "Bay County", slug: "bay", fips: "005", lat: 30.2766, lng: -85.6602 },
  { name: "Bradford County", slug: "bradford", fips: "007", lat: 29.9447, lng: -82.1693 },
  { name: "Brevard County", slug: "brevard", fips: "009", lat: 28.2639, lng: -80.7214 },
  { name: "Broward County", slug: "broward", fips: "011", lat: 26.1224, lng: -80.1373 },
  { name: "Calhoun County", slug: "calhoun", fips: "013", lat: 30.4063, lng: -85.1894 },
  { name: "Charlotte County", slug: "charlotte", fips: "015", lat: 26.9342, lng: -82.0454 },
  { name: "Citrus County", slug: "citrus", fips: "017", lat: 28.8862, lng: -82.4596 },
  { name: "Clay County", slug: "clay", fips: "019", lat: 29.9836, lng: -81.8580 },
  { name: "Collier County", slug: "collier", fips: "021", lat: 26.1420, lng: -81.7948 },
  { name: "Columbia County", slug: "columbia", fips: "023", lat: 30.1897, lng: -82.6393 },
  { name: "DeSoto County", slug: "desoto", fips: "027", lat: 27.1875, lng: -81.8093 },
  { name: "Dixie County", slug: "dixie", fips: "029", lat: 29.5816, lng: -83.1574 },
  { name: "Duval County", slug: "duval", fips: "031", lat: 30.3322, lng: -81.6557 },
  { name: "Escambia County", slug: "escambia", fips: "033", lat: 30.4213, lng: -87.2169 },
  { name: "Flagler County", slug: "flagler", fips: "035", lat: 29.4691, lng: -81.2587 },
  { name: "Franklin County", slug: "franklin", fips: "037", lat: 29.8108, lng: -84.8665 },
  { name: "Gadsden County", slug: "gadsden", fips: "039", lat: 30.5793, lng: -84.6132 },
  { name: "Gilchrist County", slug: "gilchrist", fips: "041", lat: 29.7269, lng: -82.8001 },
  { name: "Glades County", slug: "glades", fips: "043", lat: 26.9559, lng: -81.1834 },
  { name: "Gulf County", slug: "gulf", fips: "045", lat: 29.9100, lng: -85.2532 },
  { name: "Hamilton County", slug: "hamilton", fips: "047", lat: 30.4938, lng: -82.9479 },
  { name: "Hardee County", slug: "hardee", fips: "049", lat: 27.4922, lng: -81.8093 },
  { name: "Hendry County", slug: "hendry", fips: "051", lat: 26.5535, lng: -81.1700 },
  { name: "Hernando County", slug: "hernando", fips: "053", lat: 28.5544, lng: -82.4690 },
  { name: "Highlands County", slug: "highlands", fips: "055", lat: 27.3441, lng: -81.3409 },
  { name: "Hillsborough County", slug: "hillsborough", fips: "057", lat: 27.9904, lng: -82.3018 },
  { name: "Holmes County", slug: "holmes", fips: "059", lat: 30.8674, lng: -85.8166 },
  { name: "Indian River County", slug: "indian-river", fips: "061", lat: 27.6964, lng: -80.5740 },
  { name: "Jackson County", slug: "jackson", fips: "063", lat: 30.7919, lng: -85.2158 },
  { name: "Jefferson County", slug: "jefferson", fips: "065", lat: 30.4180, lng: -83.8916 },
  { name: "Lafayette County", slug: "lafayette", fips: "067", lat: 30.0297, lng: -83.1815 },
  { name: "Lake County", slug: "lake", fips: "069", lat: 28.7611, lng: -81.7178 },
  { name: "Lee County", slug: "lee", fips: "071", lat: 26.6630, lng: -81.8723 },
  { name: "Leon County", slug: "leon", fips: "073", lat: 30.4583, lng: -84.2766 },
  { name: "Levy County", slug: "levy", fips: "075", lat: 29.2789, lng: -82.7868 },
  { name: "Liberty County", slug: "liberty", fips: "077", lat: 30.2416, lng: -84.8810 },
  { name: "Madison County", slug: "madison", fips: "079", lat: 30.4439, lng: -83.4690 },
  { name: "Manatee County", slug: "manatee", fips: "081", lat: 27.4799, lng: -82.3452 },
  { name: "Marion County", slug: "marion", fips: "083", lat: 29.2106, lng: -82.0584 },
  { name: "Martin County", slug: "martin", fips: "085", lat: 27.0807, lng: -80.3370 },
  { name: "Miami-Dade County", slug: "miami-dade", fips: "086", lat: 25.7617, lng: -80.1918 },
  { name: "Monroe County", slug: "monroe", fips: "087", lat: 24.5551, lng: -81.7800 },
  { name: "Nassau County", slug: "nassau", fips: "089", lat: 30.6107, lng: -81.7787 },
  { name: "Okaloosa County", slug: "okaloosa", fips: "091", lat: 30.6695, lng: -86.5916 },
  { name: "Okeechobee County", slug: "okeechobee", fips: "093", lat: 27.2439, lng: -80.8298 },
  { name: "Orange County", slug: "orange", fips: "095", lat: 28.5384, lng: -81.3789 },
  { name: "Osceola County", slug: "osceola", fips: "097", lat: 28.2920, lng: -81.4076 },
  { name: "Palm Beach County", slug: "palm-beach", fips: "099", lat: 26.7056, lng: -80.0364 },
  { name: "Pasco County", slug: "pasco", fips: "101", lat: 28.3232, lng: -82.4319 },
  { name: "Pinellas County", slug: "pinellas", fips: "103", lat: 27.8764, lng: -82.7779 },
  { name: "Polk County", slug: "polk", fips: "105", lat: 27.8947, lng: -81.6889 },
  { name: "Putnam County", slug: "putnam", fips: "107", lat: 29.6094, lng: -81.7787 },
  { name: "St. Johns County", slug: "st-johns", fips: "109", lat: 29.9012, lng: -81.3124 },
  { name: "St. Lucie County", slug: "st-lucie", fips: "111", lat: 27.3364, lng: -80.4343 },
  { name: "Santa Rosa County", slug: "santa-rosa", fips: "113", lat: 30.7741, lng: -86.9824 },
  { name: "Sarasota County", slug: "sarasota", fips: "115", lat: 27.2364, lng: -82.3265 },
  { name: "Seminole County", slug: "seminole", fips: "117", lat: 28.7092, lng: -81.2085 },
  { name: "Sumter County", slug: "sumter", fips: "119", lat: 28.7055, lng: -82.0884 },
  { name: "Suwannee County", slug: "suwannee", fips: "121", lat: 30.1944, lng: -82.9912 },
  { name: "Taylor County", slug: "taylor", fips: "123", lat: 30.0594, lng: -83.6132 },
  { name: "Union County", slug: "union", fips: "125", lat: 30.0411, lng: -82.3690 },
  { name: "Volusia County", slug: "volusia", fips: "127", lat: 29.0280, lng: -81.0755 },
  { name: "Wakulla County", slug: "wakulla", fips: "129", lat: 30.1466, lng: -84.3766 },
  { name: "Walton County", slug: "walton", fips: "131", lat: 30.6390, lng: -86.1158 },
  { name: "Washington County", slug: "washington", fips: "133", lat: 30.6105, lng: -85.6602 },
];

// Key cities, weighted toward equine hubs (Ocala/Marion, Wellington/Palm Beach)
// plus major metros for coverage.
export const CITIES: CitySeed[] = [
  // Marion — "Horse Capital of the World"
  { name: "Ocala", slug: "ocala", countyFips: "083", lat: 29.1872, lng: -82.1401 },
  { name: "Reddick", slug: "reddick", countyFips: "083", lat: 29.3669, lng: -82.1973 },
  { name: "Citra", slug: "citra", countyFips: "083", lat: 29.4097, lng: -82.1098 },
  { name: "Anthony", slug: "anthony", countyFips: "083", lat: 29.2966, lng: -82.1098 },
  { name: "Belleview", slug: "belleview", countyFips: "083", lat: 29.0552, lng: -82.0548 },
  // Palm Beach — Wellington circuit
  { name: "Wellington", slug: "wellington", countyFips: "099", lat: 26.6618, lng: -80.2683 },
  { name: "West Palm Beach", slug: "west-palm-beach", countyFips: "099", lat: 26.7153, lng: -80.0534 },
  { name: "Loxahatchee", slug: "loxahatchee", countyFips: "099", lat: 26.6837, lng: -80.2670 },
  // Other metros / equine areas
  { name: "Tampa", slug: "tampa", countyFips: "057", lat: 27.9506, lng: -82.4572 },
  { name: "Brandon", slug: "brandon", countyFips: "057", lat: 27.9378, lng: -82.2859 },
  { name: "Sarasota", slug: "sarasota", countyFips: "115", lat: 27.3364, lng: -82.5307 },
  { name: "Venice", slug: "venice", countyFips: "115", lat: 27.0998, lng: -82.4543 },
  { name: "Gainesville", slug: "gainesville", countyFips: "001", lat: 29.6516, lng: -82.3248 },
  { name: "Jacksonville", slug: "jacksonville", countyFips: "031", lat: 30.3322, lng: -81.6557 },
  { name: "Orlando", slug: "orlando", countyFips: "095", lat: 28.5384, lng: -81.3789 },
  { name: "Ocoee", slug: "ocoee", countyFips: "095", lat: 28.5692, lng: -81.5440 },
  { name: "Tallahassee", slug: "tallahassee", countyFips: "073", lat: 30.4383, lng: -84.2807 },
  { name: "Naples", slug: "naples", countyFips: "021", lat: 26.1420, lng: -81.7948 },
  { name: "Fort Myers", slug: "fort-myers", countyFips: "071", lat: 26.6406, lng: -81.8723 },
  { name: "Bradenton", slug: "bradenton", countyFips: "081", lat: 27.4989, lng: -82.5748 },
  { name: "Lakeland", slug: "lakeland", countyFips: "105", lat: 28.0395, lng: -81.9498 },
  { name: "Clermont", slug: "clermont", countyFips: "069", lat: 28.5494, lng: -81.7729 },
  { name: "Umatilla", slug: "umatilla", countyFips: "069", lat: 28.9292, lng: -81.6651 },
  { name: "Brooksville", slug: "brooksville", countyFips: "053", lat: 28.5553, lng: -82.3879 },
  { name: "Vero Beach", slug: "vero-beach", countyFips: "061", lat: 27.6386, lng: -80.3973 },
  { name: "Okeechobee", slug: "okeechobee", countyFips: "093", lat: 27.2439, lng: -80.8298 },
  { name: "Williston", slug: "williston", countyFips: "075", lat: 29.3872, lng: -82.4465 },
  { name: "Newberry", slug: "newberry", countyFips: "001", lat: 29.6461, lng: -82.6068 },
  { name: "Dade City", slug: "dade-city", countyFips: "101", lat: 28.3649, lng: -82.1959 },
  { name: "Myakka City", slug: "myakka-city", countyFips: "081", lat: 27.3550, lng: -82.1709 },
  // Broward — South Florida equestrian belt (Davie & neighbors)
  { name: "Davie", slug: "davie", countyFips: "011", lat: 26.0765, lng: -80.2521 },
  { name: "Southwest Ranches", slug: "southwest-ranches", countyFips: "011", lat: 26.0570, lng: -80.3270 },
  { name: "Cooper City", slug: "cooper-city", countyFips: "011", lat: 26.0570, lng: -80.2717 },
  { name: "Parkland", slug: "parkland", countyFips: "011", lat: 26.3104, lng: -80.2370 },
];
