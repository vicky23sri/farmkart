/**
 * Mock Data for FarmKart
 * Sample categories and produce listings for development and testing.
 */

export interface CropListing {
  id: string;
  name: string;
  tamilName: string;
  category: 'vegetables' | 'fruits' | 'grains' | 'spices';
  pricePerKg: number;
  availableQuantityKg: number;
  farmerName: string;
  location: string;
}

export const SAMPLE_CROPS: CropListing[] = [
  {
    id: 'crop-1',
    name: 'Organic Tomatoes',
    tamilName: 'நாட்டு தக்காளி',
    category: 'vegetables',
    pricePerKg: 35,
    availableQuantityKg: 500,
    farmerName: 'Ramasamy',
    location: 'Madurai, TN',
  },
  {
    id: 'crop-2',
    name: 'Ponni Rice (Direct Paddy)',
    tamilName: 'பொன்னி அரிசி',
    category: 'grains',
    pricePerKg: 58,
    availableQuantityKg: 2000,
    farmerName: 'Murugan',
    location: 'Thanjavur, TN',
  },
  {
    id: 'crop-3',
    name: 'Fresh Red Onions',
    tamilName: 'சின்ன வெங்காயம்',
    category: 'vegetables',
    pricePerKg: 45,
    availableQuantityKg: 800,
    farmerName: 'Selvam',
    location: 'Dindigul, TN',
  },
];
