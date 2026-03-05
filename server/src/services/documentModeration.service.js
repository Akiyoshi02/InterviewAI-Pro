import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { PDFParse } from 'pdf-parse';
import mammothPkg from 'mammoth';
import WordExtractorPkg from 'word-extractor';
import { countries as COUNTRIES } from 'countries-list';
import { franc } from 'franc-min';
import logger from '../utils/logger.js';
import { LLMService } from './llm.service.js';

const mammoth = mammothPkg.default || mammothPkg;
const WordExtractor = WordExtractorPkg.default || WordExtractorPkg;

const MIN_CHAR_COUNT = 400;
const MIN_WORD_COUNT = 80;
const MIN_UNIQUE_WORDS = 40;
const MIN_SECTION_MATCHES = 2;

const SECTION_KEYWORDS = [
  ['experience', 'employment', 'work history', 'professional'],
  ['education', 'university', 'college', 'bachelor', 'master', 'degree'],
  ['skills', 'technologies', 'competencies', 'stack'],
  ['projects', 'portfolio', 'accomplishments'],
  ['summary', 'objective', 'profile'],
  ['certifications', 'licenses', 'awards'],
];

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const EMAIL_REGEX_GLOBAL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;

const BUSINESS_MIN_CHAR_COUNT = 300;
const BUSINESS_MIN_WORD_COUNT = 60;
const BUSINESS_MIN_UNIQUE_WORDS = 30;
const BUSINESS_MIN_SECTION_MATCHES = 2;
const MAX_DOC_AGE_YEARS = 3;
const MAX_REGISTERED_REG_NUMBERS = 5;

const BUSINESS_SECTION_KEYWORDS = [
  ['business', 'company', 'organization', 'organisation', 'enterprise'],
  ['registration', 'incorporation', 'certificate', 'licence', 'license', 'permit'],
  ['tax', 'gst', 'vat', 'ein', 'tin', 'pan', 'uen', 'cin', 'uen'],
  ['authority', 'government', 'ministry', 'department', 'commission', 'municipal'],
  ['address', 'headquarters', 'office', 'location', 'contact'],
];

const RESUME_MIN_SIZE_BYTES = 10 * 1024;
const RESUME_MAX_SIZE_BYTES = 50 * 1024 * 1024;
const RESUME_MIN_ESTIMATED_PAGES = 1;
const RESUME_MAX_ESTIMATED_PAGES = 6;
const RESUME_LLM_REJECTION_CODE = 'RESUME_LLM_REJECTED';
const RESUME_LLM_PRIMARY_REJECTION_CONFIDENCE = 0.65;
const WORDS_PER_PAGE_ESTIMATE = 450;
const CORE_RESUME_SECTIONS = [
  ['experience', 'work history', 'employment'],
  ['education', 'academic', 'university'],
];
const SUPPORTING_RESUME_SECTIONS = [
  ['skills', 'competencies'],
  ['projects', 'portfolio'],
  ['certifications', 'licenses'],
  ['summary', 'objective', 'profile'],
  ['volunteer', 'community'],
];
const PLACEHOLDER_PATTERNS = [
  'lorem ipsum',
  'your name here',
  '[company name]',
  '[insert',
  '{{',
  '}}',
  '<<',
  '>>',
  'your@email.com',
  '123-456-7890',
];

const REGISTRATION_CONTEXT_KEYWORDS = [
  'registration',
  'reg.',
  'company number',
  'business number',
  'certificate',
  'license',
  'licence',
  'permit',
  'gst',
  'vat',
  'uen',
  'cin',
  'tax id',
  'brn',
];

const CORPORATE_SUFFIXES = [
  'inc',
  'inc.',
  'incorporated',
  'llc',
  'l.l.c',
  'ltd',
  'ltd.',
  'limited',
  'pty',
  'pte',
  'plc',
  'corp',
  'corp.',
  'corporation',
  'company',
  'co',
  's.a.',
  's.p.a',
  'gmbh',
  'ag',
];

