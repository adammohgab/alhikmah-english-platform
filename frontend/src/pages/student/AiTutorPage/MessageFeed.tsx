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

const ASSISTANT_ROLE: TutorMessage["role"] = "assistant";

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
<<<<<<< HEAD
        <ChatMessage
          role={"assistant" as const}
          content={streamingLabel}
          streaming
          assistantName="Pip"
        />
=======
        <ChatMessage role={ASSISTANT_ROLE} content={streamingLabel} streaming assistantName="Pip" />
>>>>>>> db2dafd63d37787f56813d0a14ae4e00e5ee088c
      )}
    </ChatThread>
  );
}
