import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { FormField } from "@/shared/components/ui/FormField";
import { Input } from "@/shared/components/ui/Input";
import { Select } from "@/shared/components/ui/Select";
import { Textarea } from "@/shared/components/ui/Textarea";
import { useToast } from "@/shared/hooks/useToast";
import {
  EMPTY_INQUIRY,
  INQUIRY_CATEGORIES,
  INQUIRY_FIELDS,
  MESSAGE_MAX,
  NAME_MAX,
  REF_MAX,
  submitInquiry,
  validateField,
  validateInquiry,
  type InquiryErrors,
  type InquiryField,
  type InquiryValues,
} from "./inquiry";

/* The inquiry form of the Help page (PUB-08). Validation runs when a field is left and again on
   submit; the first invalid field gets focus. A successful send shows a toast and a
   confirmation, then empties the form. A failed send says so and points to the contact
   details on this page, and keeps what the person typed. */

const FIELD_IDS: Record<InquiryField, string> = {
  name: "inquiry-name",
  studentRef: "inquiry-student-ref",
  category: "inquiry-category",
  message: "inquiry-message",
};

export interface ContactFormProps {
  /** Values to start with, for example a category and message from an Error ID link. */
  initialValues?: Partial<InquiryValues> | undefined;
}

type Status = "idle" | "sending" | "sent" | "failed";

export function ContactForm({ initialValues }: ContactFormProps) {
  const toast = useToast();
  const [values, setValues] = useState<InquiryValues>({ ...EMPTY_INQUIRY, ...initialValues });
  const [touched, setTouched] = useState<Partial<Record<InquiryField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const confirmationRef = useRef<HTMLDivElement>(null);

  const errors: InquiryErrors = {};
  for (const field of INQUIRY_FIELDS) {
    if (touched[field] === true || submitted) {
      const message = validateField(field, values);
      if (message) errors[field] = message;
    }
  }

  const update = <K extends InquiryField>(field: K, value: InquiryValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (status === "sent" || status === "failed") setStatus("idle");
  };
  const blur = (field: InquiryField) => setTouched((current) => ({ ...current, [field]: true }));
  const onText =
    (field: "name" | "studentRef" | "message") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update(field, event.target.value);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    setSubmitted(true);

    const found = validateInquiry(values);
    const firstInvalid = INQUIRY_FIELDS.find((field) => found[field] !== undefined);
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      return;
    }

    setStatus("sending");
    try {
      await submitInquiry(values);
    } catch {
      setStatus("failed");
      return;
    }
    toast.show({
      type: "success",
      title: "Message sent",
      description: "Thank you. The school has received your message.",
    });
    setValues(EMPTY_INQUIRY);
    setTouched({});
    setSubmitted(false);
    setStatus("sent");
    requestAnimationFrame(() => confirmationRef.current?.focus());
  };

  const sending = status === "sending";

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)} aria-label="Send a message">
      <div
        ref={confirmationRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="outline-none"
      >
        {status === "sent" && (
          <p className="mb-5 flex items-start gap-3 rounded-[14px] border-2 border-stroke bg-world-mint-100 p-4 text-[15px] font-semibold text-stroke shadow-retro-sm">
            <CheckCircle2 aria-hidden="true" size={22} strokeWidth={2.5} className="shrink-0" />
            Message sent. Thank you, the school has received it.
          </p>
        )}
      </div>
      {status === "failed" && (
        <p
          role="alert"
          className="mb-5 rounded-[14px] border-2 border-danger-600 bg-danger-100 p-4 text-[15px] text-stroke"
        >
          We could not send your message. Your text is still here. Try again in a minute, or use the
          contact details above.
        </p>
      )}

      <div className="space-y-5">
        <Input
          id={FIELD_IDS.name}
          label="Your name"
          required
          autoComplete="name"
          maxLength={NAME_MAX}
          value={values.name}
          onChange={onText("name")}
          onBlur={() => blur("name")}
          error={errors.name}
          disabled={sending}
        />
        <Input
          id={FIELD_IDS.studentRef}
          label="Student ID or grade and class"
          autoComplete="off"
          maxLength={REF_MAX}
          helperText="Optional. For example 8B or your student ID."
          value={values.studentRef}
          onChange={onText("studentRef")}
          onBlur={() => blur("studentRef")}
          error={errors.studentRef}
          disabled={sending}
        />
        <FormField
          id={FIELD_IDS.category}
          label="What is it about?"
          required
          error={errors.category}
        >
          <Select
            placeholder="Choose a topic"
            value={values.category}
            onValueChange={(value) => {
              update("category", value as InquiryValues["category"]);
              blur("category");
            }}
            options={INQUIRY_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            disabled={sending}
          />
        </FormField>
        <Textarea
          id={FIELD_IDS.message}
          label="Your message"
          required
          rows={6}
          maxLength={MESSAGE_MAX}
          showCount
          helperText="Never write your password here."
          value={values.message}
          onChange={onText("message")}
          onBlur={() => blur("message")}
          error={errors.message}
          disabled={sending}
        />
      </div>

      <div className="mt-6">
        <Button type="submit" size="lg" loading={sending}>
          {sending ? "Sending" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
