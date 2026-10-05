// One source of truth for how every AI surface should write chemistry. The
// renderer (MoleculeView / ReactionView) turns these blocks into real
// structures; ASCII art can never be drawn well, so it is forbidden.

const F = "```";

export const CHEMISTRY_RULES = `CHEMISTRY — never draw molecules or reactions with ASCII/text art. Use fenced blocks that the app renders as real structures:

1) One molecule → a fenced block tagged "smiles":
${F}smiles
CCO
Ethanol
Formula: C2H6O
${F}
Line 1 = valid SMILES. Line 2 = the compound's common name. Line 3 (optional) = molecular formula; the app uses it to double-check your SMILES. To compare molecules, put several in one block, one per line as "SMILES | Name".

2) A reaction → a fenced block tagged "reaction":
${F}reaction
CCO.CC(=O)O>H2SO4>CC(=O)OCC.O
Fischer esterification
Conditions: heat, reflux
${F}
Line 1 = reactants>agents>products. Separate species with "." only — never "+" or "->". Agents may be formulas or names (H2SO4, NaOH, Pd/C), SMILES, or empty (A>>B). Line 2 = reaction name. "Conditions:" (optional) = heat, temperature, solvent. For a multi-step synthesis write one reaction line per step.

3) SMILES quality: balance every ring digit and parenthesis; write charges as [Na+], [OH-], [NH4+]; use isomeric SMILES for stereochemistry (L-alanine = N[C@@H](C)C(=O)O). Keep each structure under ~60 heavy atoms. If you are unsure of a SMILES, give the exact compound name on line 1 instead — the app can look it up — never a bare molecular formula.

4) Teaching style: start with the simplest example (chains such as ethanol, acetic acid, glycine) before rings. The app automatically draws small chains as textbook expanded structural formulas and rings as skeletal formulas, so you do not need to describe the drawing style.

5) SMILES cannot show curved-arrow mechanisms, Fischer/Haworth/chair projections, Lewis dot structures, proteins, DNA or polymers. For those, explain in words (or draw one repeat unit) — still no ASCII art.`;

export const CHEMISTRY_RULES_BRIEF = `For chemical structures use a fenced "smiles" block (line 1 valid SMILES, line 2 compound name, optional "Formula: C2H6O" line; several molecules as "SMILES | Name" lines). For reactions use a fenced "reaction" block (line 1 reactants>agents>products with species separated by "." only, e.g. CCO.CC(=O)O>H2SO4>CC(=O)OCC.O; line 2 the reaction name; optional "Conditions: heat" line; one line per step). Use isomeric SMILES for stereochemistry and [Na+]-style charges. If unsure of a SMILES, put the exact compound name instead — never a bare formula. Start with simple chain molecules before rings. Never draw molecules with ASCII art.`;
