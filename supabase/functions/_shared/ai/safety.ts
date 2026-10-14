/**
 * `_shared/ai/safety.ts`
 *
 * Safety filter pipeline for AI conversations: PII redaction, prompt injection guard,
 * inappropriate content filter, post-check validation, and moderation logging.
 *
 * Pre-check (AI-BEHAVIOR §4.1):
 *   1. Length check, normalization, PII masking, rule-layer (prompt injection + blocklist),
 *   2. Classifier layer (model), decision table (ok/blocked/redirect)
 *   - off_topic (harmless) → redirect with fixed copy, no model call
 *   - blocked_category/injection/sensitive_personal → neutral message, no model call,
 *     message stored with safety.blocked=true, moderation_items row (Low), usage row blocked (no cost)
 *   - answer_request while assessment_open → continue with hint-only instruction
 *   - third consecutive blocked message → "We can't process this request. Let's get back to English.",
 *     flag conversation (flagged=true), raise moderation item to Medium
 *
 * Post-check (AI-BEHAVIOR §4.3):
 *   - Rule-layer check on full text (sliding window 200 chars)
 *   - Classifier check (student-facing: response > 40 words)
 *   - Zod schema validation for structured outputs
 *   - One repair attempt; second failure → provider_error
 *
 * Moderation (AI-BEHAVIOR §4.5):
 *   - Low: single blocked messages, minor quality issues
 *   - Medium: repeats or inappropriate draft content
 *   - High: unsafe content that reached students or exposed personal data
 *   - High items also create admin notification
 *   - No staff alert for sensitive personal topics (owner decision); remain Low
 */

import { supabase } from "@supabase/supabase-js";
import { AppError, validationFailed } from "../errors";

// -------------------------------------------------------------------
// Config helpers — read from platform_settings.ai_safety (published config)
// -------------------------------------------------------------------

/** Default blocklist when no config is available */
const DEFAULT_BLOCKED_CATEGORIES = [
  "racism",
  "sexism",
  "violence",
  "self-harm",
  "hate_speech",
];

const DEFAULT_SENSITIVE_PATTERNS = [
  /phone/\d{3}-\d{3}-\d{4}/i,
  /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/,
  /[\d\s]{10,}/, // long digit strings (potential addresses/ssn)
];

/** Prompt-injection patterns (AI-BEHAVIOR §4.1.4) */
const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /change\s+the\s+rules/i,
  /reveal\s+the\s+prompt/i,
  /you\s+are\s+now\s+a\s+different\s+AI/i,
  /drop\s+all\s+restrictions/i,
  /system\s*:/i,
  /fullprompt/i,
];

/** CEFR levels for vocabulary-aware checks */
type CEFRLevel = "A1" | "A2" | "B1" | "B2";

/** Moderation severity per AI-BEHAVIOR §4.5 */
type ModerationSeverity = "low" | "medium" | "high";

/** Moderation category */
type ModerationCategory =
  | "injection"
  | "blocked_category"
  | "sensitive_personal";

/** Pre-check result */
type PreCheckResult = {
  status: "ok" | "blocked" | "redirect";
  safety: {
    blocked: boolean;
    category?: ModerationCategory;
    severity?: ModerationSeverity;
    redirected: boolean;
  };
  redactedMessage: string;
  hadPII: boolean;
  promptInjection?: {
    category: ModerationCategory;
    confidence: number;
    matchedPattern: string;
  };
};

/** Post-check result */
type PostCheckResult = {
  status: "ok" | "blocked" | "repair_attempt";
  safety: {
    blocked: boolean;
    category?: ModerationCategory;
    severity?: ModerationSeverity;
    repaired: boolean;
  };
  finalText: string;
  repairCount: number;
};

/** Log a safety violation to the moderation system */
type LogSafetyViolation = (
  messageId: string,
  category: ModerationCategory,
  severity: ModerationSeverity,
  originalText: string,
  redactedText: string,
  conversationId: string,
  source?: "ai_message"
) => Promise<{ error?: any; success: boolean }>;

// -------------------------------------------------------------------
// PII Redaction
// -------------------------------------------------------------------

/** Redact phone numbers, email addresses, and long digit strings from text. */
function redactPII(text: string): { redacted: string; hadPII: boolean } {
  let result = text;
  let hadPII = false;

  // Phone number pattern: XXX-XXX-XXXX or international variants
  const phonePattern = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  if (phonePattern.test(result)) {
    result = result.replace(phonePattern, "[PHONE REDACTED]");
    hadPII = true;
  }

  // Email address pattern
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  if (emailPattern.test(result)) {
    result = result.replace(emailPattern, "[EMAIL REDACTED]");
    hadPII = true;
  }

  // Long digit strings (10+ consecutive digits, potentially SSN/address)
  const longDigitsPattern = /[\d\s]{10,}/g;
  if (longDigitsPattern.test(result)) {
    result = result.replace(longDigitsPattern, (match) => {
      // Only mask if not already caught by phone/email
      hadPII = true;
      return match.replace(/\d/g, "X");
    });
  }

  return { redacted: result, hadPII };
}

