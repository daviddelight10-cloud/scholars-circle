export const CASES = [
  {
    bed: "BED 3", demo: "Male, 58", specialty: "Cardiology", cc: "Doctor, I have chest pain.",
    history: {
      onset: "It started about two hours ago, while I was climbing the stairs at home.",
      character: "It feels like crushing pressure, like someone is standing on my chest.",
      radiation: "It spreads down my left arm and up into my jaw.",
      associated: "I've been sweating a lot and I feel sick, like I might vomit.",
      relieving: "Nothing helps. I even tried an antacid and it didn't touch it.",
      risk_factors: "I smoke about a pack a day, and my father had a heart attack when he was 55. I'm also diabetic.",
      severity: "If I had to rate it, I'd say 8 out of 10.",
      general: "I've never felt pain like this before, doctor. I'm scared."
    },
    exam: {
      vitals: "BP 150/95, HR 102, RR 22, SpO2 96% on room air, afebrile.",
      general: "Anxious, diaphoretic, clutching his chest with a clenched fist over the sternum.",
      cardiovascular: "S1 and S2 normal, no murmurs, gallops or rubs. JVP not raised.",
      respiratory: "Chest clear bilaterally, no crackles or wheeze.",
      abdomen: "Soft, non-tender, no organomegaly."
    },
    investigations: {
      "ecg": { result: "ST elevation in leads II, III and aVF — consistent with an inferior STEMI.", indicated: true },
      "troponin": { result: "Elevated at 2.1 ng/mL (normal <0.04 ng/mL).", indicated: true },
      "cxr": { result: "Normal cardiac silhouette, no pulmonary oedema, no widened mediastinum.", indicated: true },
      "fbc": { result: "Hb 14.2, WBC 9.1, platelets normal — unremarkable.", indicated: true },
      "d-dimer": { result: "Not clinically indicated given the ECG findings; not routinely sent.", indicated: false }
    },
    diagnosis: "Acute ST-elevation myocardial infarction (inferior STEMI)",
    essential_points: [
      "Character of the pain (crushing/pressure, not sharp or burning)",
      "Radiation to arm and/or jaw",
      "Associated diaphoresis and nausea",
      "Cardiac risk factors (smoking, family history, diabetes)",
      "Not relieved by antacid (helps exclude a GI cause)",
      "Onset and duration of pain (~2 hours, ongoing)"
    ],
    management_key: [
      "Oxygen only if SpO2 <94%",
      "Aspirin 300mg chewed immediately",
      "Sublingual GTN for pain relief",
      "IV morphine/opioid for ongoing pain",
      "Urgent ECG confirmed — activate cath lab / arrange emergency PCI (or thrombolysis if PCI unavailable within window)",
      "Anticoagulation (e.g. heparin)",
      "Beta-blocker once haemodynamically stable, if no contraindication",
      "Continuous cardiac monitoring and serial troponins"
    ],
    vitalsProfile: { baseline_hr: 102, critical_hr: 138, decompensate_start: 60, decompensate_full: 180, stabilizing_action: 'ecg' },
    persona: "A frightened man in visible discomfort who grips his chest. He gives short, anxious answers and is quietly convinced he might die. He only opens up about his brother if the student asks about his worries or shows real empathy.",
    critical: [0, 1, 2, 3],
    viva: [
      "Which coronary artery is most likely occluded, and which ECG territory tells you?",
      "Name two absolute contraindications to thrombolysis.",
      "Why is oxygen withheld unless SpO2 is low in ACS?"
    ],
    hidden_agenda: { reveal: "The patient looks down and says quietly: \"The truth is, doctor… my brother died of a heart attack last year. I can't stop thinking this is the same thing. That's why I came in so fast.\"" },
  },
  {
    bed: "BED 5", demo: "Female, 22", specialty: "General Surgery", cc: "Doctor, my stomach hurts.",
    history: {
      onset: "It started yesterday around my belly button, and last night it moved down to my right side.",
      character: "At first it was a dull ache, now it's sharp and constant.",
      associated: "I've felt sick, vomited once, and I've gone off my food completely. I feel a bit warm too.",
      worsening: "It's worse when I move around or cough — even the car ride here was painful over bumps.",
      menstrual: "My last period was two weeks ago, normal, and I'm not sexually active at the moment.",
      severity: "Maybe 7 out of 10 right now.",
      general: "I just want it to stop, doctor."
    },
    exam: {
      vitals: "T 37.9°C, HR 96, BP 118/76, RR 18.",
      general: "Lying still, reluctant to move, looks uncomfortable.",
      abdomen: "Tenderness maximal at McBurney's point in the right iliac fossa, with guarding and positive rebound tenderness. Rovsing's sign positive.",
      cardiovascular: "Heart sounds normal, no added sounds.",
      respiratory: "Chest clear, no distress."
    },
    investigations: {
      "fbc": { result: "Raised WBC 14,300 with neutrophilia.", indicated: true },
      "urinalysis": { result: "Normal — no leukocytes, nitrites, or blood.", indicated: true },
      "pregnancy test": { result: "Negative.", indicated: true },
      "ultrasound": { result: "Non-compressible, dilated appendix measuring 9mm with surrounding periappendiceal fluid.", indicated: true },
      "crp": { result: "Elevated at 65 mg/L.", indicated: true }
    },
    diagnosis: "Acute appendicitis",
    essential_points: [
      "Pain migration from periumbilical region to the right iliac fossa",
      "Change in pain character (dull to sharp)",
      "Anorexia, nausea and/or vomiting",
      "Worse with movement or coughing",
      "Fever",
      "Pregnancy/sexual history (to help exclude a gynaecological cause)"
    ],
    management_key: [
      "Keep nil by mouth (NPO) in anticipation of surgery",
      "Start IV fluids",
      "Give IV analgesia",
      "Start empirical IV antibiotics",
      "Urgent surgical referral for appendectomy",
      "Monitor for signs of perforation or peritonitis"
    ],
    vitalsProfile: { baseline_hr: 96, critical_hr: 120, decompensate_start: 120, decompensate_full: 300, stabilizing_action: 'ultrasound' },
    persona: "A young woman lying very still because movement hurts. She gives short, guarded answers and winces occasionally. She is private about gynaecological questions unless the student is tactful.",
    critical: [0, 5],
    viva: [
      "Why must you explore a gynaecological differential in RIF pain in a woman of childbearing age?",
      "Name two alternative diagnoses for RIF pain in a young woman.",
      "What signs would make you suspect perforation?"
    ],
    hidden_agenda: { reveal: "The patient's eyes well up: \"Can I tell you something? My gran died on the operating table when I was little. I'm so scared of having surgery. Please don't tell me that's what's coming.\"" },
  },
  {
    bed: "BED 1", demo: "Male, 45", specialty: "Respiratory", cc: "Doctor, I've been coughing and feel feverish.",
    history: {
      onset: "About three days now — fever, chills, and a cough that's getting worse.",
      sputum: "I'm bringing up yellow-green phlegm, quite thick.",
      associated: "It hurts to take a deep breath on the right side, and I've felt short of breath just walking to the bathroom.",
      general: "I've had chills and I feel completely wiped out, no energy at all.",
      pmh: "I don't have any lung problems normally, and I don't smoke.",
    },
    exam: {
      vitals: "T 38.9°C, HR 110, RR 26, SpO2 92% on room air, BP 110/70.",
      general: "Looks unwell, flushed, mild respiratory distress, using some accessory muscles.",
      respiratory: "Coarse crackles and bronchial breathing over the right lower zone, with dullness to percussion there.",
      cardiovascular: "Tachycardic but regular, heart sounds normal.",
      abdomen: "Soft, non-tender."
    },
    investigations: {
      "cxr": { result: "Consolidation in the right lower lobe with air bronchograms.", indicated: true },
      "fbc": { result: "Raised WBC 16,200 with neutrophilia.", indicated: true },
      "crp": { result: "Elevated at 180 mg/L.", indicated: true },
      "sputum culture": { result: "Sent, result pending (72 hours).", indicated: true },
      "urea and electrolytes": { result: "Urea 8.2 mmol/L, otherwise normal — relevant for CURB-65 scoring.", indicated: true }
    },
    diagnosis: "Community-acquired pneumonia (right lower lobe)",
    essential_points: [
      "Duration and pattern of fever/chills",
      "Productive cough with purulent (yellow-green) sputum",
      "Pleuritic chest pain (worse on breathing in)",
      "Shortness of breath / exercise tolerance",
      "Relevant negatives: no prior lung disease, non-smoker"
    ],
    management_key: [
      "Calculate CURB-65 to assess severity and guide admission decision",
      "Give oxygen to keep SpO2 above 94%",
      "Start empirical antibiotics per local CAP guidelines (e.g. amoxicillin ± macrolide, or per severity)",
      "IV fluids if signs of dehydration or sepsis",
      "Analgesia for pleuritic chest pain",
      "Admit if CURB-65 ≥2, consider ICU if severe",
      "Repeat CXR in 6 weeks if smoker or persistent symptoms"
    ],
    vitalsProfile: { baseline_hr: 110, critical_hr: 132, decompensate_start: 90, decompensate_full: 240, stabilizing_action: 'cxr' },
    persona: "Breathless and exhausted, speaking in short sentences between breaths. Frustrated he had to wait to be seen, but warms up if the student acknowledges how unwell he feels.",
    critical: [1, 2, 3],
    viva: [
      "Score this patient on CURB-65 — which criteria does he meet?",
      "What is the empirical first-line antibiotic for community-acquired pneumonia in your region?",
      "When should you repeat the chest X-ray and why?"
    ],
    hidden_agenda: { reveal: "The patient sighs: \"Look, I run my own plumbing business. Every day I'm stuck in here is a day I'm not earning. Nobody's paying my bills while I lie in this bed — that's what's really doing my head in.\"" },
  },
  {
    bed: "BED 7", demo: "Female, 27", specialty: "Obstetrics & Gynaecology", cc: "Doctor, I have lower belly pain and some bleeding.",
    history: {
      onset: "The pain started suddenly about an hour ago, sharp, on my right side low down.",
      bleeding: "I've had some light spotting, not like a normal period, for the last day or two.",
      lmp: "My last period was about six weeks ago — it's late, actually, now that you mention it.",
      associated: "I felt dizzy in the waiting room, almost fainted when I stood up.",
      sexual_history: "Yes, I'm sexually active, and I'm not on any contraception at the moment.",
      general: "I'm scared, doctor — is something wrong with the baby? I didn't even know I was pregnant."
    },
    exam: {
      vitals: "BP 90/60, HR 118, RR 20, looks pale.",
      general: "Pale, clammy, anxious, lying still on the trolley.",
      abdomen: "Right iliac fossa tenderness with guarding; cervical motion tenderness elicited on bimanual exam.",
      cardiovascular: "Tachycardic, thready pulse, heart sounds normal.",
      respiratory: "Chest clear."
    },
    investigations: {
      "pregnancy test": { result: "Positive urine beta-hCG.", indicated: true },
      "ultrasound": { result: "Empty uterus, right adnexal mass, free fluid seen in the pouch of Douglas.", indicated: true },
      "fbc": { result: "Hb 9.2 g/dL (low), suggesting significant blood loss.", indicated: true },
      "group and crossmatch": { result: "Sent urgently, 2 units requested.", indicated: true },
      "serum beta-hcg": { result: "1,850 mIU/mL — lower than expected for gestational age, in keeping with an abnormal pregnancy.", indicated: true }
    },
    diagnosis: "Ruptured ectopic pregnancy",
    essential_points: [
      "Last menstrual period / missed or late period",
      "Sexually active and contraception status",
      "Vaginal bleeding or spotting",
      "Sudden onset, unilateral lower abdominal pain",
      "Dizziness or near-syncope (sign of haemodynamic compromise)"
    ],
    management_key: [
      "Recognise this as a gynaecological emergency with haemodynamic compromise",
      "Gain IV access with 2 large-bore cannulas",
      "Start IV fluid resuscitation",
      "Send urgent group and crossmatch, transfuse if needed",
      "Urgent gynaecology referral",
      "Prepare for emergency laparoscopy/laparotomy",
      "Continuous monitoring of vitals for ongoing shock"
    ],
    vitalsProfile: { baseline_hr: 118, critical_hr: 155, decompensate_start: 45, decompensate_full: 150, stabilizing_action: 'ultrasound' },
    persona: "Terrified, tearful and in pain. She answers haltingly and flinches when the subject of pregnancy comes up — she fears being judged for being unprepared. She opens up only with non-judgemental warmth.",
    critical: [0, 1, 3, 4],
    viva: [
      "Which two findings here are the most dangerous, and why?",
      "Why is an empty uterus on ultrasound a red flag rather than reassuring?",
      "What is your immediate priority in managing this patient?"
    ],
    hidden_agenda: { reveal: "The patient grips the trolley rail: \"I had an ectopic two years ago and they took one of my tubes. If this is another one… I can't lose the other tube, doctor. I want children someday.\"" },
  },
  {
    bed: "BED 2", demo: "Male, 52", specialty: "Family Medicine", cc: "Doctor, I've been really thirsty and tired lately.",
    history: {
      onset: "It's been building up over the past two months — I just thought I was working too hard.",
      polyuria: "I'm getting up three or four times a night to urinate, which never used to happen.",
      polydipsia: "I'm thirsty all the time, drinking way more water than usual.",
      weight_change: "I've lost some weight without trying — maybe 4 or 5 kilos.",
      vision: "My vision's been a bit blurry the last couple of weeks.",
      family_history: "My mother has diabetes, and so does my older brother.",
      diet_lifestyle: "I don't exercise much, and I eat a lot of rice and soft drinks — comes with the job, I'm a driver.",
      general: "I just feel drained all the time, even after sleeping."
    },
    exam: {
      vitals: "BP 138/86, HR 82, BMI 31 (obese), afebrile.",
      general: "Overweight, alert, no acute distress.",
      cardiovascular: "Heart sounds normal, no murmurs.",
      abdomen: "Soft, non-tender, no organomegaly.",
      msk: "Foot exam: skin intact, pedal pulses present bilaterally, sensation intact to light touch — useful baseline for future monitoring."
    },
    investigations: {
      "fasting blood glucose": { result: "212 mg/dL (11.8 mmol/L) — well above the diagnostic threshold.", indicated: true },
      "hba1c": { result: "9.4% — confirms sustained hyperglycaemia over the past 2-3 months.", indicated: true },
      "urinalysis": { result: "Glucose 3+, no ketones, no protein.", indicated: true },
      "lipid profile": { result: "Total cholesterol 5.8 mmol/L, LDL elevated — relevant for cardiovascular risk.", indicated: true },
      "urea and electrolytes": { result: "Normal renal function — useful baseline before starting metformin.", indicated: true },
      "cxr": { result: "Not clinically indicated for this presentation; not routinely done.", indicated: false }
    },
    diagnosis: "Newly diagnosed Type 2 Diabetes Mellitus",
    essential_points: [
      "Polyuria and nocturia",
      "Polydipsia",
      "Unintentional weight loss",
      "Blurred vision",
      "Family history of diabetes",
      "Diet and lifestyle risk factors (diet, inactivity, occupation)"
    ],
    management_key: [
      "Confirm diagnosis with HbA1c and/or fasting glucose",
      "Start lifestyle counselling: diet, physical activity, weight management",
      "Start first-line pharmacotherapy (metformin) if no contraindication",
      "Screen for complications: renal function, lipid profile, foot and eye exam referral",
      "Patient education on hypoglycaemia recognition and self-monitoring",
      "Arrange follow-up to reassess glycaemic control (repeat HbA1c in 3 months)"
    ],
    persona: "A friendly but slightly defensive delivery driver who feels lectured whenever health comes up. He's not keen on being told to change his diet — he responds much better to curious, non-judgemental questions.",
    critical: [0, 1, 2],
    viva: [
      "What HbA1c threshold confirms a diagnosis of diabetes, and on how many occasions is it needed?",
      "What is the main contraindication to metformin?",
      "Name three screening checks a newly diagnosed patient needs."
    ],
    hidden_agenda: { reveal: "The patient goes quiet for a moment: \"My brother had his foot taken off because of diabetes. I watched what it did to him. Honestly doctor, that's why I finally walked in here — I'm scared it runs in the family.\"" },
  },
  {
    bed: "BED 4", demo: "Female, 67", specialty: "Neurology", cc: "Doctor, my family says my face and speech suddenly changed.",
    history: {
      onset: "My daughter says it happened suddenly, about 40 minutes ago, while we were having breakfast.",
      weakness: "My right arm feels heavy and I can't grip things properly.",
      speech: "My words are coming out slurred, and I'm having trouble finding the right words.",
      face: "My family said the right side of my face is drooping.",
      headache: "No headache at all.",
      risk_factors: "I have high blood pressure and an irregular heartbeat, and I smoke.",
      prior_episodes: "Nothing like this has ever happened before.",
      general: "I feel frightened — everything on my right side just doesn't feel right."
    },
    exam: {
      vitals: "BP 178/102, HR 96 irregularly irregular, RR 18, SpO2 97%, capillary blood glucose 6.2 mmol/L.",
      general: "Alert but anxious, right facial droop noted, drooling slightly from the right side of the mouth.",
      cardiovascular: "Irregularly irregular pulse consistent with atrial fibrillation, no murmurs.",
      neuro: "Right arm drift on outstretched arm testing, reduced power 3/5 in the right arm and leg, right-sided facial weakness sparing the forehead, slurred speech with word-finding difficulty (expressive dysphasia)."
    },
    investigations: {
      "blood glucose": { result: "6.2 mmol/L — hypoglycaemia excluded as a stroke mimic.", indicated: true },
      "ct head": { result: "No acute haemorrhage; early ischaemic changes in the left MCA territory.", indicated: true },
      "ecg": { result: "Atrial fibrillation, no acute ischaemic changes.", indicated: true },
      "fbc": { result: "Normal platelet count — no contraindication to thrombolysis on this basis.", indicated: true },
      "urea and electrolytes": { result: "Normal renal function.", indicated: true },
      "troponin": { result: "Not useful for stroke diagnosis; not routinely sent for this presentation.", indicated: false }
    },
    diagnosis: "Acute ischaemic stroke (left MCA territory, likely cardioembolic from atrial fibrillation)",
    essential_points: [
      "Exact time of symptom onset (critical for the treatment window)",
      "Sudden onset of unilateral weakness",
      "Facial droop",
      "Speech disturbance",
      "Known atrial fibrillation and hypertension as risk factors",
      "Absence of headache or trauma (helps differentiate from haemorrhage)"
    ],
    management_key: [
      "Establish exact time of onset — determines eligibility for thrombolysis/thrombectomy",
      "Check blood glucose immediately to exclude hypoglycaemia as a stroke mimic",
      "Urgent non-contrast CT head to exclude haemorrhage before any thrombolysis",
      "If ischaemic and within window, consider IV thrombolysis (alteplase) or mechanical thrombectomy",
      "Keep nil by mouth until a formal swallow assessment is done",
      "Admit to a stroke unit for monitoring and rehabilitation planning",
      "Long-term: anticoagulation for atrial fibrillation once safe, and risk factor control"
    ],
    persona: "Confused and frightened, her speech is slurred and effortful and she sometimes lands on the wrong word. She answers slowly and her daughter (in the background) sometimes fills gaps.",
    critical: [0],
    viva: [
      "Which two pieces of information decide whether she can be thrombolysed?",
      "Why is the non-contrast CT done before thrombolysis rather than after?",
      "What is the swallowing precaution and why does it matter?"
    ],
    hidden_agenda: { reveal: "The daughter speaks up hesitantly: \"Mum, should I tell them? … Doctor, she stopped taking her blood-thinner tablets about six months ago. They were bruising her and she said she felt fine. I didn't know it mattered.\"" },
  },
  {
    bed: "BED 6", demo: "Female, 34", specialty: "Orthopaedics", cc: "Doctor, I fell on my hand and now my wrist really hurts.",
    history: {
      onset: "I slipped on a wet floor about an hour ago and put my hand out to break the fall.",
      pain: "The pain is right at my wrist, sharp, especially when I try to move it.",
      deformity: "It looks a bit bent out of shape compared to my other wrist.",
      function: "I can't grip anything or turn my hand properly.",
      numbness: "My fingers feel a little tingly, especially my thumb and first two fingers.",
      mechanism: "I landed with my hand flat and my wrist bent backward.",
      pmh: "I'm otherwise healthy, no previous fractures.",
      general: "It's been throbbing non-stop since it happened."
    },
    exam: {
      vitals: "BP 128/80, HR 88, afebrile, pain score 7/10.",
      general: "Alert, guarding the right wrist, visible swelling.",
      msk: "Dinner-fork deformity of the right wrist with dorsal swelling and bruising, marked tenderness over the distal radius, unable to actively move the wrist due to pain. Neurovascular: radial pulse present, capillary refill <2 seconds, mildly reduced sensation over the thumb and index finger suggesting median nerve irritation."
    },
    investigations: {
      "x-ray wrist": { result: "Dorsally displaced, dorsally angulated fracture of the distal radius (Colles' fracture) with radial shortening.", indicated: true },
      "neurovascular assessment": { result: "Radial pulse intact, cap refill <2s, mild reduced sensation over thumb/index finger — no current sign of acute compartment syndrome.", indicated: true },
      "fbc": { result: "Normal — not clinically necessary for an isolated closed fracture.", indicated: false }
    },
    diagnosis: "Colles' fracture (dorsally displaced distal radius fracture) following a fall on an outstretched hand",
    essential_points: [
      "Mechanism of injury (fall on outstretched hand, wrist bent backward)",
      "Wrist deformity (dinner-fork appearance)",
      "Loss of function/grip",
      "Neurovascular symptoms (tingling in thumb/fingers — possible median nerve involvement)",
      "Pain severity and timing"
    ],
    management_key: [
      "Assess and document neurovascular status before and after any manipulation",
      "Give adequate analgesia",
      "X-ray to confirm fracture pattern and displacement",
      "Closed reduction under appropriate anaesthesia/sedation if significantly displaced",
      "Immobilise in a below-elbow backslab/cast after reduction",
      "Arrange orthopaedic follow-up and repeat X-ray to confirm alignment",
      "Monitor for compartment syndrome and educate on red-flag symptoms"
    ],
    persona: "In significant pain but pragmatic and a bit embarrassed about falling. She's a freelance graphic designer — she's mostly worried about deadlines, not the wrist itself.",
    critical: [3],
    viva: [
      "What is the neurovascular structure most at risk here, and how do you test it?",
      "What is compartment syndrome, and which symptom is the earliest warning sign?",
      "When does a Colles' fracture need surgery rather than cast treatment?"
    ],
    hidden_agenda: { reveal: "The patient winces, then admits: \"I know this sounds silly, but I've got a client deadline Friday and I literally can't use a mouse. Can't you just strap it and let me get on with it? I can't afford to lose this contract.\"" },
  },
  {
    bed: "BED 8", demo: "Boy, 7 years old (history from his mother)", specialty: "Paediatrics", cc: "Doctor, my son is wheezing and struggling to breathe.",
    history: {
      onset: "It started this afternoon with a cough, and over the last hour his breathing's gotten much worse.",
      trigger: "He had a cold this past week, and today he was playing outside where the neighbours were burning leaves.",
      symptoms: "He's wheezy, breathing fast, and I can see his chest pulling in with every breath.",
      speech: "He can only say a few words at a time before he needs to catch his breath.",
      history_asthma: "He's had asthma since he was about 4, usually controlled with his blue inhaler, but tonight it's not helping much.",
      feeding: "He hasn't wanted to eat or drink much this evening.",
      general: "He's scared and clinging to me — I've never seen an attack this bad."
    },
    exam: {
      vitals: "RR 42 (elevated for age), HR 138, SpO2 89% on room air, afebrile, using accessory muscles.",
      general: "Visibly distressed, sitting upright in a tripod position, speaking in 2-3 word sentences.",
      respiratory: "Widespread expiratory wheeze bilaterally, prolonged expiratory phase, marked subcostal and intercostal recession, reduced air entry at the bases.",
      cardiovascular: "Tachycardic, heart sounds normal, no murmurs."
    },
    investigations: {
      "cxr": { result: "Hyperinflated lung fields, no focal consolidation or pneumothorax — helps exclude an alternative cause.", indicated: true },
      "fbc": { result: "Mild neutrophilia, likely reactive — no clear evidence of bacterial infection.", indicated: false },
      "blood gas (capillary)": { result: "Mild hypoxaemia with a currently normal CO2 — a rising or normalising CO2 here would be an ominous sign of fatigue and impending respiratory failure.", indicated: true },
      "peak flow": { result: "Unable to perform reliably given his age and distress.", indicated: false }
    },
    diagnosis: "Acute severe asthma exacerbation",
    essential_points: [
      "Onset and progression of symptoms",
      "Known asthma history and usual inhaler use",
      "Trigger (viral upper respiratory infection / environmental exposure)",
      "Severity markers: speech in short phrases, accessory muscle use, tripod position",
      "SpO2 level and response to inhaler"
    ],
    management_key: [
      "Give high-flow oxygen to maintain SpO2 >94%",
      "Nebulised salbutamol with oxygen drive, repeated as needed",
      "Add nebulised ipratropium bromide for severe exacerbations",
      "Systemic corticosteroids (oral prednisolone or IV hydrocortisone)",
      "Consider IV magnesium sulphate if not responding",
      "Continuous SpO2 and cardiac monitoring",
      "Escalate to PICU/HDU if deteriorating or failing to respond"
    ],
    vitalsProfile: { baseline_hr: 138, critical_hr: 170, decompensate_start: 30, decompensate_full: 120, stabilizing_action: 'cxr' },
    persona: "A panicked mother talking quickly and interrupting herself. She is visibly guilty that she didn't come in sooner. She calms down when the student is kind and unhurried, and gives much better information.",
    critical: [1, 3, 4],
    viva: [
      "What features make this an acute severe attack rather than mild-to-moderate?",
      "Why is a 'normal' CO2 worrying in a severe asthma exacerbation?",
      "When would you escalate to PICU or consider IV magnesium?"
    ],
    hidden_agenda: { reveal: "The mother lowers her voice: \"I have to confess — his blue inhaler ran out last week and I gave him a puff of our neighbour's instead before we came. I felt awful about it. Have I made him worse?\"" },
  },
  {
    bed: "BED 9", demo: "Male, 35", specialty: "Urology", cc: "Doctor, I have terrible pain in my side that won't go away.",
    history: {
      onset: "It came on suddenly about an hour ago, while I was at work. I was fine one minute and the next I was in agony.",
      character: "It's a colicky pain — it comes in waves, getting worse and then a bit better, but never fully goes.",
      radiation: "It starts in my left flank and shoots down into my groin and testicle.",
      associated: "I feel really nauseous and I've vomited twice.",
      urinary: "I've noticed a bit of blood in my urine when I went to the toilet earlier.",
      pmh: "I had a kidney stone about three years ago that passed on its own.",
      lifestyle: "I don't drink much water, mostly energy drinks and coffee throughout the day.",
      general: "I can't sit still, doctor. I keep moving around trying to find a position that helps."
    },
    exam: {
      vitals: "BP 140/88, HR 104, RR 20, afebrile.",
      general: "Unable to sit still, writhing on the trolley, clearly in severe pain.",
      abdomen: "Left flank tenderness, no peritonism, no guarding. Bowel sounds normal.",
      cardiovascular: "Tachycardic, heart sounds normal.",
      respiratory: "Chest clear."
    },
    investigations: {
      "urinalysis": { result: "Blood 3+, no leukocytes, no nitrites, no protein.", indicated: true },
      "ct kub": { result: "6mm stone at the left vesicoureteric junction with mild hydronephrosis.", indicated: true },
      "fbc": { result: "Normal — no sign of infection.", indicated: true },
      "urea and electrolytes": { result: "Creatinine 96 µmol/L, normal renal function.", indicated: true },
      "pregnancy test": { result: "Not applicable for this patient.", indicated: false }
    },
    diagnosis: "Renal colic due to a ureteric stone (left vesicoureteric junction)",
    essential_points: [
      "Sudden onset, colicky (wave-like) pain",
      "Loin-to-groin radiation",
      "Inability to find a comfortable position (distinguishes from peritonitic pain)",
      "Associated nausea/vomiting",
      "Visible or dipstick haematuria",
      "Previous history of kidney stones and risk factors (low fluid intake)"
    ],
    management_key: [
      "Give adequate analgesia — NSAIDs are first-line for renal colic if not contraindicated",
      "Antiemetics for nausea/vomiting",
      "Urinalysis to check for haematuria and exclude infection",
      "Imaging (ultrasound or CT KUB) to confirm stone size, location and degree of obstruction",
      "Screen for signs of an infected obstructed system (fever, raised WCC) — a urological emergency needing urgent decompression",
      "Most small stones (<5-6mm) can be managed conservatively with fluids and analgesia; larger stones may need urology referral",
      "Advise increased fluid intake and arrange follow-up imaging to confirm stone passage"
    ],
    persona: "In agony and unable to sit still — he paces and answers in curt bursts through gritted teeth, then apologises for being short. He just wants the pain gone.",
    critical: [0, 1, 4],
    viva: [
      "Which finding would turn this from routine renal colic into a urological emergency?",
      "Why are NSAIDs first-line analgesia here?",
      "When does this patient need a urology referral rather than conservative management?"
    ],
    hidden_agenda: { reveal: "The patient grimaces and leans in: \"My uncle had kidney cancer — started with pain just like this. I know it's probably a stone again but… it's in the back of my mind, doctor.\"" },
  },
  {
    bed: "BED 10", demo: "Female, 34", specialty: "Respiratory", cc: "Doctor, it's hard to breathe and my chest hurts when I take a deep breath.",
    history: {
      onset: "It started about two days ago — a sharp pain on my right side that's worst when I breathe in or cough.",
      breathing: "I get winded just walking across the room. I've never been like this before.",
      travel: "I got back from a work trip to Australia three days ago — it was a really long flight, like 15 hours each way.",
      medication: "I take the contraceptive pill — have done for about two years. Nothing else.",
      leg: "Now that you mention it, my left calf has felt a bit tight and achy since the flight.",
      blood: "I did cough up a tiny streak of blood this morning — just a fleck, but it scared me.",
      general: "I'm only 34, doctor. I keep thinking people my age shouldn't be getting chest pain."
    },
    exam: {
      vitals: "HR 112, RR 26, SpO2 93% on room air, BP 118/74, T 37.4°C.",
      general: "Anxious, mildly breathless at rest, speaking in short phrases.",
      respiratory: "Chest clear to auscultation bilaterally, no crackles or wheeze; mildly reduced expansion on the right.",
      cardiovascular: "Tachycardic but regular, heart sounds normal, JVP not raised.",
      msk: "Mild swelling and warmth of the left calf, 2cm larger than the right; no pitting oedema."
    },
    investigations: {
      "ecg": { result: "Sinus tachycardia at 112 bpm; subtle S1Q3T3 pattern noted.", indicated: true },
      "d-dimer": { result: "Elevated at 1,240 ng/mL (normal <500).", indicated: true },
      "cxr": { result: "Essentially normal — no consolidation, effusion or pneumothorax.", indicated: true },
      "ctpa": { result: "Filling defects in the right lower lobe segmental pulmonary arteries — acute pulmonary embolism.", indicated: true },
      "fbc": { result: "Normal.", indicated: true },
      "leg ultrasound": { result: "Non-compressible popliteal vein — concurrent below-knee DVT.", indicated: true },
      "troponin": { result: "Not clinically indicated at this stage; not routinely sent.", indicated: false }
    },
    diagnosis: "Acute pulmonary embolism (provoked — oestrogen-containing contraceptive + long-haul travel), with concurrent DVT",
    essential_points: [
      "Pleuritic character of the chest pain",
      "Progressive breathlessness / reduced exercise tolerance",
      "Calf swelling or pain (possible DVT source)",
      "Oestrogen-containing contraceptive use",
      "Recent long-haul travel or immobility",
      "Haemoptysis"
    ],
    management_key: [
      "Start anticoagulation promptly — DOAC first-line for most patients (e.g. apixaban/rivaroxaban, or LMWH bridging to warfarin)",
      "Oxygen only if needed to maintain saturation",
      "Analgesia for pleuritic pain",
      "Assess severity/haemodynamic risk (sPESI; echo/CT signs of right heart strain if unstable)",
      "Counsel on the oestrogen pill — stop it and discuss alternatives",
      "Address the provoked cause and review duration of therapy (typically ≥3–6 months)",
      "Safety-net: explain warning signs and arrange follow-up/anticoagulation clinic"
    ],
    vitalsProfile: { baseline_hr: 112, critical_hr: 140, decompensate_start: 75, decompensate_full: 210, stabilizing_action: 'ctpa' },
    persona: "Anxious and breathless young professional who keeps asking whether she did something wrong. Worries the pill she takes caused this — relieved if the student addresses it without judgement.",
    critical: [3, 4, 0],
    viva: [
      "Which features of this history would score on a Wells assessment for PE?",
      "In which patient would you consider thrombolysis rather than anticoagulation alone?",
      "What counselling do you give about her contraceptive pill going forward?"
    ],
    hidden_agenda: { reveal: "The patient fidgets with her sleeve: \"There's something else… I smoke a few cigarettes when I drink, maybe a pack a week. The GP warned me about the pill and smoking. Is that why this happened?\"" }
  },
  {
    bed: "BED 11", demo: "Male, 19", specialty: "Emergency Medicine", cc: "Doctor, I've been throwing up and I feel terrible.",
    history: {
      onset: "It started yesterday with a tummy bug — I've been vomiting since and couldn't keep anything down.",
      diabetes: "I've had type 1 diabetes since I was nine. I stopped my insulin this morning because I wasn't eating — I thought that was the right thing.",
      thirst: "I'm desperately thirsty and I've been peeing constantly, even though I can't keep fluids down.",
      tummy: "My stomach's sore all over — cramping, and it gets worse after I vomit.",
      alertness: "I feel really drowsy and foggy — my mum said I seemed 'out of it' on the phone.",
      readings: "My glucose at home read 'HI' — above what my meter can measure. My ketones were 4.2.",
      general: "I feel like I'm dying, honestly. I've never been this sick."
    },
    exam: {
      vitals: "T 37.2°C, HR 124, BP 100/62, RR 30 with deep sighing respiration, capillary glucose 'HI'.",
      general: "Drowsy but rousable (GCS 14), dehydrated with dry mucous membranes and reduced skin turgor, fruity/acetone breath.",
      abdomen: "Diffusely tender, no guarding or localising signs — the abdominal pain of DKA itself.",
      cardiovascular: "Tachycardic, thready pulse, cap refill 3 seconds.",
      respiratory: "Deep, sighing Kussmaul respiration, chest clear."
    },
    investigations: {
      "venous blood gas": { result: "pH 7.21, PaCO2 3.1 kPa, HCO3 9 mmol/L, base excess −14 — significant metabolic acidosis.", indicated: true },
      "capillary ketones": { result: "4.2 mmol/L — diagnostic of ketosis.", indicated: true },
      "glucose": { result: "28 mmol/L.", indicated: true },
      "urea and electrolytes": { result: "K+ 5.1 mmol/L, creatinine 148 µmol/L (AKI), urea elevated — total body potassium is likely depleted despite the serum value.", indicated: true },
      "fbc": { result: "WCC 14,800 — commonly reactive in DKA; does not by itself prove infection.", indicated: true },
      "ct abdomen": { result: "Not clinically indicated — the abdominal pain is a feature of DKA and should resolve with treatment.", indicated: false }
    },
    diagnosis: "Diabetic ketoacidosis (precipitated by gastroenteritis and insulin omission)",
    essential_points: [
      "Known type 1 diabetes + insulin stopped/omitted",
      "Duration and severity of vomiting / inability to keep fluids down",
      "Marked thirst and polyuria",
      "Abdominal pain",
      "Drowsiness or altered consciousness",
      "Intercurrent illness as a trigger (sick-day rule gap)"
    ],
    management_key: [
      "IV fluid resuscitation with 0.9% sodium chloride",
      "Fixed-rate IV insulin infusion (0.1 units/kg/hr) — do NOT just restart their usual insulin",
      "Hourly potassium monitoring and replacement — insulin drives K+ into cells",
      "Hourly capillary glucose and ketone monitoring",
      "Treat the precipitant (supportive care for gastroenteritis; antibiotics only if infection suspected)",
      "Continue long-acting basal insulin alongside the infusion where possible",
      "Sick-day rules education before discharge — never stop insulin in type 1, even when not eating",
      "Escalate to HDU/critical care if severely acidotic or deteriorating"
    ],
    vitalsProfile: { baseline_hr: 124, critical_hr: 150, decompensate_start: 50, decompensate_full: 160, stabilizing_action: 'venous blood gas' },
    persona: "A scared 19-year-old who is dehydrated, irritable and embarrassed about stopping his insulin. He downplays how bad it is ('I just need to sleep it off') until the student is reassuring.",
    critical: [0, 1, 4],
    viva: [
      "State the three diagnostic criteria for DKA.",
      "Why must potassium be monitored so closely during treatment?",
      "What are 'sick-day rules' and which mistake did this patient make?"
    ],
    hidden_agenda: { reveal: "The patient looks away, embarrassed: \"Honestly… I went to a mate's place for the weekend and left my insulin pen at home. I was too scared to tell mum. That's the real reason I skipped it.\"" }
  },
  {
    bed: "BED 12", demo: "Male, 61", specialty: "Gastroenterology", cc: "Doctor, I've been vomiting blood and my stools have turned black.",
    history: {
      onset: "This morning I vomited twice — it looked like coffee grounds. My wife made me come in.",
      stools: "My stools have been black and tarry for about two days. Smell awful too.",
      dizziness: "I nearly blacked out when I stood up in the bathroom — had to grip the sink.",
      medications: "I take ibuprofen most days for a bad back — have done for months. Occasionally naproxen.",
      alcohol: "I enjoy a glass of wine with dinner… maybe a bit more than a glass some nights.",
      history_gi: "I've had heartburn and indigestion on and off for years — antacids usually settle it.",
      general: "Honestly I feel a bit light-headed, but I'm sure it's nothing."
    },
    exam: {
      vitals: "BP 98/58, HR 112, RR 20, SpO2 97%, afebrile — pale and cool peripheries.",
      general: "Pale, mildly diaphoretic, looks older than his stated age.",
      abdomen: "Mild epigastric tenderness, no guarding or masses. Bowel sounds present.",
      cardiovascular: "Tachycardic, thready pulse, cap refill 3 seconds — early hypovolaemia.",
      genitourinary: "PR examination: black tarry stool (melaena) on the glove, confirming an upper GI source."
    },
    investigations: {
      "fbc": { result: "Hb 7.8 g/dL (was 14.1 on a routine test last year), MCV normal — significant acute blood loss.", indicated: true },
      "urea and electrolytes": { result: "Urea elevated at 11.4 mmol/L with normal creatinine — disproportionate urea supports an upper GI source (blood protein digestion).", indicated: true },
      "group and crossmatch": { result: "Group A positive; 2 units crossmatched urgently.", indicated: true },
      "lfts": { result: "Mildly raised GGT; platelets and INR normal — no evidence of chronic liver disease.", indicated: true },
      "lactate": { result: "2.8 mmol/L — moderate elevation, consistent with tissue hypoperfusion.", indicated: true },
      "ogd (endoscopy)": { result: "Forrest Ib duodenal ulcer with oozing visible vessel — the bleeding source.", indicated: true },
      "ecg": { result: "Sinus tachycardia, no ischaemic change.", indicated: true }
    },
    diagnosis: "Acute upper gastrointestinal bleed (bleeding duodenal ulcer) with hypovolaemia, provoked by chronic NSAID use",
    essential_points: [
      "Melaena (black tarry stools)",
      "Haematemesis / coffee-ground vomiting",
      "NSAID use (chronic, for back pain)",
      "Dizziness / near-syncope suggesting hypovolaemia",
      "Alcohol intake and previous dyspepsia",
      "Haemodynamic status / how unwell he feels"
    ],
    management_key: [
      "ABCDE assessment with two large-bore IV cannulas and fluid resuscitation",
      "Urgent bloods incl. FBC, crossmatch, U&E, clotting; monitor Hb",
      "Risk-stratify (Glasgow-Blatchford score)",
      "Start high-dose PPI (e.g. IV omeprazole)",
      "Arrange urgent upper GI endoscopy (within 24h; sooner if unstable)",
      "Transfuse per local threshold / haemodynamic status",
      "Stop NSAIDs; escalate to surgery/interventional radiology if rebleeding or unstable",
      "Consider H. pylori testing after stabilisation"
    ],
    vitalsProfile: { baseline_hr: 112, critical_hr: 138, decompensate_start: 55, decompensate_full: 170, stabilizing_action: 'group and crossmatch' },
    persona: "Pale and stoic, minimising throughout ('it's probably nothing, the wife worries too much'). Gives better history when the student slows him down and takes it seriously.",
    critical: [0, 1, 2, 3],
    viva: [
      "Which score is used to risk-stratify an upper GI bleed before endoscopy?",
      "Why does urea rise disproportionately in an upper (vs lower) GI bleed?",
      "What is your transfusion trigger here, and why?"
    ],
    hidden_agenda: { reveal: "The patient lowers his voice: \"Truth is, doctor — it isn't a glass of wine. It's most of a bottle, most nights, and my wife doesn't know the half of it. That matters, doesn't it.\"" }
  },
  {
    bed: "BED 13", demo: "Female, 72", specialty: "Cardiology", cc: "Doctor, I'm getting more and more short of breath and my ankles have swollen up.",
    history: {
      onset: "Over the last three weeks it's got steadily worse — I used to manage the stairs fine.",
      orthopnoea: "I can't lie flat at all now — I sleep propped up on three pillows or I feel like I'm drowning.",
      pnd: "Two nights this week I woke up gasping for air — I had to sit on the edge of the bed until it passed.",
      swelling: "My ankles are so puffy my shoes won't fit, and I've put on nearly three kilos.",
      exertion: "I get puffed just walking to the bathroom now. I used to do the shopping myself.",
      pmh: "I had a heart attack about four years ago — I take my aspirin and the little yellow tablet every day.",
      general: "I'm sorry to be a bother, doctor. I kept putting it off."
    },
    exam: {
      vitals: "BP 142/88, HR 96 regular, RR 22, SpO2 94% on room air, afebrile.",
      general: "Comfortable at rest but breathless on lying flat; pitting oedema to both knees.",
      cardiovascular: "JVP elevated at ~6cm, displaced apex beat, S3 gallop rhythm, heart sounds otherwise normal.",
      respiratory: "Fine bibasal inspiratory crackles bilaterally.",
      abdomen: "Soft, mild hepatomegaly, ascites absent."
    },
    investigations: {
      "nt-probnp": { result: "2,400 pg/mL — markedly elevated, supporting a cardiac cause of breathlessness.", indicated: true },
      "ecg": { result: "Old anterior Q waves consistent with previous infarction; sinus rhythm, no acute ischaemia.", indicated: true },
      "cxr": { result: "Cardiomegaly with upper-lobe blood diversion and small bilateral pleural effusions.", indicated: true },
      "echo": { result: "Left ventricular ejection fraction 35% with anterior wall hypokinesis — HFrEF.", indicated: true },
      "urea and electrolytes": { result: "Creatinine mildly elevated at 122 µmol/L — important baseline before diuretics/ACE inhibitors.", indicated: true },
      "d-dimer": { result: "Not clinically indicated — clinical picture is far more consistent with heart failure.", indicated: false }
    },
    diagnosis: "Acute decompensation of chronic heart failure with reduced ejection fraction (HFrEF)",
    essential_points: [
      "Progressive breathlessness / reduced exercise tolerance",
      "Orthopnoea and paroxysmal nocturnal dyspnoea",
      "Peripheral oedema and rapid weight gain",
      "Ischaemic history (previous MI) and current medication",
      "Functional impact / social situation"
    ],
    management_key: [
      "Sit upright; oxygen only if hypoxic",
      "Diurese — IV or oral furosemide to relieve congestion",
      "Fluid and salt restriction; daily weights and strict input/output",
      "Treat the trigger / optimise the cause (rate control if AF, manage BP, review ischaemia)",
      "When stable, start/titrate prognostic HF medication: ACEi or ARNI, beta-blocker, MRA, SGLT2 inhibitor ('four pillars')",
      "Echo + cardiology/heart failure referral; patient education and follow-up"
    ],
    vitalsProfile: { baseline_hr: 96, critical_hr: 122, decompensate_start: 130, decompensate_full: 320, stabilizing_action: 'echo' },
    persona: "A gentle grandmother who apologises for taking up time and says 'it's just getting old, love'. She breaths hard on long sentences and brightens when the student is patient with her.",
    critical: [0, 1, 2],
    viva: [
      "Why does orthopnoea happen in heart failure?",
      "Name the 'four pillars' of HFrEF prognostic therapy.",
      "Why are daily weights part of management?"
    ],
    hidden_agenda: { reveal: "The patient wrings her hands: \"Since my husband passed the food all tastes bland, so I use more salt than I should. And I skip my water tablet when I'm out — I can't always get to a toilet in time. Will you think less of me, doctor?\"" }
  },
  {
    bed: "BED 14", demo: "Female, 26", specialty: "Psychiatry", cc: "Doctor… I haven't been feeling like myself for a while.",
    history: {
      mood: "It's been about three months — I just feel flat and low almost every day, all day.",
      anhedonia: "I used to love painting and playing netball on Thursdays. I've stopped both — nothing feels fun anymore.",
      sleep: "I fall asleep okay but I wake at 4am and can't get back to sleep. I'm exhausted.",
      appetite: "I've lost about four kilos — food just doesn't interest me.",
      work: "I can't concentrate at work — I reread the same email six times. My manager's noticed.",
      worthlessness: "I feel like a burden to everyone. Like I'm failing at everything.",
      ideation: "Sometimes I think everyone would be better off without me… but I don't think I'd ever do anything. I don't have a plan.",
      social: "I moved cities for work six months ago, then my relationship ended. I don't really know anyone here.",
      substances: "I don't drink much — a wine or two at weekends. No drugs."
    },
    exam: {
      vitals: "BP 108/68, HR 72, T 36.6°C — normal.",
      general: "Thin, tired-looking, poor eye contact, fidgeting with her sleeve.",
      mental_state: "Tearful when discussing self-worth; flat affect with slowed speech (mild psychomotor retardation), but engaged, coherent and no psychotic features.",
      cardiovascular: "Normal.",
      respiratory: "Clear."
    },
    investigations: {
      "tfts": { result: "TSH normal — hypothyroidism excluded as an organic contributor.", indicated: true },
      "fbc": { result: "Normal — anaemia excluded.", indicated: true },
      "vitamin d": { result: "Mildly low — a reasonable adjunct, not diagnostic.", indicated: false },
      "urine drug screen": { result: "Not indicated — no clinical suspicion of substance misuse.", indicated: false }
    },
    diagnosis: "Major depressive episode, moderate severity (with passive suicidal ideation)",
    essential_points: [
      "Duration and persistence of low mood",
      "Anhedonia (loss of interest/pleasure)",
      "Biological symptoms: sleep, appetite/weight, energy, concentration",
      "Feelings of worthlessness or excessive guilt",
      "Suicidal thoughts vs plan vs intent (direct risk screening)",
      "Functional and social context (isolation, recent stressors)",
      "Substance use and physical-health screening"
    ],
    management_key: [
      "Complete a risk assessment and create a safety plan (crisis contacts, means restriction, identifying supports)",
      "Psychoeducation about depression and treatment options",
      "Refer for psychological therapy (e.g. CBT) per severity",
      "Consider antidepressant medication (SSRI first-line) with side-effect counselling",
      "Urgent escalation to crisis/psychiatry team if intent, plan or rapid deterioration emerges",
      "Involve family/supports with the patient's consent",
      "Early follow-up review to monitor risk and response",
      "Screen for organic causes (TFTs, FBC) — done here"
    ],
    persona: "Quiet and guarded — often answers 'I don't know' unless the student is gentle and unhurried. Tears up when she feels heard. Deeply worried she's 'wasting the doctor's time'.",
    critical: [4],
    viva: [
      "How do you ask about suicide without 'putting the idea in their head'?",
      "What does a safety plan actually contain?",
      "When does this presentation need same-day psychiatric review?"
    ],
    hidden_agenda: { reveal: "The patient's voice drops to a whisper: \"There's something else… sometimes when it gets really bad I hurt myself. Small cuts, on my thighs — you can't see them. I'm not trying to die, I promise. It just helps me feel something.\"" }
  },
  {
    bed: "BED 15", demo: "Male, 58", specialty: "Family Medicine", station_type: "counselling",
    cc: "Doctor, you asked me to come in about my scan results…?",
    history: {
      symptoms: "I've had this vague backache for a couple of months and I've lost about a stone in weight without trying. My skin's looked a bit yellow, the wife says.",
      tests: "I had a CT scan last week — they said it was to check my abdomen. Nobody's told me the results yet.",
      expectation: "I'm hoping it's nothing serious — maybe gallstones or something simple they can fix.",
      family: "My wife is in the waiting room — she was worried and wanted to come in with me, but I said I'd be fine.",
      general: "Just tell me straight, doctor. Whatever it is, I'd rather know."
    },
    exam: {
      general: "Well-dressed, slightly anxious, mild scleral icterus (yellowing of the eyes) noted."
    },
    investigations: {
      "ct abdomen": { result: "4.2cm irregular mass in the head of the pancreas with biliary dilatation and suspicious peri-pancreatic lymph nodes — findings concerning for malignancy.", indicated: true },
      "lfts": { result: "Obstructive pattern: raised bilirubin 48 µmol/L, ALP 380, GGT 240.", indicated: true },
      "ca19-9": { result: "Elevated at 420 U/mL — supportive but not diagnostic alone.", indicated: true },
      "biopsy": { result: "Not yet performed — planned via MDT discussion.", indicated: true }
    },
    diagnosis: "Communication station — break the news of a new pancreatic mass suspicious for malignancy (SPIKES framework)",
    essential_points: [
      "Assesses the patient's understanding and how much they want to know (perception + invitation)",
      "Gives a warning shot before the news ('I'm afraid the results are not what we hoped')",
      "States the finding clearly and honestly in plain language — names it without jargon or euphemism",
      "Pauses, allows silence and responds to emotion with empathy (NURSE)",
      "Avoids false reassurance and false precision ('we'll cure it', 'you have six months')",
      "Checks the patient's understanding and summarises what happens next",
      "Offers concrete next steps: MDT, biopsy, support services, and whether the wife should join",
      "Safety-nets: who to contact, follow-up plan, written information"
    ],
    management_key: [
      "Follows the SPIKES structure overall (Setting, Perception, Invitation, Knowledge, Empathy, Strategy/Summary)",
      "Responds to emotion before logistics — acknowledges, validates, allows silence",
      "Uses the patient's own words; explains honestly without false hope or brutal bluntness",
      "Offers the wife's presence and asks permission before sharing more detail",
      "Explains next steps honestly: MDT, biopsy for confirmation, oncology referral, symptom management",
      "Provides safety-netting: named contact, follow-up appointment, written information leaflets",
      "Asks what the patient will take away / offers time for questions before closing"
    ],
    persona: "Hoping for gallstones but braced for worse — he explicitly says 'just tell me straight'. Goes quiet and tearful when the word 'cancer' lands, then starts asking practical questions ('can it be cured?', 'should I tell my kids?').",
    critical: [1, 2, 3],
    viva: [
      "What does each letter of SPIKES stand for?",
      "Why is false reassurance more harmful than honest uncertainty?",
      "How would you respond if the patient asks 'am I going to die?'"
    ],
    hidden_agenda: { reveal: "The patient dabs his eyes: \"I need to tell you something — my wife had breast cancer eight years ago. I sat where you're sitting once. So don't dress it up for me, doctor. I know what this road looks like.\"" }
  },
  {
    bed: "BED 16", demo: "Male, 68 (via ward nurse)", specialty: "Emergency Medicine", station_type: "data",
    cc: "Doctor, the blood gas is back on your COPD patient — pH 7.28, PaCO2 9.2 kPa, HCO3 36, PaO2 7.4 on the oxygen mask. He's getting sleepier.",
    history: {
      patient: "He's a 68-year-old known COPD patient, admitted with an infective exacerbation. He's been on 40% oxygen by face mask for the last two hours.",
      history_pts: "He has a 40-pack-year smoking history, uses home nebulisers and has had two NIV admissions before.",
      current: "The nurses called because he's become drowsy and hard to wake in the last 20 minutes.",
      general: "He was alert and talking when he came in — the drowsiness is new since the high-flow oxygen."
    },
    exam: {
      vitals: "RR 14 (previously 26), SpO2 97% on 40% O2, HR 98, BP 138/82, GCS 13 — drowsy.",
      general: "Sleepy but rousable, breathing shallower than before, pursed-lip breathing pattern.",
      respiratory: "Poor air entry bilaterally with expiratory wheeze — reduced from admission.",
      cardiovascular: "Regular, no added sounds."
    },
    investigations: {
      "repeat abg": { result: "pH 7.28, PaCO2 9.2 kPa, HCO3 36, PaO2 7.4 on 40% FiO2.", indicated: true },
      "admission abg": { result: "On room air: pH 7.33, PaCO2 6.8, HCO3 34, PaO2 6.9 — chronic CO2 retention already present.", indicated: true },
      "cxr": { result: "Hyperinflation with right lower-zone infiltrate, no pneumothorax.", indicated: true },
      "fbc": { result: "WCC 13,200 — supports infective exacerbation.", indicated: true }
    },
    diagnosis: "Acute-on-chronic type 2 respiratory failure in COPD, worsened by uncontrolled oxygen delivery (CO2 narcosis)",
    essential_points: [
      "Interprets pH correctly (acidaemia)",
      "Identifies the respiratory component (raised PaCO2 → respiratory acidosis)",
      "Notes the high HCO3 → chronic compensation (acute-on-chronic, not pure acute)",
      "Links drowsiness to CO2 narcosis from uncontrolled oxygen",
      "Acts on it: controlled oxygen 24–28% Venturi, target SpO2 88–92%",
      "Considers NIV (BiPAP) given pH <7.35 with hypercapnia and escalation to critical care",
      "Plans a repeat ABG after intervention"
    ],
    management_key: [
      "Immediately reduce FiO2 to a controlled 24–28% Venturi, target SpO2 88–92%",
      "Repeat ABG after 30–60 minutes of the change",
      "Start NIV (BiPAP) if pH remains <7.35 with hypercapnia despite controlled O2 — involve critical care",
      "Treat the exacerbation: nebulised bronchodilators, steroids, antibiotics per guidelines",
      "Monitor closely: GCS, respiratory rate, work of breathing",
      "Document and safety-net — known CO2 retainer needs controlled O2 always"
    ],
    persona: "An efficient, slightly worried ward nurse reading results. She answers factual questions about the patient precisely and prompts the doctor for a plan ('what should I do about the oxygen?').",
    critical: [4, 5],
    viva: [
      "Why is the SpO2 target 88–92% rather than 94–98% here?",
      "At what pH do you start NIV, and why does that threshold matter?",
      "Explain the physiology of 'CO2 retention' in one sentence for the nurse."
    ],
    hidden_agenda: { reveal: "The nurse adds quietly: \"I should probably say — when he arrived his daughter asked us to 'give him as much oxygen as he needs'. I didn't want to argue with family. Maybe that's worth knowing.\"" }
  },
  {
    bed: "BED 17", demo: "Male, 18", specialty: "Emergency Medicine", cc: "Doctor, I've got the worst headache ever and there's this weird rash.",
    history: {
      onset: "Started overnight — I woke up around 3am with the worst headache I've ever had and I've been vomiting since.",
      light: "The light in the waiting room is killing my eyes — I've had to keep them shut.",
      neck: "My neck's really stiff — I can't touch my chin to my chest.",
      rash: "This purple rash appeared on my legs about two hours ago. It doesn't go away when I press a glass on it.",
      fever: "I feel boiling hot then shivering cold.",
      contacts: "I live in university halls — nobody else is sick that I know of. I was at a party Friday night.",
      general: "I'm scared, doctor. I just want to sleep. Why won't you let me sleep?"
    },
    exam: {
      vitals: "T 39.4°C, HR 128, BP 96/56, RR 24, SpO2 96%, GCS 14 — drowsy but rousable.",
      general: "Photophobic, drowsy, flushed then pale; purpuric non-blanching rash over trunk and legs; cold peripheries, cap refill 4s.",
      neuro: "Neck stiffness positive, Kernig's sign positive; photophobia marked; GCS 14, no focal deficit.",
      cardiovascular: "Tachycardic, thready pulse — compensated shock pattern.",
      abdomen: "Soft, non-tender."
    },
    investigations: {
      "fbc": { result: "WCC 19,400 with neutrophilia, platelets borderline low — consistent with severe bacterial infection.", indicated: true },
      "crp": { result: "320 mg/L — markedly elevated.", indicated: true },
      "lactate": { result: "4.2 mmol/L — sepsis with tissue hypoperfusion.", indicated: true },
      "blood cultures": { result: "Taken — result pending (48h). Should be drawn before antibiotics but must never delay them.", indicated: true },
      "urea and electrolytes": { result: "Creatinine 158 µmol/L — acute kidney injury from sepsis.", indicated: true },
      "ct head": { result: "Not appropriate before antibiotics in an unstable patient with classic meningococcal signs.", indicated: false },
      "lumbar puncture": { result: "Contraindicated now — unstable, GCS 14 and signs of raised ICP risk.", indicated: false }
    },
    diagnosis: "Meningococcal sepsis / bacterial meningitis (meningococcaemia)",
    essential_points: [
      "Sudden severe headache with fever",
      "Photophobia and neck stiffness",
      "Non-blanching (purpuric) rash — the critical finding",
      "Vomiting and drowsiness / altered consciousness",
      "Speed of progression (hours)",
      "Contacts and social setting (university halls)"
    ],
    management_key: [
      "ABCDE approach; treat this as a time-critical emergency",
      "Immediate empirical IV antibiotics (ceftriaxone, or benzylpenicillin pre-hospital) — do NOT wait for tests",
      "IV fluid resuscitation for sepsis; monitor lactate and urine output",
      "Take bloods, cultures and lactate — but never delay antibiotics for them",
      "Escalate early to resus/critical care (HDU/ICU) given shock signs",
      "No LP while unstable or with high-ICP signs",
      "Public health notification + prophylaxis for close contacts (halls)",
      "Document serial observations and reassess frequently"
    ],
    vitalsProfile: { baseline_hr: 128, critical_hr: 155, decompensate_start: 40, decompensate_full: 140, stabilizing_action: 'lactate' },
    persona: "A frightened 18-year-old who is sleepy-waking between sentences and complains about the lights. Answers in short bursts then drifts. The urgency should be felt — answers trail off if the student is slow.",
    critical: [2, 1, 3],
    viva: [
      "Which single finding makes this a can't-miss diagnosis, and what test confirms it at the bedside?",
      "Why can't you do a lumbar puncture now?",
      "What must happen in the first hour of sepsis management here?"
    ],
    hidden_agenda: { reveal: "The patient slurs slightly: \"I took a couple of pills at the party Friday — I don't even know what they were. Please don't tell my parents. Is that what this is? Did I do this to myself?\"" }
  }
];

