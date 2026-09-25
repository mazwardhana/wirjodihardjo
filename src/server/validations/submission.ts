import { z } from "zod";

export const personSchema = z.object({
  fullName: z.string().min(1, "Nama lengkap wajib diisi").max(200),
  nickname: z.string().max(100).optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  birthDate: z.string().optional().or(z.literal("")),
  birthPlace: z.string().max(200).optional().or(z.literal("")),
  isDeceased: z.boolean().optional(),
  deathDate: z.string().optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
  branchId: z.string().uuid().optional().or(z.literal("")),
});

export const addChildSchema = z.object({
  parentId: z.string().uuid("Orang tua tidak valid"),
  fullName: z.string().min(1, "Nama anak wajib diisi").max(200),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  birthDate: z.string().optional().or(z.literal("")),
  birthPlace: z.string().max(200).optional().or(z.literal("")),
  isStep: z.boolean().optional(),
  isAdopted: z.boolean().optional(),
  parentRole: z.enum(["FATHER", "MOTHER", "UNKNOWN"]).optional(),
});

export const addSpouseSchema = z.object({
  personId: z.string().uuid("Anggota tidak valid"),
  fullName: z.string().min(1, "Nama pasangan wajib diisi").max(200),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  marriageDate: z.string().optional().or(z.literal("")),
  status: z.enum(["MARRIED", "DIVORCED", "WIDOWED"]).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const editPersonSchema = z.object({
  personId: z.string().uuid("Anggota tidak valid"),
  fullName: z.string().min(1).max(200).optional(),
  nickname: z.string().max(100).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  birthPlace: z.string().max(200).optional().or(z.literal("")),
  isDeceased: z.boolean().optional(),
  deathDate: z.string().optional().or(z.literal("")),
});

export const editRelationSchema = z.object({
  personId: z.string().uuid("Anggota tidak valid"),
  relationType: z.enum(["parent", "child", "partner"]),
  edgeId: z.string().uuid().optional(),
  action: z.enum(["add", "remove", "update"]),
  targetPersonId: z.string().uuid().optional(),
  role: z.enum(["FATHER", "MOTHER", "UNKNOWN"]).optional(),
  isStep: z.boolean().optional(),
  isAdopted: z.boolean().optional(),
  partnerGender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  marriageDate: z.string().optional().or(z.literal("")),
  status: z.enum(["MARRIED", "DIVORCED", "WIDOWED"]).optional(),
});

export type PersonInput = z.infer<typeof personSchema>;
export type AddChildInput = z.infer<typeof addChildSchema>;
export type AddSpouseInput = z.infer<typeof addSpouseSchema>;
export type EditPersonInput = z.infer<typeof editPersonSchema>;
export type EditRelationInput = z.infer<typeof editRelationSchema>;