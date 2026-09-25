import z from "zod";

export const personSchema = z.object({
  fullName: z.string().min(1, "Nama harus diisi").max(200),
  nickname: z.string().max(100).optional().default(""),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  birthDate: z.string().optional().nullable(),
  birthPlace: z.string().max(200).optional().nullable(),
  isDeceased: z.boolean().optional().default(false),
  deathDate: z.string().optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  isPublicProfile: z.boolean().optional().default(true),
});