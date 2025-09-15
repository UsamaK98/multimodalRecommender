// evaluator.js
import fs from 'fs-extra';
import path from 'path';
import { loadEmbeddings, predictFromId, predictFromImage } from '../predictor.js';
import { cosineSimilarity } from '../utils.js';

/**
 * Comprehensive Evaluator for Multimodal Recommender Model
 * Evaluates model performance using various metrics including:
 * - Classification metrics (accuracy, precision, recall, F1)
 * - Ranking metrics (NDCG, MRR, MAP)
 * - Recommendation quality metrics
 * - Diversity and coverage metrics
 */
export class ModelEvaluator {
  constructor(config = {}) {
    this.config = {
      k_values: [1, 3, 5, 10],
      target_fields: ['articletype', 'gender', 'mastercategory', 'subcategory', 'basecolour'],
      test_split_ratio: 0.2,
      random_seed: 42,
      min_category_samples: 5,
      diversity_threshold: 0.7,
      ...config
    };
    
    this.embeddings = null;
    this.testSet = null;
    this.results = {};
  }

  /**
   * Load embeddings and prepare evaluation data
   */
  async initialize(embeddingsPath = 'embeddings.json') {
    console.log('Loading embeddings for evaluation...');
    this.embeddings = await loadEmbeddings(embeddingsPath);
    console.log(`Loaded ${this.embeddings.rows.length} embeddings`);
    return this;
  }

  /**
   * Create test/validation splits for evaluation
   */
  createTestSplit(splitRatio = null) {
    splitRatio = splitRatio || this.config.test_split_ratio;
    
    // Stratified split by target categories to ensure balanced evaluation
    const stratifiedSplit = this.stratifiedSplit(
      this.embeddings.rows, 
      splitRatio, 
      this.config.target_fields[0] // Primary target field
    );
    
    this.testSet = stratifiedSplit.test;
    this.trainSet = stratifiedSplit.train;
    
    console.log(`Created test split: ${this.testSet.length} test, ${this.trainSet.length} train`);
    return { test: this.testSet, train: this.trainSet };
  }

  /**
   * Stratified split maintaining category distributions
   */
  stratifiedSplit(data, testRatio, stratifyField) {
    // Group by category
    const groups = new Map();
    for (const item of data) {
      const category = item.metadata[stratifyField];
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(item);
    }

    const train = [];
    const test = [];

    // Split each category proportionally
    for (const [category, items] of groups) {
      if (items.length < this.config.min_category_samples) {
        // Keep small categories in training only
        train.push(...items);
        continue;
      }

      const shuffled = this.shuffle([...items]);
      const testSize = Math.max(1, Math.floor(items.length * testRatio));
      const testItems = shuffled.slice(0, testSize);
      const trainItems = shuffled.slice(testSize);
      
      test.push(...testItems);
      train.push(...trainItems);
    }

    return { train, test };
  }

  /**
   * Run comprehensive evaluation
   */
  async evaluate(evaluationConfig = {}) {
    if (!this.testSet) {
      this.createTestSplit();
    }

    const config = { ...this.config, ...evaluationConfig };
    const results = {
      timestamp: new Date().toISOString(),
      config,
      metrics: {},
      detailed_results: {},
      performance: {}
    };

    console.log('Starting comprehensive evaluation...');

    // 1. Classification Metrics
    console.log('Computing classification metrics...');
    results.metrics.classification = await this.evaluateClassification();

    // 2. Ranking Metrics
    console.log('Computing ranking metrics...');
    results.metrics.ranking = await this.evaluateRanking();

    // 3. Recommendation Quality
    console.log('Computing recommendation quality metrics...');
    results.metrics.recommendation_quality = await this.evaluateRecommendationQuality();

    // 4. Diversity and Coverage
    console.log('Computing diversity and coverage metrics...');
    results.metrics.diversity = await this.evaluateDiversity();

    // 5. Category-wise Analysis
    console.log('Computing category-wise analysis...');
    results.detailed_results.category_analysis = await this.evaluateByCategory();

    // 6. Performance Metrics
    console.log('Computing performance metrics...');
    results.performance = await this.evaluatePerformance();

    // 7. Error Analysis
    console.log('Performing error analysis...');
    results.detailed_results.error_analysis = await this.performErrorAnalysis();

    this.results = results;
    return results;
  }

