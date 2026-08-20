// Mirrors the planned Mongo `locations` collection.
export interface Location {
  city: string;
  state: string;
  address: string;
  hours: string;
  phone: string;
}

export const locations: Location[] = [
  {
    city: "Gainesville",
    state: "FL",
    address: "Gainesville, FL (exact address on request)",
    hours: "Mon-Fri 10am-6pm",
    phone: "(352) 555-0148",
  },
  {
    city: "Miami",
    state: "FL",
    address: "Miami, FL (exact address on request)",
    hours: "Mon-Sat 11am-7pm",
    phone: "(305) 555-0172",
  },
];
