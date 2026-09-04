import type { LearningContent } from "../app/types";
import { BALLOON_ATTACK_CONTENT } from "./balloon-attack";
import { CLOCK_READING_CONTENT } from "./clock-reading";
import { DOTBURST_CONTENT } from "./dotburst";
import { FLASHCARD_CONTENT } from "./flashcard";
import { FIT_SHAPE_CONTENT } from "./fit-shape";
import { KAKITORI_CONTENT } from "./kakitori";
import { LARGER_NUMBER_CONTENT } from "./larger-number";
import { LISTENING_MISSION_CONTENT } from "./listening-mission";
import { NUMBER_SEQUENCE_CONTENT } from "./number-sequence";
import { PENCIL_PRACTICE_CONTENT } from "./pencil-practice";

export const LEARNING_CONTENTS: LearningContent[] = [
  BALLOON_ATTACK_CONTENT,
  LISTENING_MISSION_CONTENT,
  FIT_SHAPE_CONTENT,
  FLASHCARD_CONTENT,
  DOTBURST_CONTENT,
  NUMBER_SEQUENCE_CONTENT,
  LARGER_NUMBER_CONTENT,
  CLOCK_READING_CONTENT,
  PENCIL_PRACTICE_CONTENT,
  KAKITORI_CONTENT,
];