  /**
   * Evaluate classification performance
   */
  async evaluateClassification() {
    const metrics = {};

    for (const field of this.config.target_fields) {
      metrics[field] = {};

      for (const k of this.config.k_values) {
        const predictions = [];
        const ground_truth = [];

        for (const testItem of this.testSet) {
          try {
            const prediction = predictFromId(testItem.id, this.embeddings, k, field);
            predictions.push(prediction.prediction.label);
            ground_truth.push(testItem.metadata[field]);
          } catch (error) {
            console.warn(`Error predicting for item ${testItem.id}:`, error.message);
          }
        }

        metrics[field][`k${k}`] = this.computeClassificationMetrics(
          ground_truth, 
          predictions
        );
      }
    }

    return metrics;
  }

  /**
   * Evaluate ranking performance (NDCG, MRR, MAP)
   */
  async evaluateRanking() {
    const metrics = {};

    for (const field of this.config.target_fields) {
      metrics[field] = {};

      for (const k of this.config.k_values) {
        const ndcgScores = [];
        const mrrScores = [];
        const mapScores = [];

        for (const testItem of this.testSet) {
          try {
            const prediction = predictFromId(testItem.id, this.embeddings, k, field);
            const groundTruth = testItem.metadata[field];
            
            // Create relevance scores (1 for exact match, 0 for no match)
            const relevanceScores = prediction.topK.map(item => 
              item.metadata[field] === groundTruth ? 1 : 0
            );

            ndcgScores.push(this.computeNDCG(relevanceScores, k));
            mrrScores.push(this.computeMRR(relevanceScores));
            mapScores.push(this.computeMAP(relevanceScores));
          } catch (error) {
            console.warn(`Error computing ranking metrics for ${testItem.id}:`, error.message);
          }
        }

        metrics[field][`k${k}`] = {
          ndcg: this.mean(ndcgScores),
          mrr: this.mean(mrrScores),
          map: this.mean(mapScores)
        };
      }
    }

    return metrics;
  }

  /**
   * Evaluate recommendation quality
   */
  async evaluateRecommendationQuality() {
    const metrics = {
      similarity_distribution: {},
      recommendation_confidence: {},
      category_consistency: {}
    };

    // Analyze similarity score distributions
    const similarities = [];
    const confidences = [];

    for (const testItem of this.testSet.slice(0, 100)) { // Sample for efficiency
      try {
        const prediction = predictFromId(testItem.id, this.embeddings, 10, 'articletype');
        
        similarities.push(...prediction.topK.map(item => item.score));
        
        if (prediction.prediction.count > 0) {
          confidences.push(prediction.prediction.count / prediction.topK.length);
        }
      } catch (error) {
        console.warn(`Error analyzing recommendation quality for ${testItem.id}`);
      }
    }

    metrics.similarity_distribution = {
      mean: this.mean(similarities),
      std: this.std(similarities),
      min: Math.min(...similarities),
      max: Math.max(...similarities),
      percentiles: this.percentiles(similarities, [25, 50, 75, 90])
    };

    metrics.recommendation_confidence = {
      mean: this.mean(confidences),
      std: this.std(confidences),
      distribution: this.histogram(confidences, 10)
    };

    return metrics;
  }

  /**
   * Evaluate diversity and coverage
   */
  async evaluateDiversity() {
    const metrics = {};

    for (const field of this.config.target_fields) {
      const allRecommendations = new Set();
      const intraListDiversities = [];

      for (const testItem of this.testSet.slice(0, 50)) { // Sample for efficiency
        try {
          const prediction = predictFromId(testItem.id, this.embeddings, 10, field);
          
          // Collect all recommended categories
          prediction.topK.forEach(item => {
            allRecommendations.add(item.metadata[field]);
          });

          // Compute intra-list diversity
          const diversity = this.computeIntraListDiversity(prediction.topK, field);
          intraListDiversities.push(diversity);
        } catch (error) {
          continue;
        }
      }

      // Get all unique categories in dataset
      const allCategories = new Set(
        this.embeddings.rows.map(item => item.metadata[field])
      );

      metrics[field] = {
        catalog_coverage: allRecommendations.size / allCategories.size,
        avg_intra_list_diversity: this.mean(intraListDiversities),
        unique_recommendations: allRecommendations.size
      };
    }

    return metrics;
  }

