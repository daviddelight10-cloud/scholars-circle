import { describe, it, expect } from "vitest";
import {
  analyzeSmiles, condensedFormula, expandHydrogens, isValidSmiles, parseFormula, parseMoleculeBlock,
  parseReactionBlock, parseReactionLine, sameCounts, stripAtomMaps, agentLabel, prettyAgent,
} from "./chemistry.js";
import { renderExpandedSvg } from "./expandedFormula.js";
import known from "./knownMolecules.json";

const formulaOf = (s) => analyzeSmiles(s)?.formula;

describe("SMILES validation", () => {
  it("accepts ordinary molecules", () => {
    for (const s of ["CCO", "c1ccccc1", "CC(=O)Oc1ccccc1C(=O)O", "[Na+].[Cl-]", "N[C@@H](C)C(=O)O", "C/C=C/C", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"]) {
      expect(isValidSmiles(s), s).toBe(true);
    }
  });
  it("rejects what smiles-drawer would silently mis-draw", () => {
    for (const s of ["CO2", "C1CC", "c1ccccc", "CC(=O", "CCO)", "C(C)(C)(C)(C)C", "FC(F)(F)(F)F", "H2SO4", "water", ""]) {
      expect(isValidSmiles(s), s).toBe(false);
    }
  });
});

describe("formula and mass", () => {
  it.each([
    ["CCO", "C2H6O"], ["c1ccccc1", "C6H6"], ["CC(=O)Oc1ccccc1C(=O)O", "C9H8O4"], ["CN1C=NC2=C1C(=O)N(C(=O)N2C)C", "C8H10N4O2"],
    ["c1ccsc1", "C4H4S"], ["c1ccncc1", "C5H5N"], ["c1cc[nH]c1", "C4H5N"], ["[NH4+]", "H4N"], ["O", "H2O"], ["[H][H]", "H2"],
    ["OCC1OC(O)C(O)C(O)C1O", "C6H12O6"], ["OS(=O)(=O)O", "H2O4S"],
  ])("%s → %s", (smiles, formula) => expect(formulaOf(smiles)).toBe(formula));

  it("computes molar mass", () => expect(analyzeSmiles("CCO").mass).toBeCloseTo(46.07, 1));
  it("compares formulas regardless of notation", () => {
    expect(sameCounts(analyzeSmiles("CCO").counts, parseFormula("C₂H₆O"))).toBe(true);
    expect(sameCounts(analyzeSmiles("CCCO").counts, parseFormula("C2H6O"))).toBe(false);
    expect(parseFormula("not a formula")).toBeNull();
  });
});

describe("condensed + expanded text forms", () => {
  it.each([["CCO", "CH₃CH₂OH"], ["CC(=O)O", "CH₃C(=O)OH"], ["C=C", "CH₂=CH₂"], ["CCC", "CH₃CH₂CH₃"], ["CC(C)C", "CH₃CH(CH₃)CH₃"]])("%s → %s", (s, expected) => {
    expect(condensedFormula(analyzeSmiles(s).graph)).toBe(expected);
  });
  it("skips rings and salts", () => {
    expect(condensedFormula(analyzeSmiles("c1ccccc1").graph)).toBeNull();
    expect(condensedFormula(analyzeSmiles("[Na+].[Cl-]").graph)).toBeNull();
  });
  it("spells out every hydrogen without changing the molecule", () => {
    expect(expandHydrogens("CCO")).toBe("C([H])([H])([H])C([H])([H])O([H])");
    for (const s of ["CC(=O)O", "C=C", "CC(C)C", "NCC(=O)O", "[NH4+]"]) {
      const out = expandHydrogens(s);
      expect(out, s).toBeTruthy();
      expect(formulaOf(out), s).toBe(formulaOf(s));
    }
    expect(expandHydrogens("c1ccccc1")).toBeNull();
  });
});

describe("reaction parsing", () => {
  it("reads reaction SMILES with and without agents", () => {
    expect(parseReactionLine("CCO.CC(=O)O>H2SO4>CC(=O)OCC.O")).toEqual([{ reactants: ["CCO", "CC(=O)O"], agents: ["H2SO4"], products: ["CC(=O)OCC", "O"] }]);
    expect(parseReactionLine("CCO>>CC=O")[0].agents).toEqual([]);
  });
  it("reads arrow notation (->, →, =>) and ' + ' separators", () => {
    expect(parseReactionLine("CCO -> CC=O")[0].products).toEqual(["CC=O"]);
    expect(parseReactionLine("ethanol + acetic acid → ethyl acetate + water")[0]).toEqual({ reactants: ["ethanol", "acetic acid"], agents: [], products: ["ethyl acetate", "water"] });
  });
  it("never splits a charge on a bare +", () => {
    expect(parseReactionLine("CC(=O)OCC.[Na+].[OH-]>>CC(=O)[O-].[Na+]")[0].reactants).toEqual(["CC(=O)OCC", "[Na+]", "[OH-]"]);
  });
  it("splits chained arrows into steps and rejects non-reactions", () => {
    expect(parseReactionLine("CCBr>>CCO>>CC=O")).toHaveLength(2);
    expect(parseReactionLine("CCO")).toBeNull();
    expect(parseReactionLine("A>>")).toBeNull();
  });
  it("strips atom-map numbers", () => expect(stripAtomMaps("[CH3:1][OH:2]")).toBe("[CH3][OH]"));
  it("labels agents", () => {
    expect(agentLabel("OS(=O)(=O)O")).toBe("H₂SO₄");
    expect(prettyAgent("K2Cr2O7, heat")).toBe("K₂Cr₂O₇, Δ");
  });
});

describe("block parsing", () => {
  it("parses SMILES / name / formula lines in any order", () => {
    expect(parseMoleculeBlock("CCO\nEthanol\nFormula: C2H6O").entries).toEqual([{ raw: "CCO", name: "Ethanol", formula: "C2H6O" }]);
    expect(parseMoleculeBlock("Ethanol\nCCO").entries[0]).toMatchObject({ raw: "CCO", name: "Ethanol" });
    expect(parseMoleculeBlock("glucose").entries[0]).toMatchObject({ raw: "glucose" });
  });
  it("parses several molecules", () => {
    expect(parseMoleculeBlock("CCO | Ethanol\nCCN | Ethylamine").entries.map((e) => e.name)).toEqual(["Ethanol", "Ethylamine"]);
    expect(parseMoleculeBlock("CCCC\nButane\nCC(C)C\nIsobutane").entries.map((e) => [e.raw, e.name])).toEqual([["CCCC", "Butane"], ["CC(C)C", "Isobutane"]]);
  });
  it("parses reaction blocks with conditions, names and steps", () => {
    const r = parseReactionBlock("CCO>>CC=O\nConditions: K2Cr2O7\nOxidation\nCC=O>>CC(=O)O");
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0].conditions).toBe("K2Cr2O7");
    expect(r.caption).toBe("Oxidation");
    expect(parseReactionBlock("just a sentence").steps).toHaveLength(0);
  });
});

