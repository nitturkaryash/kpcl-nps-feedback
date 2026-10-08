/*
 * KPCL feedback content. Edit questions, rating bands, and problem types here.
 *
 * Question wording is copied verbatim from KPCL's sheet
 * (kpcl_chatbot.xlsx, tab "Testing Remarks 9.7.26", cell D36).
 * Do not correct or reword it; KPCL reviews the exact text.
 * The "(Yes/No)", "(Remarks)" and "(1 to 10)" markers from the sheet are
 * expressed through `type` instead of the text.
 */

export type QuestionnaireType = 'warranty' | 'commissioning'

export type QuestionType = 'yesno' | 'remarks' | 'rating'

export interface Question {
  /** KPCL's own question number. */
  number: number
  text: string
  type: QuestionType
}

export interface Questionnaire {
  title: string
  questions: Question[]
}

export const QUESTIONNAIRES: Record<QuestionnaireType, Questionnaire> = {
  warranty: {
    title: 'Warranty & Post Warranty call Questionnaire',
    questions: [
      { number: 1, type: 'yesno', text: 'Did you receive a call from the service engineer after filing a complaint?' },
      { number: 2, type: 'yesno', text: 'Did engineers visit on time and were cooperative with you?' },
      { number: 3, type: 'yesno', text: 'If Problem Solved or not & compressor in running condition?' },
      { number: 4, type: 'yesno', text: 'Did the problem resolved on the first visit?' },
      { number: 5, type: 'yesno', text: 'Complaint understood by SE & SE attainted with necessary tools and tackles?' },
      { number: 6, type: 'yesno', text: 'Did SE attained site 2 hours post completion of Job?' },
      { number: 7, type: 'yesno', text: 'Was SE technically competent to solve complaints?' },
      { number: 8, type: 'yesno', text: 'Are you satisfied with the service provided?' },
      { number: 9, type: 'remarks', text: 'Any suggestions for service improvement?' },
      { number: 10, type: 'rating', text: 'How do you rate overall service support of KPCL?' },
    ],
  },
  commissioning: {
    title: 'Commissioning call Questionnaire',
    questions: [
      { number: 1, type: 'yesno', text: 'Did you receive a call from the service engineer after filing a complaint?' },
      { number: 2, type: 'yesno', text: 'Did the engineers visit on time and were cooperative with you?' },
      { number: 3, type: 'yesno', text: 'Did Engineers explain to you about operations and maintenance?' },
      { number: 4, type: 'yesno', text: 'Did you sign the commissioning report?' },
      { number: 5, type: 'yesno', text: 'SE technically competent?' },
      { number: 6, type: 'yesno', text: 'Is compressor in running condition?' },
      { number: 7, type: 'yesno', text: 'Are you satisfied with the service provided?' },
      { number: 8, type: 'remarks', text: 'Any suggestions for service improvement?' },
      { number: 9, type: 'rating', text: 'How do you rate overall service support of KPCL?' },
    ],
  },
}

export const REMARKS_PLACEHOLDER = 'Write your remarks or suggestions'

export type RatingFace = 'sad' | 'neutral' | 'happy'

export interface RatingBand {
  /** Word shown under the range. KPCL may change these. */
  label: string
  from: number
  to: number
  color: string
  face: RatingFace
}

export const RATING_MIN = 1
export const RATING_MAX = 10

/** Must cover RATING_MIN..RATING_MAX without gaps or overlaps. */
export const RATING_BANDS: RatingBand[] = [
  { label: 'Poor', from: 1, to: 6, color: '#D92D20', face: 'sad' },
  { label: 'Neutral', from: 7, to: 8, color: '#F5A300', face: 'neutral' },
  { label: 'Good', from: 9, to: 10, color: '#16A34A', face: 'happy' },
]

/*
 * Problem types from the "Problems Dropdown" tab of kpcl_chatbot.xlsx.
 * Spelling is kept as in the sheet so links built from it match.
 * Problems listed in COMMISSIONING_PROBLEMS use the commissioning questions;
 * every other problem uses the warranty questions.
 */
export const COMMISSIONING_PROBLEMS = [
  'Commissioning of Compressor',
  'Compressor Recommissioning',
  'KRMS Commissioning',
]

export const WARRANTY_PROBLEMS = [
  'Abnormal Sound complaint',
  'AMC Service',
  'Ammonia Leakage Issue',
  'Baseframe Issue',
  'Compressor Hardware Damage',
  'Compressor Serial No Plate Change',
  'Compressor Tripping Issue',
  'Compressor Welding Leakage',
  'Coupling Issue',
  'Couresy Visit',
  'Crankshaft Damaged',
  'Flywheel Wobbling complaint',
  'Gauge Board Panel Issue',
  'Guage Board Panel Installation',
  'High Oil Carryover Complaint',
  'High Vibration complaint',
  'KRMS Panel Issue',
  'Loading / Unloading problem',
  'Oil Leakage Problem',
  'Oil Pump Problem',
  'Oil Seperator Issue',
  'ORV Leakage Issue',
  'Overhauling of compressor',
  'Overheating of Compressor',
  'Paint Issue',
  'Preventive Maintainance Service',
  'Refreigeration System Issue',
  'Shaft Seal Leakage complaint',
]

/** The sheet's "Other (------------)" entry: any type starting with "Other". */
export const OTHER_PROBLEM_PREFIX = 'Other'

/** Direct `type` values accepted besides problem names. */
export const TYPE_ALIASES: Record<string, QuestionnaireType> = {
  warranty: 'warranty',
  'post warranty': 'warranty',
  'post-warranty': 'warranty',
  postwarranty: 'warranty',
  commissioning: 'commissioning',
}
