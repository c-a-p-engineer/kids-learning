import type { LearningContent } from "../app/types";
import { DOTBURST_CONTENT } from "./dotburst";
import { FLASHCARD_CONTENT } from "./flashcard";
import { KAKITORI_CONTENT } from "./kakitori";
import { LARGER_NUMBER_CONTENT } from "./larger-number";

export const LEARNING_CONTENTS: LearningContent[] = [
  KAKITORI_CONTENT,
  DOTBURST_CONTENT,
  FLASHCARD_CONTENT,
  LARGER_NUMBER_CONTENT,
];