describe("expanded structural formula renderer", () => {
  it("draws simple chains with labelled groups", () => {
    const svg = renderExpandedSvg("CCO").markup;
    expect(svg).toContain("OH");
    expect(svg.match(/>H</g)).toHaveLength(5);
    for (const s of ["C", "CC(=O)O", "NCC(=O)O", "CC(C)(C)O", "C=C", "C#C", "CCOC(=O)C", "O", "N"]) expect(renderExpandedSvg(s), s).not.toBeNull();
  });
  it("declines rings, aromatics, salts and big molecules", () => {
    for (const s of ["c1ccccc1", "C1CCCCC1", "[Na+].[Cl-]", "CCCCCCCCCCCCCCC", "[NH4+]"]) expect(renderExpandedSvg(s), s).toBeNull();
  });
});

describe("built-in molecule library", () => {
  const entries = [...new Map(Object.values(known).map((e) => [e[0] + e[1], e])).values()];
  it("has a few hundred molecules", () => expect(entries.length).toBeGreaterThan(200));
  it("every SMILES is valid and matches its stated formula", () => {
    for (const [smiles, formula, name] of entries) {
      const info = analyzeSmiles(smiles);
      expect(info, name).not.toBeNull();
      expect(sameCounts(info.counts, parseFormula(formula)), `${name}: ${info.formula} vs ${formula}`).toBe(true);
    }
  });
  it("keeps the sugars distinct", () => {
    expect(new Set(["glucose", "galactose", "mannose"].map((k) => known[k][0])).size).toBe(3);
    expect(known.lactose[0]).not.toBe(known.maltose[0]);
  });
});
