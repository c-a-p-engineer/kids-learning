import type { LearningContent } from "../app/types";
import { DOTBURST_CONTENT } from "./dotburst";
import { FLASHCARD_CONTENT } from "./flashcard";
import { FIT_SHAPE_CONTENT } from "./fit-shape";
import { KAKITORI_CONTENT } from "./kakitori";
import { LARGER_NUMBER_CONTENT } from "./larger-number";
import { NUMBER_SEQUENCE_CONTENT } from "./number-sequence";

export const LEARNING_CONTENTS: LearningContent[] = [
  FIT_SHAPE_CONTENT,
  FLASHCARD_CONTENT,
  DOTBURST_CONTENT,
  NUMBER_SEQUENCE_CONTENT,
  LARGER_NUMBER_CONTENT,
  KAKITORI_CONTENT,
];
