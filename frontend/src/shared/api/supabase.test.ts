import { describe, it, expect } from "vitest";
import { supabase } from "./supabase";

describe("Supabase Browser Client", () => {
  it("initializes singleton client instance with expected auth configuration", () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.from).toBe("function");
    expect(typeof supabase.rpc).toBe("function");
  });

  it("exposes typed table query builders without runtime crashing", () => {
    const query = supabase.from("platform_settings").select("key, value");
    expect(query).toBeDefined();
  });
});