const REGISTRATION_NUMBER_REGEX = /\b([A-Z]{1,4}\d[\dA-Z\-\/]{3,}|[A-Z0-9]{6,})\b/g;
const ADDRESS_REGEX = /\b\d{1,5}\s+[A-Za-z0-9.,\-/\s]+(street|st\.|road|rd\.|avenue|ave\.|boulevard|blvd\.|suite|ste\.|floor|fl\.|building|lane|ln\.|drive|dr\.|block|tower)\b/i;
const POSTAL_CODE_REGEX = /\b\d{4,6}(?:-\d{2,4})?\b/;
const GOVERNMENT_KEYWORDS = ['government', 'ministry', 'department', 'authority', 'commission', 'secretary', 'republic', 'federal', 'state'];
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const sanitizeCountryLabel = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const COUNTRY_VARIANTS = Object.values(COUNTRIES).flatMap((country) => {
  const variants = new Set();
  [country.name, country.native, country.capital]
    .filter(Boolean)
    .forEach((label) => {
      const normalized = sanitizeCountryLabel(label);
      if (normalized.length >= 4) {
        variants.add(normalized);
      }
    });
  return Array.from(variants).map((keyword) => ({
    country: country.name,
    keyword,
  }));
});

const ensureFileExists = async (filePath) => {
  if (!filePath) {
    throw new Error('No file provided for verification.');
  }
  const resolved = path.resolve(filePath);
  try {
    await fs.access(resolved);
  } catch {
    throw new Error('Uploaded document is not available for verification.');
  }
  return resolved;
};

const normalizeText = (text = '') =>
  text
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parsePdfText = async (buffer) => {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    const text = normalizeText(result?.text || '');
    if (!text) {
      throw new Error('We could not read any text from the PDF. Please upload a searchable document (not a scanned image).');
    }
    return text;
  } catch (error) {
    logger.warn('PDF parsing failed during moderation', { error: error.message });
    throw new Error('We could not open your PDF. Please upload a standard PDF document.');
  }
};

const parseDocxText = async (resolvedPath) => {
  try {
    const result = await mammoth.extractRawText({ path: resolvedPath });
    const text = normalizeText(result?.value || '');
    if (!text) {
      throw new Error('We could not read any text from the document. Please upload an editable DOCX or PDF file.');
    }
    return text;
  } catch (error) {
    logger.warn('DOCX parsing failed during moderation', { error: error.message });
    throw new Error('We could not open your DOCX document. Please upload a valid DOCX or PDF file.');
  }
};

const parseDocText = async (resolvedPath) => {
  try {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(resolvedPath);
    const text = normalizeText(doc?.getBody?.() || '');
    if (!text) {
      throw new Error('We could not read any text from the document. Please upload an editable Word or PDF file.');
    }
    return text;
  } catch (error) {
    logger.warn('DOC parsing failed during moderation', { error: error.message });
    throw new Error('We could not open your .doc document. Please re-export it as DOCX or PDF and try again.');
  }
};

const detectDocumentType = (originalName = '', mimeType = '') => {
  const normalizedName = originalName.toLowerCase();
  const normalizedMime = mimeType.toLowerCase();

  if (normalizedMime === 'application/pdf' || normalizedName.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || normalizedName.endsWith('.docx')
  ) {
    return 'docx';
  }
  if (normalizedMime === 'application/msword' || normalizedName.endsWith('.doc')) {
    return 'doc';
  }
  return null;
};

const extractDocumentText = async (resolvedPath, docType, buffer) => {
  if (docType === 'pdf') {
    return parsePdfText(buffer);
  }
  if (docType === 'docx') {
    return parseDocxText(resolvedPath);
  }
  return parseDocText(resolvedPath);
};

const ensureSupportedDocument = async (filePath, fileMeta = {}, unsupportedMessage) => {
  const resolvedPath = await ensureFileExists(filePath);
  const buffer = await fs.readFile(resolvedPath);
  const hash = createHash('sha256').update(buffer).digest('hex');
  const docType = detectDocumentType(fileMeta?.originalname || path.basename(resolvedPath), fileMeta?.mimetype || '');

  if (!docType) {
    throw new Error(unsupportedMessage || 'Unsupported document format. Please upload a PDF or Word document.');
  }

  const text = await extractDocumentText(resolvedPath, docType, buffer);
  return { text, docType, hash, buffer };
};

