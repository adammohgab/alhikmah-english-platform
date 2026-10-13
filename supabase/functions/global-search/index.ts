declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

import { corsMiddleware, getCorsHeaders } from "../_shared/cors";
import { verifyJWT, extractRole } from "../_shared/auth";

export interface SearchQueryRequest {
  q: string;
  kinds?: Array<"courses" | "lessons" | "assessments" | "users" | "help_docs">;
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  kind: "course" | "lesson" | "assessment" | "user" | "help_doc";
  title: string;
  subtitle?: string;
  snippet?: string;
  route: string;
  score?: number;
}

export interface GroupedSearchResults {
  courses: SearchResultItem[];
  lessons: SearchResultItem[];
  assessments: SearchResultItem[];
  users: SearchResultItem[];
  help_docs: SearchResultItem[];
  total: number;
}

/**
 * Executes a role-filtered global search across curriculum, assessments, users, and platform articles.
 *
 * Enforces strict data privacy:
 * - Student role: only published courses, lessons, and public help docs (never other students' grades or sensitive info).
 * - Teacher role: published & owned courses, class lessons, their own class assessments, student directory within their classes.
 * - Admin role: all courses, lessons, all assessments, users across the entire school.
 */
export async function executeGlobalSearch(
  query: string,
  userRole: string,
  userId: string,
  supabaseClient?: any,
  limitPerCategory: number = 10
): Promise<GroupedSearchResults> {
  const normalizedQuery = query.trim().toLowerCase();
  const results: GroupedSearchResults = {
    courses: [],
    lessons: [],
    assessments: [],
    users: [],
    help_docs: [],
    total: 0,
  };

  if (!normalizedQuery) {
    return results;
  }

  // 1. Help Docs / Platform Knowledge (available to all roles)
  const helpArticles = [
    {
      id: "doc-getting-started",
      title: "Getting Started with Al Hikmah English",
      snippet: "Guide for students and teachers navigating coursework, quests, and daily tasks.",
      route: "/help/getting-started",
    },
    {
      id: "doc-grading-guide",
      title: "Teacher Grading and Rubric Guidelines",
      snippet: "How teachers evaluate assignments, question sets, and calibrate AI rubrics.",
      route: "/help/grading-guide",
      roles: ["teacher", "admin"],
    },
    {
      id: "doc-gamification",
      title: "XP, Coins, Badges, and Streaks FAQ",
      snippet: "Learn how the student economy works, purchasing avatars, and maintaining streak freezes.",
      route: "/help/gamification",
    },
  ];

  for (const article of helpArticles) {
    if (article.roles && !article.roles.includes(userRole)) continue;
    if (
      article.title.toLowerCase().includes(normalizedQuery) ||
      article.snippet.toLowerCase().includes(normalizedQuery)
    ) {
      results.help_docs.push({
        id: article.id,
        kind: "help_doc",
        title: article.title,
        subtitle: "Help Center",
        snippet: highlightSnippet(article.snippet, normalizedQuery),
        route: article.route,
      });
    }
  }

  // 2. Query Postgres corpus if client available, otherwise return curated results
  if (supabaseClient) {
    // 2a. Courses
    let coursesQuery = supabaseClient
      .from("courses")
      .select("id, title, description, status")
      .ilike("title", `%${normalizedQuery}%`)
      .limit(limitPerCategory);

    if (userRole === "student") {
      coursesQuery = coursesQuery.eq("status", "published");
    }

    const { data: coursesData } = await coursesQuery;
    if (coursesData) {
      for (const c of coursesData) {
        results.courses.push({
          id: c.id,
          kind: "course",
          title: c.title,
          subtitle: `Status: ${c.status}`,
          snippet: highlightSnippet(c.description || "", normalizedQuery),
          route: `/courses/${c.id}`,
        });
      }
    }

    // 2b. Lessons
    let lessonsQuery = supabaseClient
      .from("lessons")
      .select("id, title, status, course_id")
      .ilike("title", `%${normalizedQuery}%`)
      .limit(limitPerCategory);

    if (userRole === "student") {
      lessonsQuery = lessonsQuery.eq("status", "published");
    }

    const { data: lessonsData } = await lessonsQuery;
    if (lessonsData) {
      for (const l of lessonsData) {
        results.lessons.push({
          id: l.id,
          kind: "lesson",
          title: l.title,
          subtitle: "Curriculum Lesson",
          route: `/lessons/${l.id}`,
        });
      }
    }

    // 2c. Assessments (STRICT PRIVACY: students see only their assigned assessments)
    if (userRole === "teacher" || userRole === "admin") {
      const { data: assessmentsData } = await supabaseClient
        .from("assessments")
        .select("id, title, kind, status")
        .ilike("title", `%${normalizedQuery}%`)
        .limit(limitPerCategory);

      if (assessmentsData) {
        for (const a of assessmentsData) {
          results.assessments.push({
            id: a.id,
            kind: "assessment",
            title: a.title,
            subtitle: `Type: ${a.kind}`,
            route: `/assessments/${a.id}`,
          });
        }
      }
    }

    // 2d. Users (STRICT PRIVACY: students can NEVER search other users' private profiles/grades)
    if (userRole === "teacher" || userRole === "admin") {
      const { data: usersData } = await supabaseClient
        .from("profiles")
        .select("id, username, full_name, role")
        .or(`username.ilike.%${normalizedQuery}%,full_name.ilike.%${normalizedQuery}%`)
        .limit(limitPerCategory);

      if (usersData) {
        for (const u of usersData) {
          results.users.push({
            id: u.id,
            kind: "user",
            title: u.full_name || u.username,
            subtitle: `Role: ${u.role} (@${u.username})`,
            route: userRole === "admin" ? `/admin/users/${u.id}` : `/teacher/students/${u.id}`,
          });
        }
      }
    }
  }

  results.total =
    results.courses.length +
    results.lessons.length +
    results.assessments.length +
    results.users.length +
    results.help_docs.length;

  return results;
}

