import { z } from 'zod'

export const allowanceBreakdownItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  amount: z.number(),
  salary_component_id: z.string().optional(),
})

export const allowanceBreakdownSchema = z.array(allowanceBreakdownItemSchema)

export type AllowanceBreakdownParsed = z.infer<typeof allowanceBreakdownSchema>
