export {
  generateCourseSkeleton,
  completeCourseGeneration,
  rehydrateSkeletonFromDb,
  MAX_GENERATION_ERROR_LENGTH,
  type CourseSkeleton,
  type ModularCourseInput,
} from "./generate-modular";
export {
  getEducationStagePrompt,
  getProfilePrompt,
  getMethodWeights,
  getDefaultLearningMode,
  getSessionDefaults,
} from "./method-defaults";
export {
  getNextLesson,
  evaluateModuleStatus,
  isModuleSkipEligible,
  getCourseRoadmap,
  generateCatchUpSuggestion,
  getWelcomeBackSuggestion,
  type NextLessonResult,
  type CatchUpSuggestion,
  type WelcomeBackResult,
} from "./path-engine";
export {
  generateBlockContent,
  preGeneratePendingBlocks,
  type PendingLessonBlock,
} from "./blocks";
export type {
  BlockContent,
  ConceptBlockContent,
  CheckpointBlockContent,
  PracticeBlockContent,
  ReflectionBlockContent,
  ScenarioBlockContent,
  WorkedExampleBlockContent,
  MentorBlockContent,
} from "./blocks";
export {
  generateTeaserCardsStream,
  buildTeaserPrompt,
  TeaserCardSchema,
  type TeaserCard,
  type TeaserInput,
} from "./generate-teasers";
