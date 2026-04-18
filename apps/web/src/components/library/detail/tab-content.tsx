import { ChatTab } from "./chat-tab";
import { ConceptsTab } from "./concepts-tab";
import { FlashcardsTab } from "./flashcards-tab";
import { QuizzesTab } from "./quizzes-tab";
import { RelatedContentTab } from "./related-tab";
import { SummaryTab } from "./summary-tab";
import type { ContentData, MentorChatHandlers, PanelTab } from "./types";

export function TabContent({
  tab,
  data,
  learningObjectId,
  mentorChat,
}: {
  tab: PanelTab;
  data: ContentData;
  learningObjectId: string;
  mentorChat: MentorChatHandlers;
}) {
  switch (tab) {
    case "Chat":
      return <ChatTab learningObjectId={learningObjectId} mentorChat={mentorChat} />;
    case "Summary":
      return <SummaryTab data={data} />;
    case "Concepts":
      return <ConceptsTab data={data} />;
    case "Quizzes":
      return <QuizzesTab learningObjectId={learningObjectId} />;
    case "Related":
      return <RelatedContentTab learningObjectId={learningObjectId} />;
    case "Flashcards":
      return <FlashcardsTab data={data} learningObjectId={learningObjectId} />;
    default:
      return null;
  }
}
