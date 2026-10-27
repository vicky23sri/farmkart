/**
 * FarmKart Product & Seller Data
 * 25 realistic agricultural products, sellers, and customer reviews representing Tamil Nadu farming regions.
 */

export type ProductUnit =
  | 'kg'
  | 'quintal'
  | 'ton'
  | 'bundle'
  | 'bag'
  | 'tractor load'
  | 'truck load';

export type ProductCategory =
  | 'vegetables'
  | 'fruits'
  | 'grains'
  | 'millets'
  | 'pulses'
  | 'spices'
  | 'dairy'
  | 'manure'
  | 'fodder'
  | 'seeds'
  | 'tools';

export type DeliveryVehicleType =
  | 'two_wheeler'
  | 'auto_rickshaw'
  | 'mini_truck'
  | 'tractor'
  | 'heavy_truck';

export interface Product {
  id: string;
  name: string;
  nameTamil: string;
  category: ProductCategory;
  price: number;
  unit: ProductUnit;
  stock: number;
  minOrder: number;
  isOrganic: boolean;
  harvestDate: string;
  sellerId: string;
  sellerName: string;
  village: string;
  lat: number;
  lng: number;
  images: string[];
  rating: number;
  reviewCount: number;
  description: string;
  vehicleType: DeliveryVehicleType | string;
}

export interface Seller {
  id: string;
  name: string;
  farmName: string;
  phone: string;
  village: string;
  district: string;
  lat: number;
  lng: number;
  isVerified: boolean;
  rating: number;
  totalOrders: number;
  mandiLicenseNo?: string;
}

export interface Review {
  id: string;
  productId: string;
  buyerName: string;
  rating: number;
  date: string;
  comment: string;
}

// ---------------------------------------------------------------------------
// Sample Sellers (Tamil Nadu Farming Districts)
// ---------------------------------------------------------------------------
export const SELLERS: Seller[] = [
  {
    id: 'seller-1',
    name: 'Ramasamy Gounder',
    farmName: 'Vadipatti Iyarkai Pannai',
    phone: '+91 98421 56780',
    village: 'Vadipatti',
    district: 'Madurai',
    lat: 10.0558,
    lng: 77.9622,
    isVerified: true,
    rating: 4.9,
    totalOrders: 312,
    mandiLicenseNo: 'TN-MDU-2024-089',
  },
  {
    id: 'seller-2',
    name: 'Murugesan Chettiar',
    farmName: 'Cauvery Delta Paddy Farms',
    phone: '+91 94431 89012',
    village: 'Thiruvaiyaru',
    district: 'Thanjavur',
    lat: 10.8803,
    lng: 79.1039,
    isVerified: true,
    rating: 4.8,
    totalOrders: 540,
    mandiLicenseNo: 'TN-TNJ-2023-412',
  },
  {
    id: 'seller-3',
    name: 'Selvam Muthuvel',
    farmName: 'Oddanchatram Vegetable Collective',
    phone: '+91 97880 23451',
    village: 'Oddanchatram',
    district: 'Dindigul',
    lat: 10.4851,
    lng: 77.7472,
    isVerified: true,
    rating: 4.7,
    totalOrders: 420,
    mandiLicenseNo: 'TN-DGL-2024-119',
  },
  {
    id: 'seller-4',
    name: 'Sundarrajan Palanisamy',
    farmName: 'Kongu Organic Cattle & Dairy',
    phone: '+91 98942 67890',
    village: 'Pollachi',
    district: 'Coimbatore',
    lat: 10.6609,
    lng: 77.0048,
    isVerified: true,
    rating: 4.9,
    totalOrders: 275,
    mandiLicenseNo: 'TN-CBE-2023-772',
  },
  {
    id: 'seller-5',
    name: 'Kandasamy Natarajan',
    farmName: 'Bhavani Organic Spices & Turmeric',
    phone: '+91 94422 34567',
    village: 'Bhavani',
    district: 'Erode',
    lat: 11.45,
    lng: 77.6833,
    isVerified: true,
    rating: 4.8,
    totalOrders: 198,
    mandiLicenseNo: 'TN-ERD-2024-301',
  },
];