  /**
   * Evaluate performance by category
   */
  async evaluateByCategory() {
    const analysis = {};

    for (const field of this.config.target_fields) {
      analysis[field] = {};

      // Group test items by category
      const categoryGroups = new Map();
      for (const item of this.testSet) {
        const category = item.metadata[field];
        if (!categoryGroups.has(category)) categoryGroups.set(category, []);
        categoryGroups.get(category).push(item);
      }

      for (const [category, items] of categoryGroups) {
        if (items.length < 3) continue; // Skip categories with too few samples

        const categoryResults = [];
        
        for (const testItem of items) {
          try {
            const prediction = predictFromId(testItem.id, this.embeddings, 5, field);
            const isCorrect = prediction.prediction.label === category;
            
            categoryResults.push({
              correct: isCorrect,
              confidence: prediction.prediction.count / 5,
              top_similarity: prediction.topK[0]?.score || 0
            });
          } catch (error) {
            continue;
          }
        }

        if (categoryResults.length > 0) {
          analysis[field][category] = {
            sample_count: categoryResults.length,
            accuracy: categoryResults.filter(r => r.correct).length / categoryResults.length,
            avg_confidence: this.mean(categoryResults.map(r => r.confidence)),
            avg_similarity: this.mean(categoryResults.map(r => r.top_similarity))
          };
        }
      }
    }

    return analysis;
  }

