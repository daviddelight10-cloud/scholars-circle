const FILE_TYPES = ["pdf", "docx", "pptx", "txt", "image", "doc", "note", "tutorial_question"];

/**
 * Groups a flat resource list into source files + variants (mcq, flashcard, summary)
 * and standalone items, exactly like the folderCategorized logic in ResearchHub.
 *
 * @param {Array} resources - flat array of resource objects (must include derivedResources + sourceResourceId)
 * @returns {{ materials, summaries, flashcards, mcqs, allMcqResources, counts }}
 */
export function categorizeResources(resources) {
  const sourceFiles = [];
  const standaloneItems = [];
  const derivedBySource = {};

  for (const r of resources) {
    if (r.sourceResourceId) {
      if (!derivedBySource[r.sourceResourceId]) derivedBySource[r.sourceResourceId] = [];
      derivedBySource[r.sourceResourceId].push(r);
    }
  }

  for (const r of resources) {
    if (r.sourceResourceId) continue;

    if (FILE_TYPES.includes(r.contentType)) {
      const derived = r.derivedResources || derivedBySource[r.id] || [];
      const variants = { summary: null, mcq: null, flashcard: null };
      for (const d of derived) {
        if (d.contentType === "mcq") variants.mcq = d;
        else if (d.contentType === "flashcard_deck") variants.flashcard = d;
        else if (d.contentType === "pdf" && d.fileName?.startsWith("[AI] Summary")) variants.summary = d;
        else if (d.contentType === "pdf" && d.description && d.title === r.title) variants.summary = d;
      }
      sourceFiles.push({ ...r, variants, standalone: false });
    } else if (r.contentType === "mcq") {
      standaloneItems.push({ ...r, variants: { summary: null, mcq: r, flashcard: null }, standalone: true });
    } else if (r.contentType === "flashcard_deck") {
      standaloneItems.push({ ...r, variants: { summary: null, mcq: null, flashcard: r }, standalone: true });
    } else if (r.contentType === "pdf" && r.title?.startsWith("[AI] Summary")) {
      standaloneItems.push({ ...r, variants: { summary: r, mcq: null, flashcard: null }, standalone: true });
    } else {
      sourceFiles.push({ ...r, variants: { summary: null, mcq: null, flashcard: null }, standalone: false });
    }
  }

  const allItems = [...sourceFiles, ...standaloneItems];
  const summaryCount = allItems.filter((f) => f.variants.summary).length;
  const flashcardCount = allItems.filter((f) => f.variants.flashcard).length;
  const mcqCount = allItems.filter((f) => f.variants.mcq).length;
  const allMcqs = allItems.filter((f) => f.variants.mcq).map((f) => f.variants.mcq);

  return {
    materials: sourceFiles,
    summaries: allItems.filter((f) => f.variants.summary),
    flashcards: allItems.filter((f) => f.variants.flashcard),
    mcqs: allItems.filter((f) => f.variants.mcq),
    allMcqResources: allMcqs,
    counts: {
      materials: sourceFiles.length,
      summaries: summaryCount,
      flashcards: flashcardCount,
      mcqs: mcqCount,
    },
  };
}
