import { ChatMessage, ChatThread } from "@/shared/components/ai";

export interface TutorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface MessageFeedProps {
  messages: TutorMessage[];
  streamingLabel?: string | undefined;
}

export function MessageFeed({ messages, streamingLabel }: MessageFeedProps) {
  return (
    <ChatThread label="AI Tutor conversation" className="min-h-[420px] flex-1">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          role={message.role}
          content={message.content}
          assistantName="Pip"
          userName="You"
        />
      ))}
      {streamingLabel && (
        // eslint-disable-next-line jsx-a11y/aria-role -- `role` is ChatMessage's own speaker prop, not an ARIA role.
        <ChatMessage role="assistant" content={streamingLabel} streaming assistantName="Pip" />
      )}
    </ChatThread>
  );
}
