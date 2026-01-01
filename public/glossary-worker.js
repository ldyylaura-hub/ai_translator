// glossary-worker.js

// Helper to normalize strings for comparison (remove punctuation, whitespace, lowercase)
const normalizeForMatch = (str) => str.toLowerCase().replace(/[^\w\u4e00-\u9fa5\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/g, '');

let glossary = {}; // Keep raw glossary for Exact match and Substitution
let glossaryNormalized = {}; // For Normalized match
let glossaryKeys = []; // For Fuzzy match
let glossaryTerms = []; // For Substitution (sorted by length)

self.onmessage = (e) => {
    const { type, payload, id } = e.data;

    if (type === 'LOAD_GLOSSARY') {
        glossary = payload || {};
        const normalized = {};
        const terms = [];

        // Build indices
        Object.keys(glossary).forEach(key => {
            const val = glossary[key];
            if (!key || !val) return;
            
            // Normalized Index
            const normKey = normalizeForMatch(key);
            if (normKey) {
                normalized[normKey] = val;
            }
            terms.push(key);
        });

        glossaryNormalized = normalized;
        glossaryKeys = Object.keys(normalized);
        
        // Sort terms by length descending for greedy substitution
        terms.sort((a, b) => b.length - a.length);
        glossaryTerms = terms;

        self.postMessage({ type: 'LOAD_COMPLETE', count: Object.keys(glossary).length });
    } 
    else if (type === 'FIND_MATCH') {
        const { text, silent } = payload;
        const trimmedText = text.trim();
        
        // 1. Exact Match
        if (glossary[trimmedText]) {
            self.postMessage({ 
                id,
                type: 'MATCH_FOUND', 
                payload: { 
                    translated: glossary[trimmedText],
                    method: 'Exact'
                } 
            });
            return;
        }

        const normalizedInput = normalizeForMatch(trimmedText);

        // 2. Normalized Match
        if (glossaryNormalized[normalizedInput]) {
            self.postMessage({ 
                id,
                type: 'MATCH_FOUND', 
                payload: { 
                    translated: glossaryNormalized[normalizedInput],
                    method: 'Normalized'
                } 
            });
            return;
        }

        // 3. Fuzzy / Substring Match (OCR vs Keys)
        // Only run if input has enough content
        if (normalizedInput.length > 2) {
            // Optimization: Limit checking if we have a massive DB to avoid timeouts?
            // But since we are in a worker, we can afford some time. 
            // However, for 100k items, looping might still be 100-200ms.
            
            for (const key of glossaryKeys) {
                // Case A: OCR is substring of Key
                if (key.length <= normalizedInput.length / 0.6 && key.includes(normalizedInput)) {
                    if (normalizedInput.length / key.length > 0.6) {
                        self.postMessage({ 
                            id,
                            type: 'MATCH_FOUND', 
                            payload: { 
                                translated: glossaryNormalized[key],
                                method: 'Fuzzy (OCR in Key)'
                            } 
                        });
                        return;
                    }
                }
                
                // Case B: Key is substring of OCR
                if (normalizedInput.length <= key.length / 0.6 && normalizedInput.includes(key)) {
                    if (key.length / normalizedInput.length > 0.6) {
                        self.postMessage({ 
                            id,
                            type: 'MATCH_FOUND', 
                            payload: { 
                                translated: glossaryNormalized[key],
                                method: 'Fuzzy (Key in OCR)'
                            } 
                        });
                        return;
                    }
                }
            }
        }

        // 4. Term Substitution
        // If no full match found, try to replace terms within the text
        let textToTranslate = text;
        let hasSubstitution = false;
        
        // Optimization: Don't run substitution if text is too long (e.g. huge paragraph) to avoid regex perf issues?
        // Or just run it.
        if (glossaryTerms.length > 0) {
            for (const term of glossaryTerms) {
                if (textToTranslate.includes(term)) {
                    const targetVal = glossary[term];
                    // Escape regex special chars
                    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escapedTerm, 'g');
                    textToTranslate = textToTranslate.replace(regex, targetVal);
                    hasSubstitution = true;
                }
            }
        }

        if (hasSubstitution) {
             self.postMessage({ 
                id,
                type: 'SUBSTITUTION_DONE', 
                payload: { 
                    text: textToTranslate,
                    method: 'Substitution'
                } 
            });
            return;
        }

        self.postMessage({ id, type: 'NO_MATCH' });
    }
};