const analyzeResumeText = (text, context = {}) => {
  const normalized = normalizeText(text);
  if (!normalized) {
    throw new Error('We could not extract readable text from your document. Please upload a searchable CV or resume.');
  }

  const words = normalized.split(/\s+/);
  const uniqueWords = new Set(words.map((word) => word.toLowerCase()));

  if (normalized.length < MIN_CHAR_COUNT || words.length < MIN_WORD_COUNT || uniqueWords.size < MIN_UNIQUE_WORDS) {
    throw new Error('Document appears too short to be a complete CV or résumé. Please upload the full document.');
  }

  const estimatedPages = Math.max(1, Math.round(words.length / WORDS_PER_PAGE_ESTIMATE) || 1);
  if (estimatedPages < RESUME_MIN_ESTIMATED_PAGES || estimatedPages > RESUME_MAX_ESTIMATED_PAGES) {
    throw new Error('CV must be between 1 and 6 pages. Please upload a standard résumé.');
  }

  const lower = normalized.toLowerCase();
  const matchedSections = SECTION_KEYWORDS.reduce(
    (count, group) => (group.some((keyword) => lower.includes(keyword)) ? count + 1 : count),
    0
  );

  if (matchedSections < MIN_SECTION_MATCHES) {
    throw new Error('We could not detect typical résumé sections. Please upload a complete CV or résumé.');
  }

  const hasCoreSection = CORE_RESUME_SECTIONS.some((group) => group.some((keyword) => lower.includes(keyword)));
  const hasSupportingSection = SUPPORTING_RESUME_SECTIONS.some((group) => group.some((keyword) => lower.includes(keyword)));
  if (!hasCoreSection || !hasSupportingSection) {
    throw new Error('Résumé must include a core section (Experience/Education) and a supporting section (Skills/Projects/etc.).');
  }

  const hasContactInfo = EMAIL_REGEX.test(normalized) || PHONE_REGEX.test(normalized);
  if (!hasContactInfo) {
    throw new Error('Resume appears to be missing contact information (email or phone). Please double-check your document.');
  }

  if (PLACEHOLDER_PATTERNS.some((pattern) => lower.includes(pattern))) {
    throw new Error('Resume appears to contain placeholder text. Please upload the finalized document.');
  }

  const nameMatch = calculateEntityNameMatch(lower, context.expectedFullName);
  if (nameMatch.status === 'mismatch') {
    throw new Error('We could not find your name inside the résumé. Please upload the correct document.');
  }

  const emailCheck = ensureEmailConsistency(text, context.expectedEmail);
  if (!emailCheck.isSatisfied) {
    throw new Error(emailCheck.message);
  }

  const languageResult = detectLanguageConfidence(normalized);
  if (!languageResult.isValid) {
    throw new Error(languageResult.message);
  }

  return {
    wordCount: words.length,
    uniqueWordCount: uniqueWords.size,
    matchedSections,
    hasContactInfo,
    estimatedPages,
    nameMatchScore: nameMatch.score,
    matchedNameTokens: nameMatch.matches,
    detectedEmails: emailCheck.detectedEmails,
    language: languageResult.language,
    languageConfidence: languageResult.confidence,
  };
};

