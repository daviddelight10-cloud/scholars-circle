/**
 * Deterministic communication-skill analyzer for the virtual patient.
 * Every metric is computed locally from the transcript — regex/heuristics,
 * not the LLM — so feedback is reproducible and cheap. AI communication
 * scores drift between providers; these don't.
 */

const JARGON = [
  "myocardial", "cerebrovascular", "hypertension", "hyperglyc", "hypoglyc", "angina",
  "syncope", "haematuria", "hematuria", "dyspnoea", "dyspnea", "tachycardia",
  "bradycardia", "tachypnoea", "tachypnea", "ischaemi", "ischemi", "malignan",
  "benign", "thrombos", "emboli", "stenosis", "oedema", "edema", "peritonitis",
  "appendicitis", "pancreatitis", "aetiology", "etiology", "idiopathic", "lesion",
  "contraindicat", "prophyla", "anaemi", "anemi", "jaundice", "hepatomegaly",
  "nephrolithi", "melaena", "melena", "haematemesis", "hematemesis", "cyanosis",
  "pallor", "orthopnoea", "orthopnea", "paroxysm", "hyperlipid", "nystagmus",
  "diplopia", "haemoptysis", "hemoptysis", "oliguria", "polyuria", "polydipsia",
  "stenos", "palpitation", "exacerbation", "comorbid", "prodrom", "pyrexia",
  "diuretic", "anticoagul", "thromboly", "endoscop", "colposcop", "neoplasm",
];

