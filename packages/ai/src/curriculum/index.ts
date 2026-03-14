export { generateCurriculum, type CurriculumInput } from "./generate";
export { generateModularCourse, type ModularCourseInput } from "./generate-modular";
export {
  getMethodDefaults,
  getEducationStagePrompt,
  getProfilePrompt,
  getMethodWeights,
  getDefaultLearningMode,
  getSessionDefaults,
  type MethodDefaults,
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
export { generateBlockContent } from "./blocks";
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
