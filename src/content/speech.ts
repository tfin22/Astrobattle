/**
 * Everything VORG says. All lines are original to Quantum Cadet.
 *
 * Each line has subtitle text and a phoneme string for the synthesiser
 * (see audio/phonemes.ts for the symbols: digits are pitch levels 0-3,
 * '|' a word gap, ',' a short pause, '.' a long one).
 * {RANK} is replaced by the player's current rank, in text and in speech.
 */
export interface SpeechLine {
  text: string;
  ph: string;
}

export type Priority = 'high' | 'low';

export interface Trigger {
  /** High: always said (waits for the current line). Low: dropped while VORG is busy or cooling down. */
  priority: Priority;
  lines: SpeechLine[];
}

const VORG = 'V AO2 R G';

export const TRIGGERS: Record<string, Trigger> = {
  attract: {
    priority: 'high',
    lines: [
      { text: 'WELCOME, SMALL HUMAN.', ph: 'W EH1 L K AH M , S M AO2 L | HH Y UW1 M AH0 N .' },
      { text: 'INSERT COIN. VORG IS HUNGRY.', ph: `IH N S ER2 T | K OY1 N . ${VORG} | IH Z | HH AH1 NG G R IY0` },
      { text: 'VORG AWAITS A CHALLENGER.', ph: `${VORG} | AH W EY1 T S | AH | CH AE1 L AH N JH ER0` },
      { text: 'ALL HUMANS ARE CADETS.', ph: 'AO1 L | HH Y UW M AH N Z | AA R | K AH D EH2 T S' },
      { text: 'COME CLOSER. VORG IS BORED.', ph: `K AH1 M | K L OW2 S ER . ${VORG} | IH Z | B AO1 R D` },
      { text: 'THE ARCADE BELONGS TO VORG.', ph: `DH AH | AA R K EY2 D | B IH L AO1 NG Z | T UW | ${VORG}` },
    ],
  },
  coin: {
    priority: 'high',
    lines: [
      { text: 'COIN ACCEPTED. FOOLISH.', ph: 'K OY1 N | AE K S EH2 P T IH D . F UW1 L IH SH' },
      { text: 'DELICIOUS COIN.', ph: 'D IH L IH2 SH AH S | K OY1 N' },
      { text: 'PAYMENT RECEIVED. DOOM PENDING.', ph: 'P EY1 M AH N T | R IH S IY2 V D . D UW1 M | P EH2 N D IH NG' },
      { text: 'ANOTHER DONATION TO VORG.', ph: `AH N AH2 DH ER | D OW N EY1 SH AH N | T UW | ${VORG}` },
    ],
  },
  gameStart: {
    priority: 'high',
    lines: [
      { text: 'PREPARE TO BE CORRECTED.', ph: 'P R IH P EH2 R | T UW | B IY | K ER EH1 K T IH D' },
      { text: 'VORG ENJOYS A WARM UP.', ph: `${VORG} | EH N JH OY1 Z | AH | W AO2 R M | AH P` },
      { text: 'BEGIN YOUR BRIEF CAREER.', ph: 'B IH G IH2 N | Y AO R | B R IY1 F | K ER IY2 R' },
      { text: 'VORG HAS BEEN EXPECTING YOU.', ph: `${VORG} | HH AE Z | B IH N | IH K S P EH1 K T IH NG | Y UW2` },
    ],
  },
  missionShieldWall: {
    priority: 'high',
    lines: [
      { text: 'YOUR SHIELD IS DECORATIVE.', ph: 'Y AO R | SH IY2 L D | IH Z | D EH1 K ER AH T IH V' },
      { text: 'HIDE BEHIND YOUR LITTLE WALL.', ph: 'HH AY1 D | B IH HH AY2 N D | Y AO R | L IH1 T AH L | W AO2 L' },
      { text: 'THE WALL WILL NOT SAVE YOU.', ph: 'DH AH | W AO1 L | W IH L | N AA2 T | S EY1 V | Y UW' },
    ],
  },
  missionLaserAttack: {
    priority: 'high',
    lines: [
      { text: 'STAND STILL. IT HELPS.', ph: 'S T AE1 N D | S T IH2 L . IH T | HH EH1 L P S' },
      { text: 'VORG LASERS ARE WARM TODAY.', ph: `${VORG} | L EY1 Z ER Z | AA R | W AO2 R M | T AH D EY1` },
      { text: 'LOOK UP, {RANK}.', ph: 'L UH1 K | AH2 P , {RANK}' },
    ],
  },
  missionSwarm: {
    priority: 'high',
    lines: [
      { text: 'THE SWARM IS HUNGRY TOO.', ph: 'DH AH | S W AO1 R M | IH Z | HH AH2 NG G R IY | T UW1' },
      { text: 'MANY ROBOTS. ONE OF YOU.', ph: 'M EH1 N IY | R OW2 B AA T S . W AH1 N | AH V | Y UW2' },
      { text: 'COUNT THEM. VORG WILL WAIT.', ph: `K AW1 N T | DH EH M . ${VORG} | W IH L | W EY1 T` },
    ],
  },
  missionSpaceWarp: {
    priority: 'high',
    lines: [
      { text: 'ENTER THE VORTEX. OR NOT.', ph: 'EH1 N T ER | DH AH | V AO2 R T EH K S . AO R | N AA1 T' },
      { text: 'SPACE IS FOLDING. MIND YOUR HEAD.', ph: 'S P EY1 S | IH Z | F OW2 L D IH NG . M AY1 N D | Y AO R | HH EH2 D' },
      { text: 'THEY GROW UP SO FAST.', ph: 'DH EY | G R OW1 | AH P | S OW2 | F AE1 S T' },
    ],
  },
  missionFlagship: {
    priority: 'high',
    lines: [
      { text: 'BEHOLD THE FLAGSHIP.', ph: 'B IH HH OW2 L D | DH AH | F L AE1 G SH IH P' },
      { text: 'DO NOT TOUCH THE REACTOR.', ph: 'D UW | N AA2 T | T AH1 CH | DH AH | R IY AE1 K T ER' },
      { text: 'VORG IS ABOARD. PROBABLY.', ph: `${VORG} | IH Z | AH B AO1 R D . P R AA2 B AH B L IY` },
    ],
  },
  playerDeath: {
    priority: 'high',
    lines: [
      { text: 'VORG IS NOT IMPRESSED.', ph: `${VORG} | IH Z | N AA1 T | IH M P R EH2 S T` },
      { text: 'ANOTHER ONE FOR THE PILE.', ph: 'AH N AH2 DH ER | W AH1 N | F AO R | DH AH | P AY1 L' },
      { text: 'TOO SLOW, {RANK}.', ph: 'T UW1 | S L OW2 , {RANK}' },
      { text: 'THAT WAS YOUR SHIP.', ph: 'DH AE1 T | W AA Z | Y AO R | SH IH2 P' },
      { text: 'DELIGHTFUL.', ph: 'D IH L AY1 T F AH L' },
      { text: 'VORG SAW THAT COMING.', ph: `${VORG} | S AO1 | DH AE T | K AH1 M IH NG` },
      { text: 'PLEASE TRY AGAIN. SLOWLY.', ph: 'P L IY1 Z | T R AY2 | AH G EH1 N . S L OW1 L IY' },
    ],
  },
  lastShip: {
    priority: 'high',
    lines: [
      { text: 'LAST SHIP. VORG IS EXCITED.', ph: `L AE1 S T | SH IH2 P . ${VORG} | IH Z | IH K S AY1 T IH D` },
      { text: 'ONE LEFT. MAKE IT COUNT.', ph: 'W AH1 N | L EH2 F T . M EY1 K | IH T | K AW2 N T' },
    ],
  },
  nearMiss: {
    priority: 'low',
    lines: [
      { text: 'CLOSE. VORG IS TAKING NOTES.', ph: `K L OW1 S . ${VORG} | IH Z | T EY1 K IH NG | N OW2 T S` },
      { text: 'LUCKY HUMAN.', ph: 'L AH1 K IY | HH Y UW2 M AH N' },
      { text: 'VORG MISSED ON PURPOSE.', ph: `${VORG} | M IH1 S T | AA N | P ER2 P AH S` },
      { text: 'STAND STILL NEXT TIME.', ph: 'S T AE1 N D | S T IH2 L | N EH1 K S T | T AY M' },
      { text: 'SO NEAR. SO DULL.', ph: 'S OW1 | N IY2 R . S OW1 | D AH2 L' },
    ],
  },
  missStreak: {
    priority: 'low',
    lines: [
      { text: 'ONE SHOT. HOW QUAINT.', ph: 'W AH1 N | SH AA2 T . HH AW1 | K W EY2 N T' },
      { text: 'AIM IS A SKILL. LEARN IT.', ph: 'EY1 M | IH Z | AH | S K IH2 L . L ER1 N | IH T' },
      { text: 'THE STARS THANK YOU.', ph: 'DH AH | S T AA1 R Z | TH AE2 NG K | Y UW' },
      { text: 'MISSING IS FREE. ENJOY.', ph: 'M IH1 S IH NG | IH Z | F R IY2 . EH N JH OY1' },
      { text: 'VORG FEELS NOTHING.', ph: `${VORG} | F IY1 L Z | N AH2 TH IH NG` },
    ],
  },
  extraLife: {
    priority: 'low',
    lines: [
      { text: 'MORE SHIPS. MORE SCRAP.', ph: 'M AO1 R | SH IH2 P S . M AO1 R | S K R AE2 P' },
      { text: 'A SPARE? HOW TEDIOUS.', ph: 'AH | S P EH1 R . HH AW1 | T IY2 D IY AH S' },
      { text: 'VORG ALLOWS IT. THIS TIME.', ph: `${VORG} | AH L AW1 Z | IH T . DH IH S | T AY1 M` },
    ],
  },
  promotion: {
    priority: 'high',
    lines: [
      { text: 'A NEW {RANK}. HOW BRIEF.', ph: 'AH | N UW1 | {RANK} . HH AW1 | B R IY2 F' },
      { text: 'PROMOTED. VORG IS FURIOUS.', ph: `P R AH M OW1 T IH D . ${VORG} | IH Z | F Y UH1 R IY AH S` },
      { text: 'ENJOY YOUR RANK, {RANK}.', ph: 'EH N JH OY1 | Y AO R | R AE2 NG K , {RANK}' },
      { text: 'THE LOOP BEGINS AGAIN.', ph: 'DH AH | L UW1 P | B IH G IH2 N Z | AH G EH1 N' },
    ],
  },
  flagshipDestroyed: {
    priority: 'high',
    lines: [
      { text: 'THAT REACTOR WAS EXPENSIVE.', ph: 'DH AE T | R IY AE1 K T ER | W AA Z | IH K S P EH2 N S IH V' },
      { text: 'VORG WILL BUILD ANOTHER.', ph: `${VORG} | W IH L | B IH1 L D | AH N AH2 DH ER` },
      { text: 'IMPOSSIBLE. AGAIN.', ph: 'IH M P AA1 S AH B AH L . AH G EH2 N' },
      { text: 'THAT WAS NOT INSURED.', ph: 'DH AE T | W AA Z | N AA1 T | IH N SH UH2 R D' },
    ],
  },
  highScore: {
    priority: 'high',
    lines: [
      { text: 'A HIGH SCORE. VORG WILL DELETE IT.', ph: `AH | HH AY1 | S K AO2 R . ${VORG} | W IH L | D IH L IY1 T | IH T` },
      { text: 'WRITE YOUR NAME. VORG WILL FORGET.', ph: `R AY1 T | Y AO R | N EY2 M . ${VORG} | W IH L | F ER G EH1 T` },
      { text: 'IMPRESSIVE. FOR A HUMAN.', ph: 'IH M P R EH1 S IH V . F AO R | AH | HH Y UW2 M AH N' },
    ],
  },
  gameOver: {
    priority: 'high',
    lines: [
      { text: 'GAME OVER. VORG WINS AGAIN.', ph: `G EY1 M | OW2 V ER . ${VORG} | W IH1 N Z | AH G EH2 N` },
      { text: 'GOODBYE, {RANK}.', ph: 'G UH D B AY1 , {RANK}' },
      { text: 'INSERT COIN TO SUFFER MORE.', ph: 'IH N S ER1 T | K OY2 N | T UW | S AH1 F ER | M AO2 R' },
      { text: 'THE END. VORG IS SATISFIED.', ph: `DH IY | EH1 N D . ${VORG} | IH Z | S AE1 T IH S F AY D` },
      { text: 'RETURN WHEN YOU ARE BETTER.', ph: 'R IH T ER1 N | W EH N | Y UW | AA R | B EH2 T ER' },
    ],
  },
};

export type TriggerName = keyof typeof TRIGGERS;

/** Every line, flattened (tests, debug menu). */
export function allLines(): { trigger: string; index: number; line: SpeechLine }[] {
  const out: { trigger: string; index: number; line: SpeechLine }[] = [];
  for (const [trigger, t] of Object.entries(TRIGGERS)) t.lines.forEach((line, index) => out.push({ trigger, index, line }));
  return out;
}