// ---------------------------------------------------------------------------
// 25 Realistic Tamil Nadu Products
// ---------------------------------------------------------------------------
export const PRODUCTS: Product[] = [
  // 1. Ponni Nellu (Paddy)
  {
    id: 'prod-01',
    name: 'BAP Ponni Nellu (Paddy)',
    nameTamil: 'பொன்னி நெல் (நேரடி அறுவடை)',
    category: 'grains',
    price: 2450,
    unit: 'quintal',
    stock: 80,
    minOrder: 1,
    isOrganic: false,
    harvestDate: '2026-10-22',
    sellerId: 'seller-2',
    sellerName: 'Murugesan Chettiar',
    village: 'Thiruvaiyaru',
    lat: 10.8803,
    lng: 79.1039,
    images: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600'],
    rating: 4.8,
    reviewCount: 94,
    description:
      'First-grade Cauvery delta single-source Ponni paddy. Low moisture content (<12%), freshly harvested and threshed in Thiruvaiyaru fields. Best for long-term rice stocking and family consumption.',
    vehicleType: 'tractor',
  },

  // 2. Seeraga Samba Nellu
  {
    id: 'prod-02',
    name: 'Traditional Seeraga Samba Nellu',
    nameTamil: 'சீரக சம்பா நெல் (பாரம்பரிய பிரியாணி நெல்)',
    category: 'grains',
    price: 4200,
    unit: 'quintal',
    stock: 35,
    minOrder: 1,
    isOrganic: true,
    harvestDate: '2026-10-18',
    sellerId: 'seller-1',
    sellerName: 'Ramasamy Gounder',
    village: 'Vadipatti',
    lat: 10.0558,
    lng: 77.9622,
    images: ['https://images.unsplash.com/photo-1599813958933-5c777a06487e?w=600'],
    rating: 4.9,
    reviewCount: 68,
    description:
      'Aromatic heirloom Seeraga Samba paddy cultivated using traditional Jeevamrutham without synthetic urea. Famous for authentic Dindigul & Ambur biryanis with a rich, natural fragrance.',
    vehicleType: 'mini_truck',
  },

  // 3. Mappillai Samba Nellu
  {
    id: 'prod-03',
    name: 'Heritage Mappillai Samba Red Rice',
    nameTamil: 'மாப்பிள்ளை சம்பா நெல் (சிவப்பு அரிசி)',
    category: 'grains',
    price: 3800,
    unit: 'quintal',
    stock: 25,
    minOrder: 1,
    isOrganic: true,
    harvestDate: '2026-10-15',
    sellerId: 'seller-2',
    sellerName: 'Murugesan Chettiar',
    village: 'Thiruvaiyaru',
    lat: 10.8803,
    lng: 79.1039,
    images: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600'],
    rating: 4.9,
    reviewCount: 42,
    description:
      'Nutrient-dense ancient Tamil red rice variety known for stamina, iron, and fiber. Cultivated strictly on organic wetlands with zero synthetic fertilizers.',
    vehicleType: 'mini_truck',
  },

  // 4. Kezhvaragu / Ragi
  {
    id: 'prod-04',
    name: 'Kezhvaragu / Finger Millet (Ragi)',
    nameTamil: 'நாட்டு கேழ்வரகு (ராகி)',
    category: 'millets',
    price: 42,
    unit: 'kg',
    stock: 650,
    minOrder: 5,
    isOrganic: true,
    harvestDate: '2026-10-20',
    sellerId: 'seller-1',
    sellerName: 'Ramasamy Gounder',
    village: 'Vadipatti',
    lat: 10.0558,
    lng: 77.9622,
    images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600'],
    rating: 4.7,
    reviewCount: 53,
    description:
      'High-calcium organic dryland ragi. Stone-cleaned and sorted. Perfect for making traditional Koozh, Ragi Kali, idiyappam, and healthy infant porridge.',
    vehicleType: 'auto_rickshaw',
  },

  // 5. Cholam (Sorghum)
  {
    id: 'prod-05',
    name: 'Vellai Cholam (White Sorghum)',
    nameTamil: 'நாட்டு வெள்ளை சோளம்',
    category: 'millets',
    price: 38,
    unit: 'kg',
    stock: 800,
    minOrder: 10,
    isOrganic: false,
    harvestDate: '2026-10-19',
    sellerId: 'seller-4',
    sellerName: 'Sundarrajan Palanisamy',
    village: 'Pollachi',
    lat: 10.6609,
    lng: 77.0048,
    images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600'],
    rating: 4.6,
    reviewCount: 31,
    description:
      'Locally grown sun-dried white cholam grains. High in dietary fiber and gluten-free. Suitable for roti flour and poultry farm feeds.',
    vehicleType: 'mini_truck',
  },

  // 6. Kambu (Pearl Millet)
  {
    id: 'prod-06',
    name: 'Nattu Kambu (Pearl Millet / Bajra)',
    nameTamil: 'பச்சை நாட்டு கம்பு',
    category: 'millets',
    price: 36,
    unit: 'kg',
    stock: 500,
    minOrder: 5,
    isOrganic: true,
    harvestDate: '2026-10-21',
    sellerId: 'seller-3',
    sellerName: 'Selvam Muthuvel',
    village: 'Oddanchatram',
    lat: 10.4851,
    lng: 77.7472,
    images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600'],
    rating: 4.8,
    reviewCount: 46,
    description:
      'Nutritious pearl millet harvest. Rich in iron, phosphorus, and slow-burning energy. Best for authentic street-style Kamban Koozh.',
    vehicleType: 'auto_rickshaw',
  },

  // 7. Nattu Thakkali (Country Tomatoes)
  {
    id: 'prod-07',
    name: 'Nattu Thakkali (Country Tomatoes)',
    nameTamil: 'நாட்டு தக்காளி (புளிப்பு சுவை)',
    category: 'vegetables',
    price: 32,
    unit: 'kg',
    stock: 450,
    minOrder: 2,
    isOrganic: true,
    harvestDate: '2026-10-25',
    sellerId: 'seller-3',
    sellerName: 'Selvam Muthuvel',
    village: 'Oddanchatram',
    lat: 10.4851,
    lng: 77.7472,
    images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600'],
    rating: 4.9,
    reviewCount: 128,
    description:
      'Naturally vine-ripened indigenous country tomatoes with a vibrant tang and juiciness. Ideal for traditional rasam, sambar, and thakkali thokku.',
    vehicleType: 'auto_rickshaw',
  },

  // 8. Chinna Vengayam (Small Onions / Shallots)
  {
    id: 'prod-08',
    name: 'Chinna Vengayam (Small Shallots)',
    nameTamil: 'சின்ன வெங்காயம் (மணப்பாறை / பெரம்பலூர்)',
    category: 'vegetables',
    price: 48,
    unit: 'kg',
    stock: 320,
    minOrder: 2,
    isOrganic: false,
    harvestDate: '2026-10-23',
    sellerId: 'seller-3',
    sellerName: 'Selvam Muthuvel',
    village: 'Oddanchatram',
    lat: 10.4851,
    lng: 77.7472,
    images: ['https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600'],
    rating: 4.8,
    reviewCount: 89,
    description:
      'Freshly harvested Tamil small pink shallots with pungent flavor and high essential oils. Essential for South Indian sambar and immunity-boosting rasam.',
    vehicleType: 'two_wheeler',
  },

  // 9. Pachai Milagai (Green Chillies)
  {
    id: 'prod-09',
    name: 'Nattu Pachai Milagai (G4 Spicy Chillies)',
    nameTamil: 'நாட்டு கார பச்சை மிளகாய்',
    category: 'vegetables',
    price: 45,
    unit: 'kg',
    stock: 150,
    minOrder: 1,
    isOrganic: true,
    harvestDate: '2026-10-24',
    sellerId: 'seller-1',
    sellerName: 'Ramasamy Gounder',
    village: 'Vadipatti',
    lat: 10.0558,
    lng: 77.9622,
    images: ['https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=600'],
    rating: 4.7,
    reviewCount: 38,
    description:
      'Fiery green chillies hand-picked fresh in the early morning dew. Zero cold storage treatment.',
    vehicleType: 'two_wheeler',
  },

  // 10. Vazhaithandu & Poovan Vazhaipazham
  {
    id: 'prod-10',
    name: 'Tiruchi Poovan Banana Bunch',
    nameTamil: 'திருச்சி பூவன் வாழைத்தார்',
    category: 'fruits',
    price: 320,
    unit: 'bundle',
    stock: 40,
    minOrder: 1,
    isOrganic: true,
    harvestDate: '2026-10-24',
    sellerId: 'seller-2',
    sellerName: 'Murugesan Chettiar',
    village: 'Thiruvaiyaru',
    lat: 10.8803,
    lng: 79.1039,
    images: ['https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600'],
    rating: 4.9,
    reviewCount: 52,
    description:
      'Complete raw banana bunch (approx 12-14 dozen) naturally ripened using smoke leaf method without carbide chemicals. Sweet and digestive.',
    vehicleType: 'auto_rickshaw',
  },

  // 11. Sembaruthi Kilo Koyya (Guava)
  {
    id: 'prod-11',
    name: 'Ayakudi Sembaruthi Kilo Guava',
    nameTamil: 'அயக்குடி கிலோ கொய்யா',
    category: 'fruits',
    price: 40,
    unit: 'kg',
    stock: 220,
    minOrder: 3,
    isOrganic: true,
    harvestDate: '2026-10-25',
    sellerId: 'seller-3',
    sellerName: 'Selvam Muthuvel',
    village: 'Oddanchatram',
    lat: 10.4851,
    lng: 77.7472,
    images: ['https://images.unsplash.com/photo-1536511135773-8cb4948d3e2d?w=600'],
    rating: 4.8,
    reviewCount: 61,
    description:
      'Crisp, juicy large white-fleshed Ayakudi guavas rich in Vitamin C. Hand-harvested tree-fresh fruit without toxic waxing.',
    vehicleType: 'two_wheeler',
  },

  // 12. Sengarumbu (Sugarcane)
  {
    id: 'prod-12',
    name: 'Fresh Farm Sengarumbu (Sugarcane)',
    nameTamil: 'பண்ணை செங்கரும்பு கட்டு',
    category: 'fruits',
    price: 250,
    unit: 'bundle',
    stock: 60,
    minOrder: 1,
    isOrganic: false,
    harvestDate: '2026-10-21',
    sellerId: 'seller-2',
    sellerName: 'Murugesan Chettiar',
    village: 'Thiruvaiyaru',
    lat: 10.8803,
    lng: 79.1039,
    images: ['https://images.unsplash.com/photo-1589648751789-c8cfb70505d9?w=600'],
    rating: 4.6,
    reviewCount: 22,
    description:
      'Sweet and thick stalks of red sugarcane bundle (10 whole stalks). High sucrose content, ideal for direct juice extraction or festival use.',
    vehicleType: 'tractor',
  },

  // 13. Pachai Payaru (Green Gram)
  {
    id: 'prod-13',
    name: 'Nattu Pachai Payaru (Whole Moong Dal)',
    nameTamil: 'நாட்டு முழு பச்சை பயறு',
    category: 'pulses',
    price: 110,
    unit: 'kg',
    stock: 400,
    minOrder: 2,
    isOrganic: true,
    harvestDate: '2026-10-14',
    sellerId: 'seller-1',
    sellerName: 'Ramasamy Gounder',
    village: 'Vadipatti',
    lat: 10.0558,
    lng: 77.9622,
    images: ['https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=600'],
    rating: 4.9,
    reviewCount: 47,
    description:
      'Unpolished organic green gram. Excellent sprouting rate (>95%). Cleaned and machine-graded to remove stones and dust.',
    vehicleType: 'two_wheeler',
  },

  // 14. Ulunthu (Black Gram)
  {
    id: 'prod-14',
    name: 'Nattu Karuppu Ulunthu (Whole Urad)',
    nameTamil: 'நாட்டு கருப்பு உளுந்து',
    category: 'pulses',
    price: 125,
    unit: 'kg',
    stock: 350,
    minOrder: 2,
    isOrganic: true,
    harvestDate: '2026-10-12',
    sellerId: 'seller-5',
    sellerName: 'Kandasamy Natarajan',
    village: 'Bhavani',
    lat: 11.45,
    lng: 77.6833,
    images: ['https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=600'],
    rating: 4.8,
    reviewCount: 39,
    description:
      'Skin-on black gram cultivated for making traditional Ulundhankali and high-fluff idli batter with natural mucilage.',
    vehicleType: 'two_wheeler',
  },

  // 15. Konda Kadalai (Black Chickpeas)
  {
    id: 'prod-15',
    name: 'Nattu Karuppu Konda Kadalai',
    nameTamil: 'நாட்டு கருப்பு கொண்டைக்கடலை',
    category: 'pulses',
    price: 95,
    unit: 'kg',
    stock: 300,
    minOrder: 2,
    isOrganic: false,
    harvestDate: '2026-10-16',
    sellerId: 'seller-3',
    sellerName: 'Selvam Muthuvel',
    village: 'Oddanchatram',
    lat: 10.4851,
    lng: 77.7472,
    images: ['https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=600'],
    rating: 4.7,
    reviewCount: 28,
    description:
      'Small desi black chickpeas with earthy taste and rich protein. Ideal for sundal, sprouted salads, and chettinad curries.',
    vehicleType: 'two_wheeler',
  },

  // 16. Erode Manjal (Turmeric)
  {
    id: 'prod-16',
    name: 'Pure Erode Viral Manjal (Curcumin 4.5%)',
    nameTamil: 'ஈரோடு விரலி மஞ்சள் (உயர்தர குர்குமின்)',
    category: 'spices',
    price: 180,
    unit: 'kg',
    stock: 250,
    minOrder: 1,
    isOrganic: true,
    harvestDate: '2026-10-05',
    sellerId: 'seller-5',
    sellerName: 'Kandasamy Natarajan',
    village: 'Bhavani',
    lat: 11.45,
    lng: 77.6833,
    images: ['https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600'],
    rating: 5.0,
    reviewCount: 115,
    description:
      'Authentic GI-tagged Erode finger turmeric. Boiled in copper vats, sun-dried on cement platforms. Deep golden hue with naturally high 4.5% curcumin.',
    vehicleType: 'two_wheeler',
  },

  // 17. Guntur Sannam Red Chillies
  {
    id: 'prod-17',
    name: 'Kovilpatti Sannam Vathal (Dry Chilli)',
    nameTamil: 'கார சன்னம் வத்தல் (சிவப்பு மிளகாய்)',
    category: 'spices',
    price: 220,
    unit: 'kg',
    stock: 180,
    minOrder: 1,
    isOrganic: false,
    harvestDate: '2026-10-08',
    sellerId: 'seller-1',
    sellerName: 'Ramasamy Gounder',
    village: 'Vadipatti',
    lat: 10.0558,
    lng: 77.9622,
    images: ['https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=600'],
    rating: 4.8,
    reviewCount: 54,
    description:
      'Glossy red sun-dried chillies with intense aroma and medium-high heat. Stalk intact to prevent loss of seeds.',
    vehicleType: 'two_wheeler',
  },

  // 18. Nattu Pasumpal & Ney (Dairy)
  {
    id: 'prod-18',
    name: 'Kangeyam Desi Cow Bilona Ghee',
    nameTamil: 'காங்கேயம் நாட்டு மாட்டு நெய்',
    category: 'dairy',
    price: 950,
    unit: 'kg',
    stock: 45,
    minOrder: 1,
    isOrganic: true,
    harvestDate: '2026-10-25',
    sellerId: 'seller-4',
    sellerName: 'Sundarrajan Palanisamy',
    village: 'Pollachi',
    lat: 10.6609,
    lng: 77.0048,
    images: ['https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600'],
    rating: 5.0,
    reviewCount: 142,
    description:
      'A2 cultured Vedic ghee made from indigenous Kangeyam cow curd churned with wooden bilona. Granular texture and heavenly aroma.',
    vehicleType: 'two_wheeler',
  },

  // 19. Mattu Eruvu (Cattle Manure)
  {
    id: 'prod-19',
    name: 'Aged Mattu Eruvu (Cattle Manure)',
    nameTamil: 'பழைய மக்கிய மாட்டு எரு (டிராக்டர் லோடு)',
    category: 'manure',
    price: 3800,
    unit: 'tractor load',
    stock: 15,
    minOrder: 1,
    isOrganic: true,
    harvestDate: '2026-10-01',
    sellerId: 'seller-4',
    sellerName: 'Sundarrajan Palanisamy',
    village: 'Pollachi',
    lat: 10.6609,
    lng: 77.0048,
    images: ['https://images.unsplash.com/photo-1589923188900-85dae523342b?w=600'],
    rating: 4.8,
    reviewCount: 36,
    description:
      '12-month aerobically composted pure cow dung manure. Weed-seed free, rich in microbial biomass and organic carbon. Direct tractor tipper delivery to farmland.',
    vehicleType: 'tractor',
  },

  // 20. Vermicompost (Keeri Eruvu)
  {
    id: 'prod-20',
    name: 'Organic Vermicompost (Worm Castings)',
    nameTamil: 'மண்புழு உரம் (40 கிலோ மூட்டை)',
    category: 'manure',
    price: 360,
    unit: 'bag',
    stock: 120,
    minOrder: 2,
    isOrganic: true,
    harvestDate: '2026-10-15',
    sellerId: 'seller-5',
    sellerName: 'Kandasamy Natarajan',
    village: 'Bhavani',
    lat: 11.45,
    lng: 77.6833,
    images: ['https://images.unsplash.com/photo-1589923188900-85dae523342b?w=600'],
    rating: 4.9,
    reviewCount: 65,
    description:
      '40 kg HDPE bag of premium vermicompost enriched with Trichoderma and Pseudomonas. Odorless, moisture-balanced, ideal for terrace gardens and fruit orchards.',
    vehicleType: 'mini_truck',
  },

  // 21. Vaikkol Kattu (Paddy Straw)
  {
    id: 'prod-21',
    name: 'Golden Paddy Straw Bales (Vaikkol)',
    nameTamil: 'பொன் வைக்கோல் கட்டு (சுருள் கட்டு)',
    category: 'fodder',
    price: 180,
    unit: 'bundle',
    stock: 250,
    minOrder: 5,
    isOrganic: true,
    harvestDate: '2026-10-23',
    sellerId: 'seller-2',
    sellerName: 'Murugesan Chettiar',
    village: 'Thiruvaiyaru',
    lat: 10.8803,
    lng: 79.1039,
    images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600'],
    rating: 4.7,
    reviewCount: 41,
    description:
      'Tightly baled fresh golden paddy straw (approx 22-25 kg per bale). Rain-protected, mold-free. Ideal cattle feed roughage and mushroom bed cultivation.',
    vehicleType: 'tractor',
  },

  // 22. Pasum Pillu (Green Hay Fodder)
  {
    id: 'prod-22',
    name: 'CO-4 Hybrid Napier Green Grass (Pillu)',
    nameTamil: 'பசுந்தீவனம் CO-4 நேப்பியர் புல்',
    category: 'fodder',
    price: 350,
    unit: 'bundle',
    stock: 80,
    minOrder: 2,
    isOrganic: true,
    harvestDate: '2026-10-25',
    sellerId: 'seller-4',
    sellerName: 'Sundarrajan Palanisamy',
    village: 'Pollachi',
    lat: 10.6609,
    lng: 77.0048,
    images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600'],
    rating: 4.8,
    reviewCount: 29,
    description:
      'Freshly cut lush green high-protein cattle fodder grass bundle (50 kg). Cut every morning for local dairy farmers to enhance milk yield.',
    vehicleType: 'auto_rickshaw',
  },

  // 23. Traditional Seeds Kit
  {
    id: 'prod-23',
    name: 'Tamil Nadu Parambariya Vithai Kit',
    nameTamil: 'பாரம்பரிய நாட்டு விதை தொகுப்பு (15 வகைகள்)',
    category: 'seeds',
    price: 280,
    unit: 'bag',
    stock: 90,
    minOrder: 1,
    isOrganic: true,
    harvestDate: '2026-10-10',
    sellerId: 'seller-1',
    sellerName: 'Ramasamy Gounder',
    village: 'Vadipatti',
    lat: 10.0558,
    lng: 77.9622,
    images: ['https://images.unsplash.com/photo-1599813958933-5c777a06487e?w=600'],
    rating: 5.0,
    reviewCount: 88,
    description:
      '15 indigenous vegetable seed packets: Country Brinjal, Ladys Finger, Bottle Gourd, Cluster Beans, Snake Gourd, Ridge Gourd, and Greens. Non-GMO heirloom varieties.',
    vehicleType: 'two_wheeler',
  },

  // 24. Farm Tools: Mannvetti & Aruval
  {
    id: 'prod-24',
    name: 'Forged Steel Mannvetti & Aruval Set',
    nameTamil: 'நாட்டு இரும்பு மண்வெட்டி & கதிர் அறுவாள்',
    category: 'tools',
    price: 650,
    unit: 'bundle',
    stock: 45,
    minOrder: 1,
    isOrganic: false,
    harvestDate: '2026-10-11',
    sellerId: 'seller-5',
    sellerName: 'Kandasamy Natarajan',
    village: 'Bhavani',
    lat: 11.45,
    lng: 77.6833,
    images: ['https://images.unsplash.com/photo-1589923188900-85dae523342b?w=600'],
    rating: 4.9,
    reviewCount: 56,
    description:
      'Heavy-duty hand-hammered spring steel agricultural spade (Mannvetti) and harvesting sickle (Aruval) with seasoned teakwood handle. Sharpened and rust-coated.',
    vehicleType: 'two_wheeler',
  },

  // 25. Bio-Char & Coconut Coir Pith
  {
    id: 'prod-25',
    name: 'Compressed Coconut Coir Pith Block (5 kg)',
    nameTamil: 'தேங்காய் தென்னை நார் கழிவு கட்டி',
    category: 'manure',
    price: 140,
    unit: 'bundle',
    stock: 200,
    minOrder: 2,
    isOrganic: true,
    harvestDate: '2026-10-20',
    sellerId: 'seller-4',
    sellerName: 'Sundarrajan Palanisamy',
    village: 'Pollachi',
    lat: 10.6609,
    lng: 77.0048,
    images: ['https://images.unsplash.com/photo-1589923188900-85dae523342b?w=600'],
    rating: 4.8,
    reviewCount: 72,
    description:
      'Low-EC washed coconut peat compressed block. Expands to 75 liters upon soaking in water. Outstanding water retention medium for root health.',
    vehicleType: 'mini_truck',
  },
];

