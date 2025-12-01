/**
 * coordinate-crew-logistics MCP Tool
 * Manages hotels, ground transport, and crew logistics during irregular ops
 */

export interface CoordinateCrewLogisticsInput {
  employeeIds: string[];
  location: string; // IATA code
  logisticsType: 'hotel' | 'ground_transport' | 'meal_voucher' | 'all';
  duration?: number; // hours or nights
  urgency?: 'routine' | 'expedited' | 'emergency';
}

export async function coordinateCrewLogistics(
  input: CoordinateCrewLogisticsInput
): Promise<any> {
  const {
    employeeIds,
    location,
    logisticsType,
    duration = 1,
    urgency = 'routine'
  } = input;

  const bookings: any[] = [];
  let totalCost = 0;

  for (const employeeId of employeeIds) {
    if (logisticsType === 'hotel' || logisticsType === 'all') {
      const hotel = bookHotel(location, duration, urgency);
      bookings.push({
        employeeId,
        type: 'hotel',
        ...hotel
      });
      totalCost += hotel.costUsd;
    }

    if (logisticsType === 'ground_transport' || logisticsType === 'all') {
      const transport = bookTransport(location, urgency);
      bookings.push({
        employeeId,
        type: 'transport',
        ...transport
      });
      totalCost += transport.costUsd;
    }

    if (logisticsType === 'meal_voucher' || logisticsType === 'all') {
      const meals = issueMealVoucher(duration);
      bookings.push({
        employeeId,
        type: 'meal',
        ...meals
      });
      totalCost += meals.costUsd;
    }
  }

  return {
    location,
    crewCount: employeeIds.length,
    bookings,
    totalCostUsd: totalCost,
    confirmationNumbers: bookings.map(b => b.confirmationNumber),
    status: 'confirmed',
    timestamp: new Date().toISOString()
  };
}

function bookHotel(location: string, nights: number, urgency: string): any {
  return {
    hotelName: `Airport Hotel ${location}`,
    address: `${location} Airport District`,
    checkIn: new Date().toISOString(),
    checkOut: new Date(Date.now() + nights * 24 * 60 * 60 * 1000).toISOString(),
    nights,
    roomType: 'Standard',
    costUsd: nights * (urgency === 'emergency' ? 180 : 120),
    confirmationNumber: `HTL${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  };
}

function bookTransport(location: string, urgency: string): any {
  return {
    provider: urgency === 'emergency' ? 'Premium Car Service' : 'Standard Shuttle',
    pickupLocation: `${location} Airport`,
    dropoffLocation: 'Hotel',
    scheduledTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    costUsd: urgency === 'emergency' ? 75 : 35,
    confirmationNumber: `TRN${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  };
}

function issueMealVoucher(duration: number): any {
  return {
    voucherType: 'Meal Allowance',
    amount: duration * 15, // $15/meal
    validUntil: new Date(Date.now() + duration * 60 * 60 * 1000).toISOString(),
    costUsd: duration * 15,
    confirmationNumber: `MEAL${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  };
}

export const coordinateCrewLogisticsSchema = {
  type: "object" as const,
  properties: {
    employeeIds: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "List of crew member employee IDs needing logistics"
    },
    location: {
      type: "string" as const,
      description: "IATA airport code where logistics are needed"
    },
    logisticsType: {
      type: "string" as const,
      enum: ["hotel", "ground_transport", "meal_voucher", "all"],
      description: "Type of logistics support needed"
    },
    duration: {
      type: "number" as const,
      description: "Duration in hours (or nights for hotels)",
      default: 1
    },
    urgency: {
      type: "string" as const,
      enum: ["routine", "expedited", "emergency"],
      description: "Booking urgency level",
      default: "routine"
    }
  },
  required: ["employeeIds", "location", "logisticsType"]
};