const analyzeBusinessDocumentText = (text, context = {}) => {
  const normalized = normalizeText(text);
  if (!normalized) {
    throw new Error('We could not read any text from your document. Please upload the original PDF or Word file.');
  }

  const words = normalized.split(/\s+/);
  const uniqueWords = new Set(words.map((word) => word.toLowerCase()));

  if (
    normalized.length < BUSINESS_MIN_CHAR_COUNT
    || words.length < BUSINESS_MIN_WORD_COUNT
    || uniqueWords.size < BUSINESS_MIN_UNIQUE_WORDS
  ) {
    throw new Error('Please upload the complete certificate or letter.');
  }

  const lower = normalized.toLowerCase();
  const matchedSections = BUSINESS_SECTION_KEYWORDS.reduce(
    (count, group) => (group.some((keyword) => lower.includes(keyword)) ? count + 1 : count),
    0
  );

  if (matchedSections < BUSINESS_MIN_SECTION_MATCHES) {
    throw new Error('We could not find typical business verification details (registration, tax, or authority references). Please upload an official document.');
  }

  const authorityMentions = extractAuthorityMentions(text);
  const registrationMentions = extractRegistrationMentions(text);
  if (!authorityMentions.length && !registrationMentions.length) {
    throw new Error('Document is missing an authority reference or registration number. Please upload an official certificate or license.');
  }

  const addressMentions = extractAddressMentions(text);
  const detectedCountries = detectCountriesInDocument(lower);
  const expectedCountry = context.expectedCountry || null;
  let countryMatchStatus = 'not_provided';
  if (expectedCountry) {
    if (detectedCountries.length === 0) {
      countryMatchStatus = 'missing_in_document';
    } else {
      countryMatchStatus = detectedCountries.includes(expectedCountry) ? 'match' : 'mismatch';
    }
  }

  const mostRecentDate = determineMostRecentDate(text);

  const nameMatch = calculateEntityNameMatch(lower, context.expectedCompanyName);

  const limitedRegistrationMentions = registrationMentions.slice(0, MAX_REGISTERED_REG_NUMBERS);
  const recencyStatus = !mostRecentDate
    ? 'unknown'
    : isOlderThanYears(mostRecentDate, MAX_DOC_AGE_YEARS)
      ? 'stale'
      : 'recent';

  return {
    wordCount: words.length,
    uniqueWordCount: uniqueWords.size,
    matchedSections,
    authorityMentions: authorityMentions.slice(0, 5),
    registrationNumbers: limitedRegistrationMentions,
    addressMentions: addressMentions.slice(0, 5),
    detectedCountries,
    expectedCountry,
    countryMatchStatus,
    companyNameScore: nameMatch.score,
    companyNameMatches: nameMatch.matches,
    mostRecentDate: mostRecentDate ? mostRecentDate.toISOString() : null,
    recencyStatus,
    expectedCompanyName: context.expectedCompanyName || null,
  };
};

export const validateResumeDocument = async (filePath, fileMeta = {}, context = {}) => {
  const { text, docType, hash, buffer } = await ensureSupportedDocument(
    filePath,
    fileMeta,
    'Unsupported resume format. Please upload a PDF or Word document.'
  );

  const fileSizeBytes = fileMeta?.size ?? buffer?.length ?? 0;
  if (fileSizeBytes && fileSizeBytes < RESUME_MIN_SIZE_BYTES) {
    throw new Error('Résumé file appears empty. Please upload the complete document.');
  }
  if (fileSizeBytes && fileSizeBytes > RESUME_MAX_SIZE_BYTES) {
    throw new Error('Résumé file is too large. Please keep it under 50 MB.');
  }

  const resolvedContext = {
    expectedFullName: context.expectedFullName?.trim() || null,
    expectedEmail: context.expectedEmail?.trim() || null,
  };

  const analysis = analyzeResumeText(text, resolvedContext);
  analysis.documentHash = hash;
  analysis.docType = docType;
  analysis.fileSizeBytes = fileSizeBytes;

  const llmSummary = buildResumeLLMSummary(analysis, resolvedContext);
  try {
    const llmVerdict = await LLMService.verifyResumeDocument({
      documentText: text.slice(0, 8000),
      summary: llmSummary,
      expectedName: resolvedContext.expectedFullName || 'Candidate',
    });
    if (llmVerdict) {
      analysis.llmVerdict = llmVerdict;
      const confidence = Number.isFinite(llmVerdict.confidence) ? Number(llmVerdict.confidence) : 0;
      const isOfficial = typeof llmVerdict.isOfficial === 'boolean' ? llmVerdict.isOfficial : null;
      const usedFallbackModel = Boolean(llmVerdict?._meta?.usedFallback);

      if (isOfficial === false) {
        if (usedFallbackModel) {
          logger.warn('Ignoring fallback-model resume rejection and relying on heuristic validation.', {
            confidence,
            model: llmVerdict?._meta?.model || null,
          });
        } else if (confidence >= RESUME_LLM_PRIMARY_REJECTION_CONFIDENCE) {
          throw createResumeLlmRejectionError(
            llmVerdict.message || 'We could not confirm this is a valid resume. Please upload another file.',
            llmVerdict,
          );
        } else {
          logger.warn('Ignoring low-confidence primary-model resume rejection and relying on heuristics.', {
            confidence,
          });
        }
      } else if (isOfficial !== true) {
        logger.warn('Resume LLM returned an invalid verdict shape; relying on heuristics.', {
          verdict: llmVerdict,
        });
      }
    }
  } catch (error) {
    if (error?.code === RESUME_LLM_REJECTION_CODE || error.message?.includes('valid résumé')) {
      throw error;
    }
    logger.warn('LLM resume verification unavailable, continuing with heuristic result.', {
      error: error?.message || String(error),
      code: error?.code || null,
    });
  }

  logger.info('Resume validation succeeded', {
    type: docType,
    wordCount: analysis.wordCount,
    matchedSections: analysis.matchedSections,
  });

  return {
    hash,
    docType,
    analysis,
  };
};