// ---------------------------------------------------------------------------
// Sample Customer Reviews
// ---------------------------------------------------------------------------
export const REVIEWS: Review[] = [
  {
    id: 'rev-01',
    productId: 'prod-07',
    buyerName: 'Karthik V.',
    rating: 5.0,
    date: '2026-10-24',
    comment:
      'Super fresh organic harvest! Picked straight from the vines in Oddanchatram and delivered within 4 hours. The sourness in thakkali rasam was unmatched.',
  },
  {
    id: 'rev-02',
    productId: 'prod-01',
    buyerName: 'Sundaram Chettiar',
    rating: 5.0,
    date: '2026-10-22',
    comment:
      'Murugesan sent pure single-origin Ponni paddy. Clean moisture, no chaff. We milled 2 bags at our local mill and the rice cooks silky white.',
  },
  {
    id: 'rev-03',
    productId: 'prod-02',
    buyerName: 'Anitha Rajendran',
    rating: 5.0,
    date: '2026-10-20',
    comment:
      'The aroma of this Seeraga Samba while cooking biryani filled our whole apartment. True heirloom quality from Vadipatti.',
  },
  {
    id: 'rev-04',
    productId: 'prod-18',
    buyerName: 'Dr. Subramanian',
    rating: 5.0,
    date: '2026-10-18',
    comment:
      'Genuine Kangeyam cow Vedic ghee. Yellow granular curd butter texture. Will never buy commercial supermarket brands again.',
  },
  {
    id: 'rev-05',
    productId: 'prod-19',
    buyerName: 'Vijayan G.',
    rating: 4.8,
    date: '2026-10-15',
    comment:
      'Tractor load delivered straight to my guava farm in Pollachi. Perfectly decomposed, zero foul smell, loaded with rich organic matter.',
  },
  {
    id: 'rev-06',
    productId: 'prod-08',
    buyerName: 'Meenakshi Sundaram',
    rating: 4.8,
    date: '2026-10-23',
    comment:
      'Good solid shallots. Dry skins, no rotting. Very strong aroma and bite. Excellent quality from Dindigul.',
  },
];

export default PRODUCTS;
