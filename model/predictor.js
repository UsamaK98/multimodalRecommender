// predictor.js
import fs from 'fs-extra';
import path from 'path';
import {
  AutoProcessor,
  SiglipVisionModel,
  RawImage
} from '@huggingface/transformers';
import { cosineSimilarity, l2Normalize, majorityVote } from './utils.js';

const MODEL_ID = 'Marqo/marqo-fashionSigLIP';

export async function loadEmbeddings(embPath = 'embeddings.json') {
  const arr = await fs.readJSON(embPath);
  // Simple in-memory map by id for convenience
  const byId = new Map(arr.map(x => [x.id, x]));
  return { rows: arr, byId };
}

/**
 * predictFromImage(imagePath, embeddings, k=5, field='articleType')
 * - returns top-k neighbors and majority vote prediction for `field`
 */
export async function predictFromImage(imagePath, embeddingsObj, k = 5, field = 'articleType') {
  const { rows } = embeddingsObj;
  // load model & processor
  const processor = await AutoProcessor.from_pretrained(MODEL_ID);
  const visionModel = await SiglipVisionModel.from_pretrained(MODEL_ID);

  const rawImage = await RawImage.read(imagePath);
  const inputs = await processor({ images: rawImage });

  const result = await visionModel(inputs);
  const tensor = result.image_embeds ?? result.image_features ?? result.embeddings ?? result.pooler_output;
  if (!tensor) throw new Error('No image embedding from model');
  const arr = Array.from(tensor.data);
  const q = l2Normalize(arr);

  // compute similarities
  const sims = rows.map(r => ({ id: r.id, metadata: r.metadata, score: cosineSimilarity(q, r.embedding) }));
  sims.sort((a, b) => b.score - a.score);
  const topK = sims.slice(0, k);

  const labels = topK.map(t => t.metadata[field]).filter(Boolean);
  const vote = labels.length ? majorityVote(labels) : { label: null };

  return { topK, prediction: vote };
}

/**
 * predictFromId(id, embeddingsObj, k=5, field='articleType')
 * - uses an existing id in the embeddings DB as query
 */
export function predictFromId(id, embeddingsObj, k = 5, field = 'articleType') {
  const { rows, byId } = embeddingsObj;
  const entry = byId.get(id);
  if (!entry) throw new Error(`id ${id} not found in embeddings`);

  const q = entry.embedding;
  const sims = rows
    .filter(r => r.id !== id)
    .map(r => ({ id: r.id, metadata: r.metadata, score: cosineSimilarity(q, r.embedding) }))
    .sort((a, b) => b.score - a.score);

  const topK = sims.slice(0, k);
  const labels = topK.map(t => t.metadata[field]).filter(Boolean);
  const vote = labels.length ? majorityVote(labels) : { label: null };
  return { topK, prediction: vote };
}

// CLI example
if (process.argv[1].endsWith('predictor.js')) {
  (async () => {
    const [, , cmd, arg1, arg2, arg3] = process.argv;
    const emb = await loadEmbeddings(arg3 || 'embeddings.json');
    if (cmd === 'image') {
      const res = await predictFromImage(arg1, emb, Number(arg2) || 5, 'articleType');
      console.log(JSON.stringify(res, null, 2));
    } else if (cmd === 'id') {
      const res = predictFromId(arg1, emb, Number(arg2) || 5, 'articleType');
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log('Usage: node predictor.js image <imagePath> [k] [embeddings.json]\n       node predictor.js id <id> [k] [embeddings.json]');
    }
  })().catch(e => { console.error(e); process.exit(1); });
}