export const validateBusinessVerificationDocument = async (filePath, fileMeta = {}, context = {}) => {
  const { text, docType, hash } = await ensureSupportedDocument(
    filePath,
    fileMeta,
    'Unsupported verification format. Please upload a PDF or Word document.'
  );

  const resolvedContext = {
    expectedCompanyName: context.expectedCompanyName?.trim() || null,
    expectedCountry: resolveCountryContext(context.expectedCountry, context.expectedCountryCode),
  };

  const analysis = analyzeBusinessDocumentText(text, resolvedContext);
  analysis.documentHash = hash;
  analysis.docType = docType;

  // TESTING: Disabled LLM verification completely for testing
  // const llmSummary = buildLLMSummary(analysis, resolvedContext);
  // try {
  //   const llmVerdict = await LLMService.verifyBusinessDocument({
  //     documentText: text.slice(0, 8000),
  //     summary: llmSummary,
  //   });
  //   if (llmVerdict) {
  //     analysis.llmVerdict = llmVerdict;
  //     const confidence = typeof llmVerdict.confidence === 'number' ? llmVerdict.confidence : 0;
  //     if (!llmVerdict.isOfficial || confidence < 0.65) {
  //       throw new Error(llmVerdict.message || 'We could not confirm this is an official business verification document. Please upload a clearer certificate.');
  //     }
  //   }
  // } catch (error) {
  //   if (error.message?.includes('official business verification document')) {
  //     throw error;
  //   }
  //   logger.warn('LLM verification unavailable, continuing with heuristic result.', { error: error.message });
  // }

  logger.info('Business verification validation succeeded', {
    type: docType,
    wordCount: analysis.wordCount,
    matchedSections: analysis.matchedSections,
    detectedCountries: analysis.detectedCountries,
    expectedCountry: analysis.expectedCountry,
  });

  return {
    hash,
    docType,
    analysis,
  };
};

const resolveCountryContext = (countryInput, countryCode) => {
  if (countryCode) {
    const entry = COUNTRIES[countryCode.toUpperCase()];
    if (entry?.name) {
      return entry.name;
    }
  }
  if (!countryInput) return null;
  const normalized = sanitizeCountryLabel(countryInput);
  if (!normalized) return null;
  const directMatch = COUNTRY_VARIANTS.find((variant) => normalized.includes(variant.keyword));
  if (directMatch) return directMatch.country;
  const parts = normalized.split(' ');
  return parts.length ? parts[parts.length - 1].replace(/\b(state|province)\b/g, '').trim() || null : null;
};

const detectCountriesInDocument = (textLower) => {
  const matches = new Set();
  for (const variant of COUNTRY_VARIANTS) {
    if (textLower.includes(variant.keyword)) {
      matches.add(variant.country);
    }
  }
  return Array.from(matches);
};

