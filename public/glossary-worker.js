// glossary-worker.js

// Helper to normalize strings for comparison (remove punctuation, whitespace, lowercase)
// Keep this in sync with the logic in Translator.tsx
const normalizeForMatch = (str) => str.toLowerCase().replace(/[^\w\u4e00-\u9fa5\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/g, '');

let glossaryNormalized = {};
let glossaryKeys = [];

self.onmessage = (e) => {
    const { type, payload } = e.data;

    if (type === 'LOAD_GLOSSARY') {
        const glossary = payload;
        const normalized = {};
        const keys = [];

        // Build the normalized index
        // This can be heavy, so good thing it's in a worker now
        Object.keys(glossary).forEach(key => {
            const val = glossary[key];
            if (!key || !val) return;
            
            const normKey = normalizeForMatch(key);
            if (normKey) {
                normalized[normKey] = val;
            }
            // We only need the original key if we want to return it, 
            // but for fuzzy matching we compare normalized keys against normalized input.
            // Actually, the previous logic iterated keys of glossaryNormalized.
        });

        // The keys we iterate over for fuzzy matching are the NORMALIZED keys
        glossaryNormalized = normalized;
        glossaryKeys = Object.keys(normalized);
        
        // Sort by length descending for better matching priority? 
        // Not strictly necessary for the loop but good practice.
        // glossaryKeys.sort((a, b) => b.length - a.length);

        self.postMessage({ type: 'LOAD_COMPLETE', count: Object.keys(glossary).length });
    } 
    else if (type === 'FIND_MATCH') {
        const { text, silent } = payload;
        const normalizedInput = normalizeForMatch(text);
        
        // 1. Exact/Normalized Lookup (Fast O(1))
        // We can do this here or on main thread. Doing it here keeps logic consolidated.
        if (glossaryNormalized[normalizedInput]) {
            self.postMessage({ 
                type: 'MATCH_FOUND', 
                payload: { 
                    translated: glossaryNormalized[normalizedInput],
                    method: 'Normalized',
                    original: text
                } 
            });
            return;
        }

        // 2. Fuzzy / Substring Match (Slow O(N))
        const searchKey = normalizedInput;
        
        // Only run expensive loop if we have enough chars
        if (searchKey.length > 2) {
            for (const key of glossaryKeys) {
                // Case A: OCR is substring of Key
                // Optimization: length check first
                if (key.length <= searchKey.length / 0.6 && key.includes(searchKey)) {
                    if (searchKey.length / key.length > 0.6) {
                        self.postMessage({ 
                            type: 'MATCH_FOUND', 
                            payload: { 
                                translated: glossaryNormalized[key],
                                method: 'Fuzzy (OCR in Key)',
                                matchKey: key
                            } 
                        });
                        return;
                    }
                }
                
                // Case B: Key is substring of OCR
                if (searchKey.length <= key.length / 0.6 && searchKey.includes(key)) {
                    if (key.length / searchKey.length > 0.6) {
                        self.postMessage({ 
                            type: 'MATCH_FOUND', 
                            payload: { 
                                translated: glossaryNormalized[key],
                                method: 'Fuzzy (Key in OCR)',
                                matchKey: key
                            } 
                        });
                        return;
                    }
                }
            }
        }

        self.postMessage({ type: 'NO_MATCH' });
    }
};
