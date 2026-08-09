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
    vitalsProfile: { baseline_hr: 102, critical_hr: 138, decompensate_start: 60, decompensate_full: 180, stabilizing_action: 'ecg' }
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
    vitalsProfile: { baseline_hr: 96, critical_hr: 120, decompensate_start: 120, decompensate_full: 300, stabilizing_action: 'ultrasound' }
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
    vitalsProfile: { baseline_hr: 110, critical_hr: 132, decompensate_start: 90, decompensate_full: 240, stabilizing_action: 'cxr' }
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
    vitalsProfile: { baseline_hr: 118, critical_hr: 155, decompensate_start: 45, decompensate_full: 150, stabilizing_action: 'ultrasound' }
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
    ]
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
    ]
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
    ]
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
    vitalsProfile: { baseline_hr: 138, critical_hr: 170, decompensate_start: 30, decompensate_full: 120, stabilizing_action: 'cxr' }
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
    ]
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

export const ACHIEVEMENT_LABELS = {
  first_case: '🏅 First Case',
  sharp_diagnosis: '🎯 Sharp Diagnosis',
  efficient_historian: '⚡ Efficient Historian',
  five_cases: '⭐ Five Cases Completed',
  good_steward: '🧪 Resourceful Steward'
};

export const DEFAULT_PROFILE = { xp: 0, casesCompleted: 0, achievements: [], reviewDeck: [] };