export const EXAM_LABELS = {
  general: "General",
  vitals: "Vitals",
  cardiovascular: "Cardiovascular",
  respiratory: "Respiratory",
  abdomen: "Abdomen",
  neuro: "Neurological",
  msk: "Musculoskeletal",
  mental_state: "Mental State",
  genitourinary: "Genitourinary"
};

export const INV_QUICK = ["FBC", "ECG", "Troponin", "CXR", "Ultrasound", "Urinalysis", "Pregnancy test", "CRP"];

export const EXAM_ICONS = {
  general: "🧍", vitals: "🩺", cardiovascular: "🫀", respiratory: "🫁",
  abdomen: "🤢", neuro: "🧠", msk: "🦴", mental_state: "💭", genitourinary: "🚻"
};

export const SPECIALTY_META = {
  "Cardiology":               { icon: "🫀", tag: "Heart & vascular disease" },
  "Respiratory":              { icon: "🫁", tag: "Lung & breathing cases" },
  "General Surgery":          { icon: "🔪", tag: "Acute surgical abdomens" },
  "Obstetrics & Gynaecology": { icon: "🤰", tag: "Pregnancy & women's health" },
  "Family Medicine":          { icon: "🩺", tag: "Community & chronic care" },
  "Neurology":                { icon: "🧠", tag: "Brain & nervous system" },
  "Orthopaedics":             { icon: "🦴", tag: "Bones, joints & trauma" },
  "Paediatrics":              { icon: "👶", tag: "Child & infant care" },
  "Psychiatry":               { icon: "💭", tag: "Mental health care" },
  "Urology":                  { icon: "💧", tag: "Kidneys & urinary tract" }
};