const extractAuthorityMentions = (text) => {
  const lines = text.split(/\n+/);
  return lines
    .filter((line) => {
      const lower = line.toLowerCase();
      return GOVERNMENT_KEYWORDS.some((keyword) => lower.includes(keyword));
    })
    .map((line) => line.trim())
    .filter(Boolean);
};

const extractAddressMentions = (text) => {
  const matches = [];
  const lines = text.split(/\n+/);
  lines.forEach((line) => {
    if (ADDRESS_REGEX.test(line) || POSTAL_CODE_REGEX.test(line)) {
      matches.push(line.trim());
    }
  });
  return matches;
};

const extractRegistrationMentions = (text) => {
  const mentions = [];
  const lines = text.split(/\n+/);
  lines.forEach((line) => {
    const lower = line.toLowerCase();
    if (REGISTRATION_CONTEXT_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      const numbers = Array.from(
        new Set(Array.from(line.matchAll(REGISTRATION_NUMBER_REGEX), (match) => match[1] || match[0]))
      );
      numbers.forEach((number) => {
        mentions.push({
          number,
          context: line.trim().slice(0, 160),
        });
      });
    }
  });
  return mentions;
};

const ensureEmailConsistency = (text, expectedEmail) => {
  const detectedEmails = Array.from(text.match(EMAIL_REGEX_GLOBAL) || []).map((email) => email.toLowerCase());
  if (!detectedEmails.length) {
    return {
      isSatisfied: false,
      detectedEmails: [],
      message: 'Résumé must include a contact email address.',
    };
  }

  if (!expectedEmail) {
    return { isSatisfied: true, detectedEmails };
  }

  const normalizedExpected = expectedEmail.toLowerCase();
  const expectedDomain = normalizedExpected.split('@')[1] || '';
  if (detectedEmails.includes(normalizedExpected)) {
    return { isSatisfied: true, detectedEmails };
  }
  if (expectedDomain && detectedEmails.some((email) => email.endsWith(`@${expectedDomain}`))) {
    return { isSatisfied: true, detectedEmails };
  }

  return {
    isSatisfied: false,
    detectedEmails,
    message: 'Résumé email must match the email address (or domain) used for registration.',
  };
};

const detectLanguageConfidence = (text) => {
  const printableRatio = getPrintableRatio(text);
  if (printableRatio < 0.7) {
    return {
      isValid: false,
      language: null,
      confidence: 0,
      message: 'Resume text appears corrupted or contains too many non-printable characters.',
    };
  }

  const sanitized = text.slice(0, 2000);
  if (sanitized.replace(/\s/g, '').length < 50) {
    return {
      isValid: false,
      language: null,
      confidence: 0,
      message: 'Resume text is too short to analyze. Please upload the complete document.',
    };
  }

  const langCode = franc(sanitized, { minLength: 20 });
  if (langCode === 'und') {
    return {
      isValid: false,
      language: null,
      confidence: 0,
      message: 'Unable to determine the resume language. Please upload a text-based document.',
    };
  }

  return {
    isValid: true,
    language: langCode,
    confidence: 1,
  };
};

const getPrintableRatio = (text = '') => {
  if (!text) return 0;
  const total = text.length;
  const printable = text.split('').filter((char) => /[\u0020-\u007E\u00A0-\u024F]/.test(char)).length;
  return printable / total;
};

const calculateEntityNameMatch = (documentLower, expectedName) => {
  if (!expectedName) {
    return { status: 'skipped', score: 0, matches: [] };
  }
  const sanitized = sanitizeEntityName(expectedName);
  if (!sanitized) {
    return { status: 'skipped', score: 0, matches: [] };
  }

  const tokens = sanitized.split(' ').filter((token) => token.length > 2);
  if (!tokens.length) {
    return { status: 'skipped', score: 0, matches: [] };
  }

  const matches = tokens.filter((token) => documentLower.includes(token));
  const score = matches.length / tokens.length;

  return {
    status: score >= 0.6 ? 'match' : 'mismatch',
    score,
    matches,
  };
};

