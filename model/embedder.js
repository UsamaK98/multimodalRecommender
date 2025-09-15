// embedder.js
import fs from 'fs-extra';
import csv from 'csv-parser';
import path from 'path';
import {
  AutoProcessor,
  SiglipVisionModel,
  RawImage
} from '@huggingface/transformers';
import { l2Normalize } from './utils.js';

const MODEL_ID = 'Marqo/marqo-fashionSigLIP';

/**
 * generateEmbeddings(csvPath, imagesDir, outPath)
 * - csvPath: path to CSV with header: id,gender,masterCategory,subCategory,articleType,baseColour,season,year,usage
 * - imagesDir: directory containing <id>.jpg images
 * - outPath: where to write embeddings.json
 */
export async function generateEmbeddings(csvPath, imagesDir, outPath = 'embeddings.json') {
  // Load processors + model
  console.log('Loading processor & vision model (this may take a while)...');
  const processor = await AutoProcessor.from_pretrained(MODEL_ID);
  const visionModel = await SiglipVisionModel.from_pretrained(MODEL_ID);

  // Read CSV rows
  const rows = await readCSV(csvPath);

  const out = [];
  for (const row of rows) {
    const id = row.id;
    const imagePath = path.join(imagesDir, `${id}.jpg`);
    if (!await fs.pathExists(imagePath)) {
      console.warn(`Skipping ${id} — image not found at ${imagePath}`);
      continue;
    }

    try {
      // read image (works with local file paths)
      const rawImage = await RawImage.read(imagePath);
      
      // Validate that the image was loaded properly
      if (!rawImage) {
        console.warn(`Skipping ${id} — failed to load image from ${imagePath}`);
        continue;
      }
      
      // Additional validation for image properties
      if (!rawImage.size || !Array.isArray(rawImage.size) || rawImage.size.length !== 2) {
        console.warn(`Skipping ${id} — image has invalid size property:`, rawImage.size);
        continue;
      }

      // process input for the model
      let inputs;
      try {
        inputs = await processor(rawImage);
      } catch (processError) {
        console.warn(`Skipping ${id} — processor failed: ${processError.message}`);
        continue;
      }
      
      // Validate processor output
      if (!inputs) {
        console.warn(`Skipping ${id} — processor returned invalid input`);
        continue;
      }

      // run vision model
      const result = await visionModel(inputs);
      // Different model outputs may use different keys; SigLIP returns an embedding tensor
      // common key: image_embeds or image_features — handle both
      const tensor = result.image_embeds ?? result.image_features ?? result.embeddings ?? result.pooler_output;

      if (!tensor) {
        console.error(`No image embedding found for id ${id}. Output keys: ${Object.keys(result)}`);
        continue;
      }

      // tensor.data is a Float32Array; if shape is [1, D] we extract first row
      // Convert to JS array
      const arr = Array.from(tensor.data);
      // If the model returns flatten or additional dims, ensure we trim to a single vector if needed.
      // (Most models return [1, D] or [D], so above works.)
      const normalized = l2Normalize(arr);

      out.push({
        id,
        embedding: normalized,
        metadata: row
      });

      if (out.length % 100 === 0) {
        console.log(`Processed ${out.length} images...`);
      }
    } catch (err) {
      console.error(`Error processing ${id}:`, err);
    }
  }

  await fs.writeJSON(outPath, out, { spaces: 2 });
  console.log(`Saved ${out.length} embeddings to ${outPath}`);
}

/** readCSV -> returns array of objects (rows) */
function readCSV(csvPath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', () => resolve(rows))
      .on('error', err => reject(err));
  });
}

// If run directly, simple CLI
if (process.argv[1].endsWith('embedder.js')) {
  const [, , csvPath, imagesDir, outPath] = process.argv;
  if (!csvPath || !imagesDir) {
    console.error('Usage: node embedder.js <data.csv> <images_dir> [out.json]');
    process.exit(2);
  }
  generateEmbeddings(csvPath, imagesDir, outPath || 'embeddings.json').catch(e => {
    console.error(e);
    process.exit(1);
  });
}
