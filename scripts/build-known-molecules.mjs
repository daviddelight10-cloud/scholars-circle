// Builds src/lib/knownMolecules.json from PubChem (isomeric SMILES + formula).
// Run: node scripts/build-known-molecules.mjs   (needs network, ~3 min)
// Entry format: "PubChem query | Display name | alias, alias, …"
import fs from "node:fs";

const LIST = `
methane|Methane|CH4
ethane|Ethane
propane|Propane
butane|Butane|nbutane
pentane|Pentane
hexane|Hexane
heptane|Heptane
octane|Octane
nonane|Nonane
decane|Decane
isobutane|Isobutane|2-methylpropane
isopentane|2-Methylbutane|isopentane
neopentane|Neopentane|2,2-dimethylpropane
cyclopropane|Cyclopropane
cyclobutane|Cyclobutane
cyclopentane|Cyclopentane
cyclohexane|Cyclohexane
ethylene|Ethene|ethene,ethylene,C2H4
propene|Propene|propylene
1-butene|1-Butene|but-1-ene
2-butene|2-Butene|but-2-ene
trans-2-butene|trans-2-Butene
cis-2-butene|cis-2-Butene
isoprene|Isoprene
1,3-butadiene|1,3-Butadiene|butadiene
acetylene|Ethyne|ethyne,acetylene,C2H2
propyne|Propyne
methanol|Methanol|methylalcohol,CH3OH
ethanol|Ethanol|ethylalcohol,C2H5OH,alcohol
1-propanol|Propan-1-ol|propanol,propan1ol
isopropanol|Propan-2-ol|isopropylalcohol,propan2ol,2propanol
1-butanol|Butan-1-ol|butanol,butan1ol
2-butanol|Butan-2-ol
tert-butanol|tert-Butanol|tertbutylalcohol,2methylpropan2ol
ethylene glycol|Ethylene glycol|ethane12diol
glycerol|Glycerol|glycerin,propane123triol
formaldehyde|Formaldehyde|methanal,HCHO
acetaldehyde|Acetaldehyde|ethanal,CH3CHO
propionaldehyde|Propanal|propanal
benzaldehyde|Benzaldehyde
acetone|Acetone|propanone,CH3COCH3
2-butanone|Butanone|butanone,methylethylketone
formic acid|Formic acid|methanoicacid,HCOOH
acetic acid|Acetic acid|ethanoicacid,CH3COOH,vinegar
propionic acid|Propanoic acid|propanoicacid,propionicacid
butyric acid|Butanoic acid|butanoicacid,butyricacid
valeric acid|Pentanoic acid|pentanoicacid
caproic acid|Hexanoic acid|hexanoicacid
oxalic acid|Oxalic acid|ethanedioicacid
malonic acid|Malonic acid|propanedioicacid
succinic acid|Succinic acid|succinate,butanedioicacid
fumaric acid|Fumaric acid|fumarate
maleic acid|Maleic acid|maleate
malic acid|Malic acid|malate
tartaric acid|Tartaric acid|tartrate
citric acid|Citric acid|citrate
isocitric acid|Isocitric acid|isocitrate
lactic acid|Lactic acid|lactate
pyruvic acid|Pyruvic acid|pyruvate
oxaloacetic acid|Oxaloacetic acid|oxaloacetate
alpha-ketoglutaric acid|alpha-Ketoglutaric acid|alphaketoglutarate,2oxoglutarate,akg
benzoic acid|Benzoic acid
salicylic acid|Salicylic acid
acetoacetic acid|Acetoacetic acid|acetoacetate
3-hydroxybutyric acid|3-Hydroxybutyric acid|betahydroxybutyrate,bhb
carbonic acid|Carbonic acid|H2CO3
methylamine|Methylamine
dimethylamine|Dimethylamine
trimethylamine|Trimethylamine
ethylamine|Ethylamine
aniline|Aniline
urea|Urea|carbamide
acetamide|Acetamide
formamide|Formamide
acetonitrile|Acetonitrile
ethyl acetate|Ethyl acetate|ethylethanoate
methyl acetate|Methyl acetate
diethyl ether|Diethyl ether|ether,ethoxyethane
tetrahydrofuran|Tetrahydrofuran|thf
dimethyl sulfoxide|Dimethyl sulfoxide|dmso
chloroform|Chloroform|trichloromethane
dichloromethane|Dichloromethane|methylenechloride
carbon tetrachloride|Carbon tetrachloride|tetrachloromethane
chloromethane|Chloromethane|methylchloride
chloroethane|Chloroethane|ethylchloride
bromoethane|Bromoethane|ethylbromide
benzene|Benzene
toluene|Toluene|methylbenzene
phenol|Phenol
styrene|Styrene
naphthalene|Naphthalene
anthracene|Anthracene
pyridine|Pyridine
pyrrole|Pyrrole
furan|Furan
thiophene|Thiophene
imidazole|Imidazole
indole|Indole
pyrimidine|Pyrimidine
purine|Purine
o-xylene|o-Xylene
nitrobenzene|Nitrobenzene
acetophenone|Acetophenone
water|Water|H2O
ammonia|Ammonia|NH3
carbon dioxide|Carbon dioxide|CO2
carbon monoxide|Carbon monoxide
hydrogen peroxide|Hydrogen peroxide|H2O2
sulfuric acid|Sulfuric acid|H2SO4
nitric acid|Nitric acid|HNO3
hydrochloric acid|Hydrochloric acid|HCl,hydrogenchloride
phosphoric acid|Phosphoric acid|H3PO4
sodium hydroxide|Sodium hydroxide|NaOH
potassium hydroxide|Potassium hydroxide|KOH
sodium chloride|Sodium chloride|NaCl,salt
sodium bicarbonate|Sodium bicarbonate|NaHCO3,bakingsoda
oxygen|Oxygen|O2
nitrogen|Nitrogen|N2
chlorine|Chlorine|Cl2
bromine|Bromine|Br2
D-glucopyranose|Glucose|glucose,dglucose,dextrose,C6H12O6
D-fructofuranose|Fructose|fructose,dfructose
D-galactopyranose|Galactose|galactose,dgalactose
D-mannopyranose|Mannose|mannose,dmannose
D-ribofuranose|Ribose|ribose,dribose
2-deoxy-D-ribofuranose|Deoxyribose|deoxyribose
sucrose|Sucrose|tablesugar
lactose|Lactose
maltose|Maltose
trehalose|Trehalose
glucose 6-phosphate|Glucose 6-phosphate|glucose6phosphate,g6p
fructose 6-phosphate|Fructose 6-phosphate|fructose6phosphate,f6p
fructose 1,6-bisphosphate|Fructose 1,6-bisphosphate|fructose16bisphosphate,fbp
glyceraldehyde 3-phosphate|Glyceraldehyde 3-phosphate|g3p,gap
dihydroxyacetone phosphate|Dihydroxyacetone phosphate|dhap
3-phosphoglyceric acid|3-Phosphoglycerate|3phosphoglycerate,3pg
phosphoenolpyruvate|Phosphoenolpyruvate|pep
glycine|Glycine|gly
L-alanine|Alanine|alanine,lalanine,ala
L-valine|Valine|valine,val
L-leucine|Leucine|leucine,leu
L-isoleucine|Isoleucine|isoleucine,ile
L-serine|Serine|serine,ser
L-threonine|Threonine|threonine,thr
L-cysteine|Cysteine|cysteine,cys
L-methionine|Methionine|methionine,met
L-proline|Proline|proline,pro
L-phenylalanine|Phenylalanine|phenylalanine,phe
L-tyrosine|Tyrosine|tyrosine,tyr
L-tryptophan|Tryptophan|tryptophan,trp
L-aspartic acid|Aspartate|aspartate,asparticacid,asp
L-asparagine|Asparagine|asparagine,asn
L-glutamic acid|Glutamate|glutamate,glutamicacid,glu
L-glutamine|Glutamine|glutamine,gln
L-lysine|Lysine|lysine,lys
L-arginine|Arginine|arginine,arg
L-histidine|Histidine|histidine,his
taurine|Taurine
creatine|Creatine
creatinine|Creatinine
carnitine|Carnitine
glutathione|Glutathione
gamma-aminobutyric acid|GABA|gaba
adenine|Adenine
guanine|Guanine
cytosine|Cytosine
uracil|Uracil
thymine|Thymine
adenosine|Adenosine
guanosine|Guanosine
cytidine|Cytidine
uridine|Uridine
thymidine|Thymidine
adenosine monophosphate|AMP|amp
adenosine diphosphate|ADP|adp
adenosine triphosphate|ATP|atp
cyclic AMP|cAMP|camp
guanosine triphosphate|GTP|gtp
NAD+|NAD+|nad,nadplus
NADH|NADH
NADPH|NADPH
flavin adenine dinucleotide|FAD|fad
acetyl coenzyme A|Acetyl-CoA|acetylcoa
coenzyme A|Coenzyme A|coa
uric acid|Uric acid
cholesterol|Cholesterol
palmitic acid|Palmitic acid|hexadecanoicacid,palmitate
stearic acid|Stearic acid|stearate
oleic acid|Oleic acid|oleate
linoleic acid|Linoleic acid
arachidonic acid|Arachidonic acid
testosterone|Testosterone
estradiol|Estradiol|oestradiol
progesterone|Progesterone
cortisol|Cortisol|hydrocortisone
aldosterone|Aldosterone
thyroxine|Thyroxine|levothyroxine,t4
epinephrine|Adrenaline|adrenaline,epinephrine
norepinephrine|Noradrenaline|noradrenaline,norepinephrine
dopamine|Dopamine
serotonin|Serotonin|5ht
histamine|Histamine
acetylcholine|Acetylcholine|ach
melatonin|Melatonin
retinol|Vitamin A (Retinol)|vitamina,retinol
thiamine|Vitamin B1 (Thiamine)|vitaminb1,thiamin
riboflavin|Vitamin B2 (Riboflavin)|vitaminb2
niacin|Vitamin B3 (Niacin)|vitaminb3,nicotinicacid
nicotinamide|Nicotinamide|niacinamide
pyridoxine|Vitamin B6 (Pyridoxine)|vitaminb6
folic acid|Folic acid|vitaminb9,folate
biotin|Biotin|vitaminb7
ascorbic acid|Vitamin C (Ascorbic acid)|vitaminc,ascorbate
cholecalciferol|Vitamin D3|vitamind,vitamind3
alpha-tocopherol|Vitamin E|vitamine,tocopherol
phylloquinone|Vitamin K1|vitamink,vitamink1
aspirin|Aspirin|acetylsalicylicacid
acetaminophen|Paracetamol|paracetamol,acetaminophen
ibuprofen|Ibuprofen
naproxen|Naproxen
diclofenac|Diclofenac
indomethacin|Indomethacin
caffeine|Caffeine
theophylline|Theophylline
nicotine|Nicotine
morphine|Morphine
codeine|Codeine
heroin|Heroin
tramadol|Tramadol
penicillin G|Penicillin G|penicillin,benzylpenicillin
amoxicillin|Amoxicillin
ampicillin|Ampicillin
cephalexin|Cephalexin
ciprofloxacin|Ciprofloxacin
metronidazole|Metronidazole
doxycycline|Doxycycline
tetracycline|Tetracycline
isoniazid|Isoniazid
pyrazinamide|Pyrazinamide
ethambutol|Ethambutol
chloroquine|Chloroquine
quinine|Quinine
artemisinin|Artemisinin
metformin|Metformin
glibenclamide|Glibenclamide|glyburide
atorvastatin|Atorvastatin
simvastatin|Simvastatin
omeprazole|Omeprazole
ranitidine|Ranitidine
salbutamol|Salbutamol|albuterol
propranolol|Propranolol
atenolol|Atenolol
amlodipine|Amlodipine
lisinopril|Lisinopril
captopril|Captopril
furosemide|Furosemide
hydrochlorothiazide|Hydrochlorothiazide
digoxin|Digoxin
warfarin|Warfarin
diazepam|Diazepam
fluoxetine|Fluoxetine
sertraline|Sertraline
haloperidol|Haloperidol
chlorpromazine|Chlorpromazine
lidocaine|Lidocaine|lignocaine
ephedrine|Ephedrine
dexamethasone|Dexamethasone
prednisolone|Prednisolone
loratadine|Loratadine
diphenhydramine|Diphenhydramine
ethinylestradiol|Ethinylestradiol
sildenafil|Sildenafil
`;

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(query) {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/property/SMILES,MolecularFormula/JSON`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (r.status === 503 || r.status === 429) { await sleep(1500); continue; }
      const j = await r.json();
      const p = j.PropertyTable?.Properties?.[0];
      return p ? { smiles: p.SMILES || p.IsomericSMILES, formula: p.MolecularFormula } : null;
    } catch { await sleep(800); }
  }
  return null;
}

const out = {};
const failed = [];
const rows = LIST.split("\n").map((l) => l.trim()).filter(Boolean);
for (const row of rows) {
  const [query, display, aliases = ""] = row.split("|").map((x) => x.trim());
  const res = await lookup(query);
  await sleep(230);
  if (!res?.smiles) { failed.push(query); console.log("FAIL", query); continue; }
  const entry = [res.smiles, res.formula, display];
  for (const key of new Set([query, display, ...aliases.split(",")].map(norm).filter(Boolean))) out[key] ??= entry;
  console.log("ok  ", query, res.smiles);
}
fs.writeFileSync(new URL("../src/lib/knownMolecules.json", import.meta.url), JSON.stringify(out));
console.log(`\n${rows.length - failed.length}/${rows.length} resolved, ${Object.keys(out).length} keys. Failed: ${failed.join(", ") || "none"}`);