const RX = {
  introduced: /\b(i'?m|i am|my name'?s? (is )?)\b.{0,60}\b(dr\.?|doctor|student|nurse|physician|clinician)\b/i,
  identity: /\b(your name|what'?s your name|who am i (speaking|talking)|full name|date of birth|date of birth|\bdob\b|confirm.{0,20}(name|age)|can i (take|get) your)\b/i,
  openQ: /^(so,? )?(how (has|have|does|is|are|would|do|did|long|often|bad|severe)|tell me|describe|what('s| is| are| do| does| did| was| were| have| has| kind| sort| happened| brings| seems| seems| feels)|can you (tell|describe|explain)|walk me|talk me|when did|why do you think|what do you|anything else)/i,
  closedQ: /^(do|did|does|have|has|are|is|was|were|can|could|any|ever|would|will|about)\b/i,
  signpost: /\b(let me (now )?(ask|move|check|examine|explain|go)|i'?d like to (now )?(ask|move|check|examine)|now (i'?d like|i'?m going|let'?s)|moving on to|first.{0,30}then|i'?ll (start|begin|begin by)|before we (move|finish)|shall we|next i'?d like)\b/i,
  iceAsk: /\b(worr(y|ied|ies|ying)|concern(ed|s|ing)?|afraid|scar(ed|y)|fear|idea(s)?.{0,30}(about|of|on|what)|expect(ed|ations?|ing)?.{0,30}(this|the|today|from|is)|what do you think.{0,40}(is|might|could|wrong|happen)|thought it (might|could|was)|what('s| is) (on your mind|bothering|worrying) you|any (idea|thought)s? (about|of|on))\b/i,
  empathy: /\b(i'?m (really |so |very |truly )?sorry|sorry to hear|that sounds (really |very |quite |so )?(hard|difficult|tough|scary|frightening|awful|painful|hard)|i understand|i can (only )?imagine|that must (be|have been|feel)|sounds (really |very |quite )?(distressing|upsetting|worrying)|glad you (told|came)|thank you for (telling|sharing|being)|that'?s understandable|completely understand|take your time)\b/i,
  summarise: /\b(sum(mari[sz]e| up)|recap|just to (check|confirm|make sure|clarify)|so (what|if) i'?ve (got|understood|heard)|let me make sure i (got|understand)|if i understand (correctly|right)|so (you'?re|you are) (saying|telling)|to make sure i'?ve got this)\b/i,
  safetyNet: /\b(if (it|things|your|the) (get?s|becomes?|feel?s?) (any )?(worse|worser)|comes? (straight )?back|come back (if|if you)|call (an ambulance|999|911|112|your gp)|seek (urgent|immediate|emergency|help)|emergency (department|room|care)|a&e|er right away|return if|if you (notice|develop|get) (any )?(new|more|worsening)|red flag|right away|immediately (if|call|seek|come))\b/i,
  rapport: /\b(thank you|thanks (for|so much)|appreciate|nice (to meet|talking)|take care|no worries|of course|absolutely|certainly|sure)\b/i,
};

const wc = (t) => t.trim().split(/\s+/).filter(Boolean).length;

/**
 * Analyze the transcript (messages: [{role:"doc"|"pt", text}]).
 * Returns { metrics: [{key,label,hit,detail,tip}], score: 0-10, raw }
 */
export function analyzeCommunication(messages) {
  const docMsgs = messages.filter((m) => m.role === "doc").map((m) => m.text);
  const ptMsgs = messages.filter((m) => m.role === "pt").map((m) => m.text);
  const docWords = docMsgs.reduce((t, m) => t + wc(m), 0);
  const ptWords = ptMsgs.reduce((t, m) => t + wc(m), 0);

  // Ignore bracketed stage directions like "[Examines: Vitals]" for Q analysis.
  // Classify per SENTENCE — "That sounds awful. Tell me about the pain." still
  // counts as an open question.
  const questions = docMsgs.filter((t) => !t.startsWith("["));
  const sentences = questions
    .flatMap((t) => t.split(/(?<=[?!.])\s+/g))
    .map((s) => s.trim())
    .filter(Boolean);
  const qMsgs = sentences.filter((t) => /\?\s*$|^(who|what|where|when|why|how|do|did|does|have|has|are|is|was|were|can|could|tell|describe|any|would)\b/i.test(t));
  const open = qMsgs.filter((t) => RX.openQ.test(t)).length;
  const closed = qMsgs.filter((t) => RX.closedQ.test(t)).length;
  const openRatio = qMsgs.length ? open / qMsgs.length : 0;

  const early = questions.slice(0, 4).join(" ");
  const all = questions.join(" ");

  const jargonHits = {};
  questions.forEach((t) => {
    JARGON.forEach((j) => {
      if (t.toLowerCase().includes(j)) jargonHits[j] = (jargonHits[j] || 0) + 1;
    });
  });
  const jargonList = Object.keys(jargonHits);

  const metrics = [
    {
      key: "introduced", label: "Introduced yourself",
      hit: RX.introduced.test(early),
      detail: RX.introduced.test(early) ? "Detected in your opening lines" : "No self-introduction found in your first messages",
      tip: "Open with 'Hello, my name is …, I'm one of the medical students/doctors.'",
    },
    {
      key: "identity", label: "Confirmed patient identity",
      hit: RX.identity.test(early),
      detail: RX.identity.test(early) ? "Asked name/DOB early in the consult" : "Never confirmed who you're speaking to",
      tip: "Check name + age/DOB before starting: 'Can I just confirm your name and date of birth?'",
    },
    {
      key: "openQ", label: "Used open questions",
      hit: qMsgs.length > 0 && openRatio >= 0.2,
      detail: `${open} open / ${closed} closed of ${qMsgs.length} question${qMsgs.length === 1 ? "" : "s"} (${Math.round(openRatio * 100)}% open)`,
      tip: "Funnel: open ('Tell me about the pain') → focused ('Does it move anywhere?') → closed.",
    },
    {
      key: "signpost", label: "Signposted structure",
      hit: RX.signpost.test(all),
      detail: RX.signpost.test(all) ? "Told the patient what you'd do next" : "No signposting detected",
      tip: "'Now I'd like to ask some questions about your general health, if that's okay.'",
    },
    {
      key: "ice", label: "Explored ICE (ideas · concerns · expectations)",
      hit: RX.iceAsk.test(all),
      detail: RX.iceAsk.test(all) ? "Asked about the patient's worries, ideas or expectations" : "Never asked what the patient thinks or fears",
      tip: "'Do you have any idea what might be causing this? Is there anything that worries you about it?'",
    },
    {
      key: "empathy", label: "Showed empathy",
      hit: RX.empathy.test(all),
      detail: RX.empathy.test(all) ? "Acknowledged the patient's feelings verbally" : "No explicit empathic statements detected",
      tip: "'That sounds really frightening — thank you for telling me.'",
    },
    {
      key: "summarise", label: "Summarised back",
      hit: RX.summarise.test(all),
      detail: RX.summarise.test(all) ? "Checked your understanding out loud" : "Never summarised back to the patient",
      tip: "'Just so I've got this right — the pain started 2 hours ago, it's crushing and moves to your arm…'",
    },
    {
      key: "safetyNet", label: "Safety-netted",
      hit: RX.safetyNet.test(all),
      detail: RX.safetyNet.test(all) ? "Gave come-back / escalation advice" : "No safety-net advice found",
      tip: "'If this gets worse or you feel faint, come straight back / call an ambulance.'",
    },
    {
      key: "jargonFree", label: "Avoided jargon",
      hit: jargonList.length <= 2,
      detail: jargonList.length <= 2 ? "Plain, patient-friendly language" : `Medical jargon used: ${jargonList.slice(0, 5).join(", ")}${jargonList.length > 5 ? ` +${jargonList.length - 5} more` : ""}`,
      tip: "Say 'heart attack' not 'MI', 'water tablets' not 'diuretics', 'womb' not 'uterus'.",
    },
    {
      key: "listenRatio", label: "Let the patient talk",
      hit: ptWords >= docWords * 0.5,
      detail: `Patient ${ptWords} words · you ${docWords} words`,
      tip: "Your words shouldn't massively outnumber the patient's in a history — listen more than you speak.",
    },
  ];

  const hitCount = metrics.filter((m) => m.hit).length;
  const score = Math.round((hitCount / metrics.length) * 10);
  return {
    metrics, score,
    raw: { docWords, ptWords, qCount: qMsgs.length, open, closed, jargonList },
  };
}

/** Does this student message plausibly invite the patient's hidden agenda? */
export function invitesHiddenAgenda(text) {
  return RX.iceAsk.test(text) || RX.empathy.test(text) || /\b(anything else|what else|something else|what.{0,20}(worr|bother|on your mind|feel))\b/i.test(text);
}
