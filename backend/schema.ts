import { z } from "zod";

export const RequestSchema = z.object({
  sessionId: z.string(),
  customerData: z.object({
    customer: z.object({
      name: z.string(),
      email: z.string(),
      company: z.string().optional(),
      phone: z.string().optional(),
      role: z.string().optional()
    }),
    facility: z.object({
      type: z.string(),
      area_m2: z.number(),
      yearBuilt: z.number().optional(),
      floors: z.number().optional(),
      occupancy: z.number().optional(),
      location: z.string().optional(),
      bms: z.boolean().optional(),
      hours_per_week: z.number().optional(),
      lighting: z.object({
        type: z.string().optional(),
        controls: z.array(z.string()).optional()
      }).optional()
    }),
    energy: z.object({
      annual_kwh: z.number(),
      annual_cooling_kwh: z.number().optional(),
      gas_annual_mmbtu: z.number().optional(),
      diesel_annual_liters: z.number().optional(),
      tariff_aed_per_kwh: z.number(),
      emission_factor_kg_per_kwh: z.number(),
      carbon_factor_kg_per_kwh: z.number().optional(),
      best_possible_eui: z.number().optional()
    })
  }),
  files: z.array(z.string())
});

export type RequestType = z.infer<typeof RequestSchema>;
