export type CainiaoAddress = {
  countryCode: string;
  province?: string;
  city: string;
  district?: string;
  postalCode?: string;
  addressLines: string[];
};

export type CainiaoContact = {
  name: string;
  phone: string;
  address: CainiaoAddress;
};

export type CainiaoParcelItem = {
  merchantItemId: string;
  description: string;
  quantity: number;
  unitValueMinor: number;
  currency: string;
  originCountryCode: string;
  hsCode: string;
  weightGrams: number;
};

export type CainiaoParcel = {
  packageReference: string;
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  items: CainiaoParcelItem[];
};

export type CainiaoCreateShipmentCommand = {
  merchantOrderId: string;
  recipient: CainiaoContact;
  sender: CainiaoContact;
  parcels: CainiaoParcel[];
};

export type CainiaoCreateShipmentResult = {
  providerOrderReference: string;
  waybillNumber: string;
  carrierCode: string;
  labelStorageKey?: string;
};

export type CainiaoTrackingEvent = {
  providerEventId?: string;
  status: string;
  description: string;
  location?: string;
  occurredAt: Date;
};

export interface CainiaoProvider {
  createShipment(
    command: CainiaoCreateShipmentCommand,
    idempotencyKey: string
  ): Promise<CainiaoCreateShipmentResult>;
  getTracking(waybillNumber: string): Promise<CainiaoTrackingEvent[]>;
  cancelShipment(providerOrderReference: string): Promise<void>;
}