const sanitizeEntityName = (value = '') =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s]/g, ' ')
    .replace(
      new RegExp(`\\b(${CORPORATE_SUFFIXES.map((suffix) => suffix.replace('.', '\\.')).join('|')})\\b`, 'g'),
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();

const determineMostRecentDate = (text) => {
  const candidates = extractDateCandidates(text);
  if (!candidates.length) return null;
  return candidates.reduce((latest, current) => (current > latest ? current : latest), candidates[0]);
};

const extractDateCandidates = (text) => {
  const normalized = text.replace(/(\d)(st|nd|rd|th)/gi, '$1');
  const dates = [];

  const numericMatch = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
  let match;
  while ((match = numericMatch.exec(normalized)) !== null) {
    const [month, day, year] = normalizeDateParts(match[1], match[2], match[3]);
    if (year >= 1980) {
      const candidate = new Date(year, month - 1, day);
      if (!Number.isNaN(candidate.getTime())) dates.push(candidate);
    }
  }

  const isoMatch = /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g;
  while ((match = isoMatch.exec(normalized)) !== null) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year >= 1980) {
      const candidate = new Date(year, month - 1, day);
      if (!Number.isNaN(candidate.getTime())) dates.push(candidate);
    }
  }

  const monthNameRegex = new RegExp(`\\b(${MONTH_NAMES.join('|')})\\s+\\d{1,2},?\\s+\\d{4}\\b`, 'gi');
  let monthMatch;
  while ((monthMatch = monthNameRegex.exec(normalized)) !== null) {
    const candidate = new Date(monthMatch[0]);
    if (!Number.isNaN(candidate.getTime()) && candidate.getFullYear() >= 1980) {
      dates.push(candidate);
    }
  }

  const invertedMonthRegex = new RegExp(`\\b\\d{1,2}\\s+(${MONTH_NAMES.join('|')})\\s+\\d{4}\\b`, 'gi');
  while ((monthMatch = invertedMonthRegex.exec(normalized)) !== null) {
    const candidate = new Date(monthMatch[0]);
    if (!Number.isNaN(candidate.getTime()) && candidate.getFullYear() >= 1980) {
      dates.push(candidate);
    }
  }

  return dates;
};

const normalizeDateParts = (part1, part2, part3) => {
  const first = Number(part1);
  const second = Number(part2);
  const third = Number(part3);
  if (third < 100) {
    const year = third + 2000;
    return [first, second, year];
  }
  return [first, second, third];
};

const isOlderThanYears = (date, years) => {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return date < cutoff;
};

const buildLLMSummary = (analysis, context) => {
  const parts = [
    `Provided Company Name: ${context.expectedCompanyName || 'N/A'}`,
    `Provided Country: ${context.expectedCountry || 'N/A'}`,
    `Detected Countries: ${analysis.detectedCountries?.join(', ') || 'None'}`,
    `Most Recent Date: ${analysis.mostRecentDate || 'Unknown'}`,
    `Registration Numbers: ${
      analysis.registrationNumbers?.map((item) => item.number).join(', ') || 'None detected'
    }`,
    `Authority Mentions: ${analysis.authorityMentions?.slice(0, 2).join(' | ') || 'None'}`,
  ];
  return parts.join('\n');
};

const buildResumeLLMSummary = (analysis, context) => {
  const parts = [
    `Candidate Name: ${context.expectedFullName || 'N/A'}`,
    `Estimated Pages: ${analysis.estimatedPages || 'Unknown'}`,
    `Word Count: ${analysis.wordCount}`,
    `Detected Emails: ${(analysis.detectedEmails || []).join(', ') || 'None'}`,
    `Language Guess: ${analysis.language || 'N/A'}`,
  ];
  return parts.join('\n');
};

const createResumeLlmRejectionError = (message, llmVerdict = null) => {
  const error = new Error(message || 'We could not confirm this is a valid resume. Please upload another file.');
  error.code = RESUME_LLM_REJECTION_CODE;
  if (llmVerdict && typeof llmVerdict === 'object') {
    error.llmVerdict = llmVerdict;
  }
  return error;
};
