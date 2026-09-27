type Gender = "MALE" | "FEMALE" | "OTHER";
type Role = "MEMBER" | "BRANCH_ADMIN" | "SUPER_ADMIN" | "GUEST" | "UNKNOWN" | undefined;

type PersonData = {
  id: string;
  fullName: string;
  nickname: string | null;
  gender: Gender;
  birthDate: Date | null;
  city: string | null;
  occupation: string | null;
  status: string | null;
  bio: string | null;
  photoUrl: string | null;
  generationLevel: number | null;
  isDeceased: boolean;
  branch: { name: string; slug: string } | null;
  education?: Array<{
    id: string;
    institution: string;
    degree: string | null;
    fieldOfStudy: string | null;
    startYear: number | null;
    endYear: number | null;
  }>;
  socialLinks?: Array<{
    id: string;
    url: string;
    username: string | null;
    platform: { name: string };
    isPublic?: boolean;
  }>;
  private?: {
    phone: string | null;
    whatsapp: string | null;
    addressLine: string | null;
    email: string | null;
    visibleToMembers: boolean;
  } | null;
};

export type PublicProfile = {
  id: string;
  fullName: string;
  nickname: string | null;
  gender: Gender;
  age: number | null;
  city: string | null;
  occupation: string | null;
  status: string | null;
  bio: string | null;
  photoUrl: string | null;
  generationLevel: number | null;
  isDeceased: boolean;
  branch: { name: string; slug: string } | null;
  education: Array<{
    id: string;
    institution: string;
    degree: string | null;
    fieldOfStudy: string | null;
    startYear: number | null;
    endYear: number | null;
  }>;
  socialLinks: Array<{
    id: string;
    url: string;
    username: string | null;
    platform: { name: string };
  }>;
};

export type MemberProfile = PublicProfile & {
  phone: string | null;
  whatsapp: string | null;
  addressLine: string | null;
  email: string | null;
};

export function calculateAge(
  birthDate: Date | null,
  referenceDate: Date = new Date()
): number | null {
  if (!birthDate) return null;
  
  const birthTime = birthDate.getTime();
  if (isNaN(birthTime)) return null;
  if (birthTime > referenceDate.getTime()) return null;

  let age = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = referenceDate.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = referenceDate.getUTCDate() - birthDate.getUTCDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age;
}

export function normalizeWhatsApp(phone: string): string | null {
  const digits = phone.replace(/[^0-9]/g, "");
  
  if (digits.length < 7) return null;
  
  if (digits.startsWith("0")) {
    return "62" + digits.slice(1);
  }
  
  if (digits.startsWith("62")) {
    return digits;
  }
  
  return digits;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function projectPublicProfile(
  person: PersonData,
  referenceDate: Date = new Date()
): PublicProfile {
  const publicSocialLinks = (person.socialLinks || [])
    .filter((link) => link.isPublic === true && isSafeUrl(link.url))
    .map((link) => ({
      id: link.id,
      url: link.url,
      username: link.username,
      platform: { name: link.platform.name },
    }));

  return {
    id: person.id,
    fullName: person.fullName,
    nickname: person.nickname,
    gender: person.gender,
    age: calculateAge(person.birthDate, referenceDate),
    city: person.city,
    occupation: person.occupation,
    status: person.status,
    bio: person.bio,
    photoUrl: person.photoUrl,
    generationLevel: person.generationLevel,
    isDeceased: person.isDeceased,
    branch: person.branch,
    education: (person.education || []).map((edu) => ({
      id: edu.id,
      institution: edu.institution,
      degree: edu.degree,
      fieldOfStudy: edu.fieldOfStudy,
      startYear: edu.startYear,
      endYear: edu.endYear,
    })),
    socialLinks: publicSocialLinks,
  };
}

export function projectMemberProfile(
  person: PersonData,
  role?: Role,
  referenceDate: Date = new Date()
): MemberProfile {
  const publicProfile = projectPublicProfile(person, referenceDate);

  const isMemberPlus = role === "MEMBER" || role === "BRANCH_ADMIN" || role === "SUPER_ADMIN";
  const hasConsent = person.private?.visibleToMembers === true;

  if (!isMemberPlus || !hasConsent || !person.private) {
    return {
      ...publicProfile,
      phone: null,
      whatsapp: null,
      addressLine: null,
      email: null,
    };
  }

  return {
    ...publicProfile,
    phone: person.private.phone,
    whatsapp: person.private.whatsapp,
    addressLine: person.private.addressLine,
    email: person.private.email,
  };
}
