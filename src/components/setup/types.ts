export type LocationData = {
  id: string;
  label: string;
  address: string;
  isWork: boolean;
};

export type PairSlotData = {
  id: string;
  timeLocal: string;
  daysOfWeek: string;
  active: boolean;
};

export type TrackedPairData = {
  id: string;
  active: boolean;
  originLocation: LocationData;
  destinationLocation: LocationData;
  scheduleSlots: PairSlotData[];
};
