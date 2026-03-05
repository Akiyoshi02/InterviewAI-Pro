#!/usr/bin/env node

import { importQuestionDataset } from '../src/services/questionCatalogImport.service.js';

const DEFAULT_BATCH_LABEL = 'manual-import';

const parseArgs = (argv) => {
  const args = {
    sourceKey: null,
    dryRun: false,
    approve: false,
    batchLabel: DEFAULT_BATCH_LABEL,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--source') {
      args.sourceKey = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--approve') {
      args.approve = true;
      continue;
    }
    if (token === '--batch-label') {
      args.batchLabel = argv[index + 1] || DEFAULT_BATCH_LABEL;
      index += 1;
    }
  }

  return args;
};

const run = async () => {
  const args = parseArgs(process.argv);
  const result = await importQuestionDataset(args);
  console.log(JSON.stringify(result, null, 2));
};

run().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    message: error?.message || String(error),
  }, null, 2));
  process.exitCode = 1;
});