export const PACE_OPTIONS = [
  { min: 5,  lbl: "Focused pace",  frac: 0.14 },
  { min: 10, lbl: "Focused pace",  frac: 0.32 },
  { min: 15, lbl: "Standard pace", frac: 0.52 },
  { min: 20, lbl: "Standard pace", frac: 0.72 },
  { min: 30, lbl: "Deep pace",     frac: 1.0  }
];

export const STATION_TYPES = {
  history: { icon: "🩺", label: "History & assessment" },
  counselling: { icon: "🗣", label: "Communication" },
  data: { icon: "📊", label: "Data interpretation" },
};

/** Default end-of-consult checklist — graded from the transcript. Cases can override with `closing_points`. */
export const DEFAULT_CLOSING_POINTS = [
  "Summarises or confirms the plan / next steps back to the patient",
  "Offers safety-netting advice (when to come back or seek urgent help)",
  "Asks if the patient has questions or addresses their concerns",
];

export const ACHIEVEMENT_LABELS = {
  first_case: '🏅 First Case',
  sharp_diagnosis: '🎯 Sharp Diagnosis',
  efficient_historian: '⚡ Efficient Historian',
  five_cases: '⭐ Five Cases Completed',
  good_steward: '🧪 Resourceful Steward',
  comm_pro: '🗣️ Communication Pro',
  safe_netter: '🛟 Safety-Netter',
  cue_catcher: '🧲 Cue Catcher',
  clear_pass: '🏆 Clear Pass',
  station_survivor: '⏱ Station Survivor',
};

export const DEFAULT_PROFILE = { xp: 0, casesCompleted: 0, achievements: [], reviewDeck: [], skillStats: {} };

/**
 * Pick a Gemini Live voice that fits the case's patient. Cases may pin an
 * exact voice via `voice`; otherwise derive from sex + age + persona keywords.
 * (Names are Gemini prebuilt voices — kept in sync with the server allowlist.)
 */
export function voiceForCase(c) {
  if (c.voice) return c.voice;
  const demo = c.demo || "";
  const isFemale = /female/i.test(demo);
  const age = Number((demo.match(/(\d{1,3})/) || [])[1]) || 40;
  const persona = (c.persona || "").toLowerCase();
  if (c.station_type === "data") return "Sulafat"; // warm nurse voice
  if (isFemale) {
    if (age >= 65) return "Vindemiatrix";
    if (age <= 28) return "Leda";
    if (/anxious|tearful|distress|worried/.test(persona)) return "Sulafat";
    return "Kore";
  }
  if (age >= 65) return "Charon";
  if (age <= 28) return "Sadachbia";
  if (/angry|gruff|stern|irritable/.test(persona)) return "Fenrir";
  return "Iapetus";
}
