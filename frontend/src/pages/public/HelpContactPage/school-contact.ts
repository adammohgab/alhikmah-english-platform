import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase";

/* School contact details for the Help page (SHARED-SPEC SH-06 ContactCard, SchoolContact entity).
   Source: the public `get_public_state` RPC (05-API-CONTRACT section 2, callable without an
   account), which carries `school: { name, ..., contact... }` from Platform settings > General
   (school_name, contact_email, contact_phone, office_hours, location, support_link).
   The contract leaves the exact `contact` shape open, so both a flat shape
   (school.contact_phone) and a nested one (school.contact.phone) are read. Anything missing
   stays undefined and the page simply leaves that line out: nothing is invented. */

export interface SchoolContact {
  schoolName?: string | undefined;
  officeHours?: string | undefined;
  phone?: string | undefined;
  location?: string | undefined;
  contactEmail?: string | undefined;
  supportLink?: string | undefined;
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate.trim();
  }
  return undefined;
}

/** Keeps only http(s) links, so a bad setting can never become a `javascript:` link. */
export function safeHttpUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function parseSchoolContact(state: unknown): SchoolContact {
  if (!isRecord(state)) return {};
  const school = isRecord(state["school"]) ? state["school"] : {};
  const contact = isRecord(school["contact"]) ? school["contact"] : {};
  return {
    schoolName: text(school["name"], school["school_name"], state["school_name"]),
    officeHours: text(contact["office_hours"], contact["officeHours"], school["office_hours"]),
    phone: text(contact["phone"], contact["contact_phone"], school["contact_phone"]),
    location: text(contact["location"], school["location"]),
    contactEmail: text(contact["email"], contact["contact_email"], school["contact_email"]),
    supportLink: safeHttpUrl(
      text(contact["support_link"], contact["supportLink"], school["support_link"]),
    ),
  };
}

type RpcCaller = (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export async function fetchSchoolContact(): Promise<SchoolContact> {
  // The generated Database type does not list get_public_state yet, so call it by name.
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;
  const { data, error } = await rpc("get_public_state");
  if (error) throw new Error(error.message);
  return parseSchoolContact(data);
}

export function useSchoolContact() {
  return useQuery({
    queryKey: ["school-contact"],
    queryFn: fetchSchoolContact,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
}
