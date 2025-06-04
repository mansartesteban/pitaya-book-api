import { z } from "zod";

export const ClientTypeEnum = z.enum(["INDIVIDUAL", "PROFESSIONAL"]);

export const UserSchema = z.object({
  id: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),

  firstname: z.string(),
  lastname: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),

  clientType: ClientTypeEnum,
  companyName: z.string().optional(),

  password: z.string().optional(),
  isActive: z.boolean(),
  lastLoginAt: z.string().datetime().optional(),

  notes: z.string().optional(),
});

export const UserWithValidationSchema = UserSchema.superRefine((data, ctx) => {
  if (data.clientType === "PROFESSIONAL" && !data.companyName) {
    ctx.addIssue({
      path: ["companyName"],
      code: z.ZodIssueCode.custom,
      message: "Company name is required for professional clients.",
    });
  }
});
