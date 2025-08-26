export interface Customer {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  role?: string;
}

export interface Lighting {
  type?: string;
  controls?: string[];
}

export interface Facility {
  type: string;
  area_m2: number;
  yearBuilt?: number;
  floors?: number;
  occupancy?: number;
  location?: string;
  bms?: boolean;
  hours_per_week?: number;
  lighting?: Lighting;
}

export interface Energy {
  annual_kwh: number;
  annual_cooling_kwh?: number;
  gas_annual_mmbtu?: number;
  diesel_annual_liters?: number;
  tariff_aed_per_kwh: number;
  emission_factor_kg_per_kwh: number;
  carbon_factor_kg_per_kwh?: number;
  best_possible_eui?: number;
}

export interface CustomerData {
  customer: Customer;
  facility: Facility;
  energy: Energy;
}

export interface RequestType {
  sessionId: string;
  customerData: CustomerData;
  files: string[];
}