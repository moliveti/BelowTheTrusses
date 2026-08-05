import type { Role } from "@/lib/profile";

export interface TeamMember {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  createdAt: string;
  lastSignInAt: string | null;
}