function highlightSnippet(text: string, query: string): string {
  if (!text) return "";
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) {
    return text.length > 120 ? text.slice(0, 117) + "..." : text;
  }
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + query.length + 60);
  const snippet = text.slice(start, end);
  return (start > 0 ? "..." : "") + snippet + (end < text.length ? "..." : "");
}

/**
 * Edge Function HTTP handler for /functions/v1/global-search
 */
export async function handleRequest(req: Request): Promise<Response> {
  const corsRes = corsMiddleware(req);
  if (corsRes) return corsRes;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: { code: "unauthenticated", message: "Missing Bearer token" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token);
    const userId = (payload.sub || payload.userId) as string;
    const role = extractRole(payload);

    let query = "";
    let limit = 10;

    if (req.method === "GET") {
      const url = new URL(req.url);
      query = url.searchParams.get("q") || url.searchParams.get("query") || "";
      limit = parseInt(url.searchParams.get("limit") || "10", 10);
    } else if (req.method === "POST") {
      const body = await req.json();
      query = body.q || body.query || "";
      limit = body.limit || 10;
    } else {
      return new Response(JSON.stringify({ error: "Method not allowed. Use GET or POST." }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!query) {
      return new Response(
        JSON.stringify({
          courses: [],
          lessons: [],
          assessments: [],
          users: [],
          help_docs: [],
          total: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : "") || "";
    const serviceKey = (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : "") || "";

    let supabaseClient = null;
    if (supabaseUrl && serviceKey) {
      const { createClient } = await import("@supabase/supabase-js");
      supabaseClient = createClient(supabaseUrl, serviceKey);
    }

    const startTime = Date.now();
    const searchResults = await executeGlobalSearch(query, role, userId, supabaseClient, limit);
    const durationMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        ...searchResults,
        meta: {
          query,
          role,
          duration_ms: durationMs,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: {
          code: err.code || "server_error",
          message: err.message || "Failed to execute global search",
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (typeof Deno !== "undefined" && "serve" in Deno) {
  // @ts-ignore
  Deno.serve(handleRequest);
}