  /**
   * Evaluate model performance (timing, efficiency)
   */
  async evaluatePerformance() {
    const performanceMetrics = {
      prediction_time: [],
      memory_usage: process.memoryUsage(),
      throughput: 0
    };

    const sampleSize = Math.min(50, this.testSet.length);
    const startTime = Date.now();

    for (let i = 0; i < sampleSize; i++) {
      const testItem = this.testSet[i];
      
      const predictionStart = process.hrtime.bigint();
      try {
        predictFromId(testItem.id, this.embeddings, 5, 'articletype');
      } catch (error) {
        continue;
      }
      const predictionEnd = process.hrtime.bigint();
      
      performanceMetrics.prediction_time.push(
        Number(predictionEnd - predictionStart) / 1e6 // Convert to milliseconds
      );
    }

    const totalTime = Date.now() - startTime;
    performanceMetrics.throughput = (sampleSize / totalTime) * 1000; // Predictions per second

    return {
      avg_prediction_time_ms: this.mean(performanceMetrics.prediction_time),
      throughput_per_second: performanceMetrics.throughput,
      memory_usage_mb: {
        rss: Math.round(performanceMetrics.memory_usage.rss / 1024 / 1024),
        heapUsed: Math.round(performanceMetrics.memory_usage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(performanceMetrics.memory_usage.heapTotal / 1024 / 1024)
      }
    };
  }

  /**
   * Perform error analysis
   */
  async performErrorAnalysis() {
    const errorAnalysis = {
      confusion_matrices: {},
      common_errors: {},
      similarity_analysis: {}
    };

    for (const field of this.config.target_fields.slice(0, 2)) { // Limit for efficiency
      const predictions = [];
      const groundTruth = [];
      const errorCases = [];

      for (const testItem of this.testSet.slice(0, 100)) {
        try {
          const prediction = predictFromId(testItem.id, this.embeddings, 5, field);
          const predicted = prediction.prediction.label;
          const actual = testItem.metadata[field];
          
          predictions.push(predicted);
          groundTruth.push(actual);

          if (predicted !== actual) {
            errorCases.push({
              item_id: testItem.id,
              actual: actual,
              predicted: predicted,
              confidence: prediction.prediction.count,
              top_similarities: prediction.topK.slice(0, 3).map(k => k.score)
            });
          }
        } catch (error) {
          continue;
        }
      }

      errorAnalysis.confusion_matrices[field] = this.createConfusionMatrix(
        groundTruth, 
        predictions
      );

      errorAnalysis.common_errors[field] = this.analyzeCommonErrors(errorCases);
    }

    return errorAnalysis;
  }

  // === UTILITY METHODS ===

  /**
   * Compute classification metrics (precision, recall, F1, accuracy)
   */
  computeClassificationMetrics(groundTruth, predictions) {
    const confusion = this.createConfusionMatrix(groundTruth, predictions);
    const metrics = {};

    // Overall accuracy
    metrics.accuracy = confusion.correct / confusion.total;

    // Per-class metrics
    const classes = [...new Set([...groundTruth, ...predictions])];
    let avgPrecision = 0, avgRecall = 0, avgF1 = 0;

    for (const cls of classes) {
      const tp = confusion.matrix.get(`${cls}_${cls}`) || 0;
      const fp = Array.from(confusion.matrix.keys())
        .filter(key => key.endsWith(`_${cls}`) && !key.startsWith(`${cls}_`))
        .reduce((sum, key) => sum + confusion.matrix.get(key), 0);
      const fn = Array.from(confusion.matrix.keys())
        .filter(key => key.startsWith(`${cls}_`) && !key.endsWith(`_${cls}`))
        .reduce((sum, key) => sum + confusion.matrix.get(key), 0);

      const precision = tp > 0 ? tp / (tp + fp) : 0;
      const recall = tp > 0 ? tp / (tp + fn) : 0;
      const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

      avgPrecision += precision;
      avgRecall += recall;
      avgF1 += f1;
    }

    metrics.macro_precision = avgPrecision / classes.length;
    metrics.macro_recall = avgRecall / classes.length;
    metrics.macro_f1 = avgF1 / classes.length;

    return metrics;
  }

  /**
   * Create confusion matrix
   */
  createConfusionMatrix(groundTruth, predictions) {
    const matrix = new Map();
    let correct = 0;

    for (let i = 0; i < groundTruth.length; i++) {
      const actual = groundTruth[i];
      const predicted = predictions[i];
      const key = `${actual}_${predicted}`;
      
      matrix.set(key, (matrix.get(key) || 0) + 1);
      
      if (actual === predicted) correct++;
    }

    return {
      matrix,
      correct,
      total: groundTruth.length
    };
  }

  /**
   * Compute NDCG (Normalized Discounted Cumulative Gain)
   */
  computeNDCG(relevanceScores, k) {
    const dcg = relevanceScores.slice(0, k).reduce((sum, rel, idx) => {
      return sum + rel / Math.log2(idx + 2);
    }, 0);

    const idealRelevance = [...relevanceScores].sort((a, b) => b - a);
    const idcg = idealRelevance.slice(0, k).reduce((sum, rel, idx) => {
      return sum + rel / Math.log2(idx + 2);
    }, 0);

    return idcg > 0 ? dcg / idcg : 0;
  }

  /**
   * Compute MRR (Mean Reciprocal Rank)
   */
  computeMRR(relevanceScores) {
    const firstRelevantIdx = relevanceScores.findIndex(score => score > 0);
    return firstRelevantIdx >= 0 ? 1 / (firstRelevantIdx + 1) : 0;
  }

  /**
   * Compute MAP (Mean Average Precision)
   */
  computeMAP(relevanceScores) {
    let numRelevant = 0;
    let sumPrecision = 0;

    for (let i = 0; i < relevanceScores.length; i++) {
      if (relevanceScores[i] > 0) {
        numRelevant++;
        sumPrecision += numRelevant / (i + 1);
      }
    }

    return numRelevant > 0 ? sumPrecision / numRelevant : 0;
  }

  /**
   * Compute intra-list diversity
   */
  computeIntraListDiversity(items, field) {
    const categories = items.map(item => item.metadata[field]);
    const uniqueCategories = new Set(categories);
    return uniqueCategories.size / categories.length;
  }

  /**
   * Analyze common error patterns
   */
  analyzeCommonErrors(errorCases) {
    const errorPairs = new Map();
    
    for (const error of errorCases) {
      const key = `${error.actual} -> ${error.predicted}`;
      errorPairs.set(key, (errorPairs.get(key) || 0) + 1);
    }

    return Array.from(errorPairs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));
  }

  // === STATISTICAL UTILITY METHODS ===

  mean(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  std(arr) {
    const m = this.mean(arr);
    const variance = this.mean(arr.map(x => (x - m) ** 2));
    return Math.sqrt(variance);
  }

  percentiles(arr, percentiles) {
    const sorted = [...arr].sort((a, b) => a - b);
    const result = {};
    
    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[`p${p}`] = sorted[Math.max(0, index)];
    }
    
    return result;
  }

