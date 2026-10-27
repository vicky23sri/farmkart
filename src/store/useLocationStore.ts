/**
 * Location Store
 * Manages buyer's delivery location with expo-location GPS detection,
 * reverse geocoding, saved addresses, and 50 km radius limit.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface BuyerLocation {
  id?: string;
  name: string;
  nameTamil: string;
  lat: number;
  lng: number;
  address: string;
  isGps?: boolean;
}

export const PRESET_LOCATIONS: BuyerLocation[] = [
  {
    id: 'loc-1',
    name: 'Madurai Central',
    nameTamil: 'மதுரை மத்திய பகுதி',
    lat: 9.9252,
    lng: 78.1198,
    address: 'Near Meenakshi Temple, Madurai - 625001',
  },
  {
    id: 'loc-2',
    name: 'Vadipatti Town',
    nameTamil: 'வாடிப்பட்டி நகரம்',
    lat: 10.0558,
    lng: 77.9622,
    address: 'Main Bazaar, Vadipatti - 625218',
  },
  {
    id: 'loc-3',
    name: 'Dindigul Bypass',
    nameTamil: 'திண்டுக்கல் பைபாஸ்',
    lat: 10.3673,
    lng: 77.9803,
    address: 'Collectorate Road, Dindigul - 624004',
  },
  {
    id: 'loc-4',
    name: 'Thiruvaiyaru',
    nameTamil: 'திருவையாறு',
    lat: 10.8803,
    lng: 79.1039,
    address: 'Cauvery Bank, Thanjavur - 613204',
  },
];

interface LocationState {
  currentLocation: BuyerLocation;
  savedAddresses: BuyerLocation[];
  maxDeliveryRadiusKm: number;
  isLocating: boolean;
  locationError: string | null;
  setLocation: (location: BuyerLocation) => void;
  addSavedAddress: (address: BuyerLocation) => void;
  removeSavedAddress: (addressText: string) => void;
  requestAndFetchCurrentLocation: () => Promise<{
    success: boolean;
    location?: BuyerLocation;
    error?: string;
  }>;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      currentLocation: PRESET_LOCATIONS[0],
      savedAddresses: PRESET_LOCATIONS,
      maxDeliveryRadiusKm: 50,
      isLocating: false,
      locationError: null,

      setLocation: (location) =>
        set({ currentLocation: location, locationError: null }),

      addSavedAddress: (address) => {
        const current = get().savedAddresses;
        const exists = current.some(
          (a) =>
            Math.abs(a.lat - address.lat) < 0.001 &&
            Math.abs(a.lng - address.lng) < 0.001
        );
        if (!exists) {
          set({ savedAddresses: [address, ...current] });
        }
        set({ currentLocation: address });
      },

      removeSavedAddress: (addressText) => {
        set((state) => ({
          savedAddresses: state.savedAddresses.filter(
            (a) => a.address !== addressText && a.id !== addressText
          ),
        }));
      },

      /**
       * Request permission and fetch device's live GPS coordinates using expo-location.
       * Reverse-geocodes to an address string or falls back to saved location.
       */
      requestAndFetchCurrentLocation: async () => {
        try {
          set({ isLocating: true, locationError: null });

          // 1. Request foreground location permission
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            const fallback = get().currentLocation || PRESET_LOCATIONS[0];
            set({
              isLocating: false,
              locationError:
                'Permission to access location was denied. Using saved location.',
            });
            return {
              success: false,
              error: 'Location permission denied',
              location: fallback,
            };
          }

          // 2. Fetch current GPS position
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          const { latitude, longitude } = position.coords;

          // 3. Reverse geocode to human-readable address
          let addressText = `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`;
          let districtName = 'Current Location';

          try {
            const geocodeResults = await Location.reverseGeocodeAsync({
              latitude,
              longitude,
            });

            if (geocodeResults && geocodeResults.length > 0) {
              const res = geocodeResults[0];
              const parts = [
                res.street || res.name,
                res.subregion || res.district || res.city,
                res.postalCode ? `PIN: ${res.postalCode}` : '',
              ].filter(Boolean);

              if (parts.length > 0) {
                addressText = parts.join(', ');
              }
              districtName = res.district || res.city || res.subregion || 'Detected GPS';
            }
          } catch (geocodeErr) {
            console.warn('[useLocationStore] Reverse geocoding failed:', geocodeErr);
          }

          const newGpsLocation: BuyerLocation = {
            id: `gps-${Date.now()}`,
            name: districtName,
            nameTamil: 'தற்போதைய ஜி.பி.எஸ் இடம்',
            lat: latitude,
            lng: longitude,
            address: addressText,
            isGps: true,
          };

          // Save and set as current
          get().addSavedAddress(newGpsLocation);
          set({
            currentLocation: newGpsLocation,
            isLocating: false,
            locationError: null,
          });

          return { success: true, location: newGpsLocation };
        } catch (err: any) {
          const fallback = get().currentLocation || PRESET_LOCATIONS[0];
          set({
            isLocating: false,
            locationError: err?.message || 'Could not fetch device location.',
          });
          return {
            success: false,
            error: err?.message,
            location: fallback,
          };
        }
      },
    }),
    {
      name: 'farmkart_location_storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentLocation: state.currentLocation,
        savedAddresses: state.savedAddresses,
      }),
    }
  )
);

export default useLocationStore;