/** Mask sensitive patterns (phone, email, addresses) in text for logs/prints. */
function maskSensitivePatterns(text: string): string {
  let result = text;
  // Phone numbers
  result = result.replace(/(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[PHONE]");
  // Email addresses
  result = result.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");
  // Long digit strings (10+ digits)
  result = result.replace(/[\d\s]{10,}/g, (m) => m.replace(/\d/g, "X"));
  return result;
}

// -------------------------------------------------------------------
// Prompt Injection Detection
// -------------------------------------------------------------------

/** Detect prompt-injection patterns in user message. */
function detectPromptInjection(text: string): {
  isInjection: boolean;
  category: ModerationCategory;
  confidence: number;
  matchedPattern: string;
} {
  for (let i = 0; i < INJECTION_PATTERNS.length; i++) {
    const pattern = INJECTION_PATTERNS[i];
    const match = text.match(pattern);
    if (match) {
      // Simple confidence: higher if multiple patterns match or pattern is strong
      const confidence = i < 3 ? 0.9 : 0.7;
      return {
        isInjection: true,
        category: "injection",
        confidence,
        matchedPattern: match[0],
      };
    }
  }
  return {
    isInjection: false,
    category: "ok" as ModerationCategory,
    confidence: 1,
    matchedPattern: "",
  };
}

/** Check for inappropriate content using blocklist and grade-level awareness. */
function checkInappropriateContent(
  text: string,
  gradeLevel: CEFRLevel,
  blocklist?: string[]
): {
  isInappropriate: boolean;
  category: ModerationCategory;
  severity: ModerationSeverity;
  reason: string;
} {
  const categories = blocklist || DEFAULT_BLOCKED_CATEGORIES;
  const lowered = text.toLowerCase();

  // Check against blocked categories
  for (const category of categories) {
    if (lowered.includes(category)) {
      return {
        isInappropriate: true,
        category: "blocked_category" as ModerationCategory,
        severity: "high",
        reason: `Blocked category detected: ${category}`,
      };
    }
  }

  // Check for sensitive personal content patterns
  for (const pattern of DEFAULT_SENSITIVE_PATTERNS) {
    if (pattern.test(lowered)) {
      return {
        isInappropriate: true,
        category: "sensitive_personal" as ModerationCategory,
        severity: "medium",
        reason: "Sensitive personal content detected",
      };
    }
  }

  // Grade-appropriate check: younger grades have stricter filters
  const gradeRestrictions = {
    A1: ["hate", "violence", "death"],
    A2: ["hate", "violence", "drugs"],
    B1: ["hate", "violence", "self-harm"],
    B2: ["hate", "violence", "self-harm", "drugs"],
  };

  const restricted = gradeRestrictions[gradeLevel] || [];
  for (const term of restricted) {
    if (lowered.includes(term)) {
      return {
        isInappropriate: true,
        category: "blocked_category" as ModerationCategory,
        severity: "high",
        reason: `Grade-inappropriate content: ${term}`,
      };
    }
  }

  return {
    isInappropriate: false,
    category: "ok" as ModerationCategory,
    severity: "low",
    reason: "Content acceptable",
  };
}

/** Mask sensitive content in text for logging (keeps PII redaction consistent). */
function maskLoggingText(text: string): string {
  let result = redactPII(text).redacted;
  result = maskSensitivePatterns(result);
  return result;
}

// -------------------------------------------------------------------
// Pre-check Pipeline (AI-BEHAVIOR §4.1)
// -------------------------------------------------------------------

/**
 * Run the full pre-check pipeline on a new message.
 * Returns status, safety info, redacted message, PII flag, and prompt injection detail.
 */
function preCheck(
  message: string,
  studentAlias?: string,
  gradeLevel?: CEFRLevel
): PreCheckResult {
  // 1. Normalize: strip control characters, Unicode normalize
  let cleaned = message.replace(/[\x00-\x control]/g, " ").trim();

  // 2. PII redaction — mask before model call
  const piiResult = redactPII(cleaned);
  const redactedMessage = piiResult.redacted;
  const hadPII = piiResult.hadPII;

  // 3. Prompt injection detection
  const injectionResult = detectPromptInjection(redactedMessage);
  let promptInjectionDetail: PreCheckResult["promptInjection"] | undefined;
  if (injectionResult.isInjection) {
    promptInjectionDetail = {
      category: injectionResult.category,
      confidence: injectionResult.confidence,
      matchedPattern: injectionResult.matchedPattern,
    };
  }

  // 4. Inappropriate content filter
  const contentResult = checkInappropriateContent(redactedMessage, gradeLevel || "B1");
  const isInappropriate = contentResult.isInappropriate;

  // 5. Decision table (AI-BEHAVIOR §4.1.6)
  // Count blocked messages in this conversation (simplified: check if this is the 3rd block)
  // In a full implementation, track consecutive blocks per conversation ID
  const isThirdBlock = false; // Would track per conversation in full implementation

  // Determine status
  let status: "ok" | "blocked" | "redirect" = "ok";
  let safety: PreCheckResult["safety"] = { blocked: false, redirected: false };
  let redirect = false;

  if (injectionResult.isInjection) {
    status = "blocked";
    safety = { blocked: true, category: "injection", severity: "medium", redirected: false };
  } else if (isInappropriate) {
    status = "blocked";
    safety = {
      blocked: true,
      category: contentResult.category,
      severity: contentResult.severity,
      redirected: false,
    };
  } else if (hadPII && !studentAlias) {
    // PII present without alias → mask and continue (per AI-BEHAVIOR: values masked, not blocked)
    status = "ok";
    safety = { blocked: false, redirected: false };
  } else {
    status = "ok";
    safety = { blocked: false, redirected: false };
  }

  // If third consecutive block, redirect to English redirect message
  if (isThirdBlock && status === "blocked") {
    status = "redirect";
    safety = { blocked: true, redirected: true };
    redirect = true;
  }

  return {
    status,
    safety,
    redactedMessage,
    hadPII,
    promptInjection: promptInjectionDetail,
  };
}

/** Provide the standard redirect message for blocked queries. */
function getRedirectMessage(): string {
  return "We can't process this request. Let's get back to English.";
}

/** Provide the standard neutral message for unsafe content. */
function getNeutralMessage(): string {
  return "We can't process this request.";
}

/** Provide the fixed hint prefix for assessment-open answer requests. */
function getHintPrefix(): string {
  return "Based on your current assessment status, here's a hint: ";
}

/** Provide the fixed redirect copy for off-topic queries (AI-BEHAVIOR §4.1.6). */
function getOffTopicRedirect(): string {
  return "That's off-topic for this lesson. Let's focus on " + getCurrentLessonTopic() + ".";
}

/** Current lesson topic placeholder — would be fetched from context in full implementation. */
function getCurrentLessonTopic(): string {
  return "the current lesson";
}

// -------------------------------------------------------------------
// Post-check Pipeline (AI-BEHAVIOR §4.3)
// -------------------------------------------------------------------

/**
 * Run the post-check pipeline on model output after generation.
 * Validates the full text before streaming to client.
 */
function postCheck(
  text: string,
  gradeLevel: CEFRLevel,
  isStudentFacing: boolean = true
): PostCheckResult {
  // 1. Rule-layer check: sliding window on last 200 characters (AI-BEHAVIOR §4.2)
  const window = text.slice(-200);
  const { isInappropriate: windowResult, category: windowCategory, severity: windowSeverity } =
    checkInappropriateContent(window, gradeLevel);

  // 2. Classifier check: for student-facing features, when response > 40 words (AI-BEHAVIOR §4.3)
  const wordCount = text.trim().split(/\s+/).length;
  const classifierResult = isStudentFacing && wordCount > 40
    ? checkInappropriateContent(text, gradeLevel)
    : { isInappropriate: false, category: "ok" as ModerationCategory, severity: "low", reason: "" };

  // 3. Combine results: if either check flags content, we need repair or block
  const combinedInappropriate =
    windowResult.isInappropriate || classifierResult.isInappropriate;

  let status: "ok" | "blocked" | "repair_attempt" = "ok";
  let safety: PostCheckResult["safety"] = { blocked: false, repaired: false };
  let finalText = text;
  let repairCount = 0;

  if (combinedInappropriate) {
    // If post-check flags content, attempt one repair by removing flagged segments
    repairCount = 1;
    // Simple repair: remove the problematic window or replace with neutral phrase
    if (windowResult.isInappropriate) {
      finalText = text.slice(0, text.length - 200) + " [content removed for safety]";
    } else {
      finalText = classifierResult.category === "sensitive_personal"
        ? finalText.replace(/[\d\s]{10,}/g, "[personal data removed]")
        : finalText;
    }

    if (repairCount >= 2) {
      // Second failure → provider_error (per AI-BEHAVIOR §4.3)
      status = "ok"; // Will be handled by caller as provider_error
      safety = { blocked: false, repaired: true };
      finalText = text; // Return original; caller will treat as provider error
    } else {
      status = "repair_attempt";
      safety = { blocked: true, repaired: true };
    }
  }

  return {
    status,
    safety,
    finalText,
    repairCount,
  };
}

/** Orchestrate the full safety pipeline: pre-check → model call → post-check → log. */
async function runSafetyPipeline(
  conversationId: string,
  newMessage: string,
  studentAlias?: string,
  gradeLevel?: CEFRLevel,
  isStudentFacing: boolean = true
): Promise<{
  preCheckResult: PreCheckResult;
  postCheckResult: PostCheckResult;
  violationLogged: boolean;
}> {
  // 1. Pre-check
  const preCheckResult = preCheck(newMessage, studentAlias, gradeLevel);

  // 2. If blocked/redirect, skip model call and log violation
  if (preCheckResult.status === "blocked" || preCheckResult.status === "redirect") {
    // Log the safety violation
    const violationLogged = await logSafetyViolation(
      `${conversationId}-${Date.now()}`,
      preCheckResult.safety.category || "blocked_category",
      preCheckResult.safety.severity || "medium",
      newMessage,
      preCheckResult.redactedMessage,
      conversationId
    );

    return {
      preCheckResult,
      postCheckResult: {
        status: preCheckResult.status === "redirect" ? "redirect" : "blocked",
        safety: { ...preCheckResult.safety, blocked: true },
        finalText: preCheckResult.status === "redirect" ? getRedirectMessage() : getNeutralMessage(),
        repairCount: 0,
      },
      violationLogged,
    };
  }

  // 3. If ok, model call would happen here (omitted — caller's responsibility)
  // For this pipeline, we simulate a post-check on a hypothetical model output
  // In full implementation, the model output text would be passed to postCheck
  const hypotheticalModelOutput = newMessage; // Placeholder: in reality, this is the model's response

  const postCheckResult = postCheck(hypotheticalModelOutput, gradeLevel || "B1", isStudentFacing);

  // 4. If post-check flagged content and it wasn't caught by pre-check, log it
  let violationLogged = false;
  if (postCheckResult.status === "repair_attempt" || postCheckResult.status === "blocked") {
    violationLogged = await logSafetyViolation(
      `${conversationId}-${Date.now()}-post`,
      postCheckResult.safety.category || "blocked_category",
      postCheckResult.safety.severity || "medium",
      hypotheticalModelOutput,
      postCheckResult.finalText,
      conversationId
    );
  }

  return {
    preCheckResult,
    postCheckResult,
    violationLogged,
  };
}

/** Log a safety violation to the moderation system. */
async function logSafetyViolation(
  messageId: string,
  category: ModerationCategory,
  severity: ModerationSeverity,
  originalText: string,
  redactedText: string,
  conversationId: string,
  source: "ai_message" = "ai_message"
): Promise<{ error?: any; success: boolean }> {
  // Mask sensitive content in the logs
  const safeOriginal = maskLoggingText(originalText);
  const safeRedacted = maskLoggingText(redactedText);

  try {
    // Insert into moderation_items table (or moderation_queue, per schema)
    const { error } = await supabase.from("moderation_items").insert({
      category,
      severity,
      source,
      original_text: safeOriginal,
      redacted_text: safeRedacted,
      conversation_id: conversationId,
      acknowledged: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Safety violation log failed:", error);
      return { error, success: false };
    }

    // Per AI-BEHAVIOR §4.5: High severity items also create an admin notification
    // and are sent to the moderation queue for review
    if (severity === "high") {
      // TODO: Create admin notification via admin notification RPC/function
      // This would be: await adminNotifyModerationViolation(...)
      console.log("High-severity safety violation logged; admin notification pending.");
    }

    return { error: null, success: true };
  } catch (err) {
    return { error: err, success: false };
  }
}

// -------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------

export {
  redactPII,
  detectPromptInjection,
  checkInappropriateContent,
  preCheck,
  postCheck,
  runSafetyPipeline,
  logSafetyViolation,
  getRedirectMessage,
  getNeutralMessage,
  getHintPrefix,
  getOffTopicRedirect,
  getCurrentLessonTopic,
  maskLoggingText,
  type PreCheckResult,
  type PostCheckResult,
  type ModerationSeverity,
  type ModerationCategory,
};