  histogram(arr, bins) {
    if (arr.length === 0) return [];
    
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const binWidth = (max - min) / bins;
    const histogram = new Array(bins).fill(0);
    
    for (const value of arr) {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
      histogram[binIndex]++;
    }
    
    return histogram.map((count, i) => ({
      range: [min + i * binWidth, min + (i + 1) * binWidth],
      count
    }));
  }

  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Save evaluation results to file
   */
  async saveResults(outputPath = 'evaluation_results.json') {
    if (!this.results) {
      throw new Error('No evaluation results available. Run evaluate() first.');
    }
    
    await fs.writeJSON(outputPath, this.results, { spaces: 2 });
    console.log(`Evaluation results saved to ${outputPath}`);
  }

  /**
   * Generate evaluation summary report
   */
  generateSummaryReport() {
    if (!this.results) {
      throw new Error('No evaluation results available. Run evaluate() first.');
    }

    const { metrics } = this.results;
    let report = '\n=== MODEL EVALUATION SUMMARY ===\n\n';

    // Classification Performance
    report += '📊 CLASSIFICATION METRICS\n';
    report += '-'.repeat(50) + '\n';
    
    for (const field of this.config.target_fields) {
      report += `\n${field.toUpperCase()}:\n`;
      for (const k of this.config.k_values) {
        const m = metrics.classification[field]?.[`k${k}`];
        if (m) {
          report += `  k=${k}: Accuracy=${(m.accuracy * 100).toFixed(1)}%, `;
          report += `Precision=${(m.macro_precision * 100).toFixed(1)}%, `;
          report += `Recall=${(m.macro_recall * 100).toFixed(1)}%, `;
          report += `F1=${(m.macro_f1 * 100).toFixed(1)}%\n`;
        }
      }
    }

    // Ranking Performance
    report += '\n📈 RANKING METRICS\n';
    report += '-'.repeat(50) + '\n';
    
    for (const field of this.config.target_fields) {
      report += `\n${field.toUpperCase()}:\n`;
      for (const k of this.config.k_values) {
        const m = metrics.ranking[field]?.[`k${k}`];
        if (m) {
          report += `  k=${k}: NDCG=${m.ndcg.toFixed(3)}, `;
          report += `MRR=${m.mrr.toFixed(3)}, `;
          report += `MAP=${m.map.toFixed(3)}\n`;
        }
      }
    }

    // Diversity Metrics
    report += '\n🌈 DIVERSITY & COVERAGE\n';
    report += '-'.repeat(50) + '\n';
    
    for (const field of this.config.target_fields) {
      const d = metrics.diversity[field];
      if (d) {
        report += `${field.toUpperCase()}: Coverage=${(d.catalog_coverage * 100).toFixed(1)}%, `;
        report += `Avg Diversity=${(d.avg_intra_list_diversity * 100).toFixed(1)}%\n`;
      }
    }

    // Performance
    report += '\n⚡ PERFORMANCE METRICS\n';
    report += '-'.repeat(50) + '\n';
    const perf = this.results.performance;
    report += `Average Prediction Time: ${perf.avg_prediction_time_ms.toFixed(2)}ms\n`;
    report += `Throughput: ${perf.throughput_per_second.toFixed(1)} predictions/sec\n`;
    report += `Memory Usage: ${perf.memory_usage_mb.heapUsed}MB\n`;

    report += '\n' + '='.repeat(50) + '\n';
    
    return report;
  }
}

// CLI interface
if (process.argv[1].endsWith('evaluator.js')) {
  (async () => {
    const [, , embeddingsPath, outputPath, configPath] = process.argv;
    
    let config = {};
    if (configPath && await fs.pathExists(configPath)) {
      config = await fs.readJSON(configPath);
    }

    const evaluator = new ModelEvaluator(config);
    await evaluator.initialize(embeddingsPath || 'embeddings.json');
    
    console.log('Running comprehensive evaluation...');
    const results = await evaluator.evaluate();
    
    // Save results
    const outputFile = outputPath || 'evaluation_results.json';
    await evaluator.saveResults(outputFile);
    
    // Print summary
    console.log(evaluator.generateSummaryReport());
    
    console.log(`\nDetailed results saved to: ${outputFile}`);
  })().catch(error => {
    console.error('Evaluation failed:', error);
    process.exit(1);
  });
}