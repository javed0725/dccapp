---
name: Bengali PDF shaping
description: Why Bengali result exports require OpenType shaping, not just embedded font coverage
---

Use a PDF engine with actual OpenType GSUB/GPOS shaping for Bengali text. Do not return class result exports to jsPDF's character-by-character TTF rendering.

**Why:** An embedded Noto Sans Bengali font and correct Unicode text extraction still produced misplaced vowel signs and broken conjuncts in the user's exported sheet. The user specifically observed গণিত and বিজ্ঞান breaking. PDFKit/fontkit correctly shaped গণিত, বিজ্ঞান, ইতিহাস, and পৌরনীতি.

**How to apply:** Preserve the vector-text OpenType rendering path for result PDFs. Regression checks must verify a substituted conjunct glyph (for example, জ্ঞ represented by one glyph mapped to multiple codepoints), plus inspect a rendered PDF at readable magnification. Font presence, a successful download, or text extraction alone is not evidence of correct shaping.

pdfmake's 0.3 releases can expose the shared font filesystem under different property names.

**Why:** Reconstructing dependencies exposed a font-registration API difference between installed 0.3 releases.

**How to apply:** Test the exact locked dependency version and preserve the compatibility handling when registering fonts; do not assume a caret-range update has identical runtime APIs.
