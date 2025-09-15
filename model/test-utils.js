// test-utils.js - Utilities for test data management and validation

import fs from 'fs-extra';
import path from 'path';

/**
 * Data splitting utilities for evaluation
 */
export class DataSplitter {
  constructor(randomSeed = 42) {
    this.randomSeed = randomSeed;
    this.rng = this.createSeededRandom(randomSeed);
  }

  /**
   * Create a seeded random number generator
   */
  createSeededRandom(seed) {
    let state = seed;
    return function() {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }

  /**
   * Simple train/test split
   */
  trainTestSplit(data, testSize = 0.2, shuffle = true) {
    const dataCopy = shuffle ? this.shuffleArray([...data]) : [...data];
    const testCount = Math.floor(data.length * testSize);
    
    return {
      train: dataCopy.slice(testCount),
      test: dataCopy.slice(0, testCount),
      split_info: {
        total_samples: data.length,
        train_samples: dataCopy.length - testCount,
        test_samples: testCount,
        test_ratio: testCount / data.length
      }
    };
  }

  /**
   * Stratified split maintaining category distributions
   */
  stratifiedSplit(data, testSize = 0.2, stratifyField, minSamplesPerCategory = 2) {
    // Group by category
    const groups = new Map();
    for (const item of data) {
      const category = this.extractFieldValue(item, stratifyField);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(item);
    }

    const train = [];
    const test = [];
    const categoryStats = new Map();

    // Split each category proportionally
    for (const [category, items] of groups) {
      if (items.length < minSamplesPerCategory) {
        // Keep small categories in training only
        train.push(...items);
        categoryStats.set(category, {
          total: items.length,
          train: items.length,
          test: 0,
          kept_in_train: true
        });
        continue;
      }

      const shuffled = this.shuffleArray([...items]);
      const testCount = Math.max(1, Math.floor(items.length * testSize));
      const testItems = shuffled.slice(0, testCount);
      const trainItems = shuffled.slice(testCount);
      
      test.push(...testItems);
      train.push(...trainItems);

      categoryStats.set(category, {
        total: items.length,
        train: trainItems.length,
        test: testItems.length,
        test_ratio: testCount / items.length
      });
    }

    return {
      train,
      test,
      split_info: {
        total_samples: data.length,
        train_samples: train.length,
        test_samples: test.length,
        categories: categoryStats.size,
        category_stats: Object.fromEntries(categoryStats)
      }
    };
  }

  /**
   * Create K-fold cross-validation splits
   */
  kFoldSplit(data, k = 5, shuffle = true, stratify = null) {
    if (k < 2) throw new Error('k must be at least 2');
    if (k > data.length) throw new Error('k cannot be larger than dataset size');

    const dataCopy = shuffle ? this.shuffleArray([...data]) : [...data];
    
    // If stratifying, use stratified k-fold
    if (stratify) {
      return this.stratifiedKFoldSplit(dataCopy, k, stratify);
    }

    // Simple k-fold split
    const folds = [];
    const foldSize = Math.floor(data.length / k);
    
    for (let i = 0; i < k; i++) {
      const start = i * foldSize;
      const end = i === k - 1 ? data.length : start + foldSize; // Last fold gets remaining items
      
      const testFold = dataCopy.slice(start, end);
      const trainFold = [...dataCopy.slice(0, start), ...dataCopy.slice(end)];
      
      folds.push({
        fold: i + 1,
        train: trainFold,
        test: testFold,
        train_size: trainFold.length,
        test_size: testFold.length
      });
    }

    return {
      folds,
      fold_info: {
        k,
        total_samples: data.length,
        avg_train_size: Math.round(folds.reduce((sum, fold) => sum + fold.train_size, 0) / k),
        avg_test_size: Math.round(folds.reduce((sum, fold) => sum + fold.test_size, 0) / k)
      }
    };
  }

  /**
   * Stratified K-fold split
   */
  stratifiedKFoldSplit(data, k, stratifyField) {
    // Group by category
    const groups = new Map();
    for (const item of data) {
      const category = this.extractFieldValue(item, stratifyField);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(item);
    }

    // Create k empty folds
    const folds = Array(k).fill().map((_, i) => ({
      fold: i + 1,
      train: [],
      test: [],
      train_size: 0,
      test_size: 0
    }));

    // Distribute each category across folds
    for (const [category, items] of groups) {
      const shuffled = this.shuffleArray([...items]);
      const foldSize = Math.floor(items.length / k);
      
      for (let i = 0; i < k; i++) {
        const start = i * foldSize;
        const end = i === k - 1 ? items.length : start + foldSize;
        
        const testItems = shuffled.slice(start, end);
        const trainItems = [...shuffled.slice(0, start), ...shuffled.slice(end)];
        
        folds[i].test.push(...testItems);
        folds[i].train.push(...trainItems);
      }
    }

    // Update sizes
    folds.forEach(fold => {
      fold.train_size = fold.train.length;
      fold.test_size = fold.test.length;
    });

    return {
      folds,
      fold_info: {
        k,
        stratified: true,
        stratify_field: stratifyField,
        total_samples: data.length,
        categories: groups.size,
        avg_train_size: Math.round(folds.reduce((sum, fold) => sum + fold.train_size, 0) / k),
        avg_test_size: Math.round(folds.reduce((sum, fold) => sum + fold.test_size, 0) / k)
      }
    };
  }

  /**
   * Bootstrap sampling
   */
  bootstrapSample(data, numSamples = 1000, sampleSize = null) {
    sampleSize = sampleSize || data.length;
    const samples = [];

    for (let i = 0; i < numSamples; i++) {
      const sample = [];
      for (let j = 0; j < sampleSize; j++) {
        const randomIndex = Math.floor(this.rng() * data.length);
        sample.push(data[randomIndex]);
      }
      samples.push(sample);
    }

    return {
      samples,
      sample_info: {
        num_samples: numSamples,
        sample_size: sampleSize,
        original_size: data.length,
        with_replacement: true
      }
    };
  }

  /**
   * Leave-One-Out split (for small datasets)
   */
  leaveOneOutSplit(data) {
    const splits = [];
    
    for (let i = 0; i < data.length; i++) {
      splits.push({
        fold: i + 1,
        train: [...data.slice(0, i), ...data.slice(i + 1)],
        test: [data[i]],
        train_size: data.length - 1,
        test_size: 1
      });
    }

    return {
      splits,
      split_info: {
        method: 'leave_one_out',
        total_splits: data.length,
        total_samples: data.length
      }
    };
  }

  /**
   * Time-based split (for temporal data)
   */
  timeSplit(data, testSize = 0.2, timeField = 'timestamp') {
    // Sort by time field
    const sortedData = [...data].sort((a, b) => {
      const timeA = this.extractFieldValue(a, timeField);
      const timeB = this.extractFieldValue(b, timeField);
      return new Date(timeA) - new Date(timeB);
    });

    const splitPoint = Math.floor(data.length * (1 - testSize));
    
    return {
      train: sortedData.slice(0, splitPoint),
      test: sortedData.slice(splitPoint),
      split_info: {
        method: 'time_based',
        split_field: timeField,
        total_samples: data.length,
        train_samples: splitPoint,
        test_samples: data.length - splitPoint,
        train_end_time: this.extractFieldValue(sortedData[splitPoint - 1], timeField),
        test_start_time: this.extractFieldValue(sortedData[splitPoint], timeField)
      }
    };
  }

  // Helper methods
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  extractFieldValue(item, field) {
    return item.metadata ? item.metadata[field] : item[field];
  }
}

/**
 * Ground truth management utilities
 */
export class GroundTruthManager {
  constructor() {
    this.groundTruthData = new Map();
    this.annotations = new Map();
  }

  /**
   * Load ground truth from file
   */
  async loadGroundTruth(filePath, format = 'json') {
    if (format === 'json') {
      const data = await fs.readJSON(filePath);
      this.setGroundTruth(data);
    } else if (format === 'csv') {
      // TODO: Implement CSV loading
      throw new Error('CSV format not yet implemented');
    }
    
    return this.groundTruthData.size;
  }

  /**
   * Set ground truth data
   */
  setGroundTruth(data) {
    this.groundTruthData.clear();
    
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.id) {
          this.groundTruthData.set(item.id, item);
        }
      }
    } else {
      for (const [id, item] of Object.entries(data)) {
        this.groundTruthData.set(id, item);
      }
    }
  }

  /**
   * Get ground truth for specific item
   */
  getGroundTruth(itemId) {
    return this.groundTruthData.get(itemId);
  }

  /**
   * Add manual annotation
   */
  addAnnotation(itemId, field, value, annotator = 'system', confidence = 1.0) {
    if (!this.annotations.has(itemId)) {
      this.annotations.set(itemId, {});
    }
    
    const itemAnnotations = this.annotations.get(itemId);
    if (!itemAnnotations[field]) {
      itemAnnotations[field] = [];
    }
    
    itemAnnotations[field].push({
      value,
      annotator,
      confidence,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get annotations for item
   */
  getAnnotations(itemId, field = null) {
    const annotations = this.annotations.get(itemId) || {};
    return field ? annotations[field] || [] : annotations;
  }

  /**
   * Validate ground truth consistency
   */
  validateGroundTruth() {
    const issues = [];
    const fieldConsistency = new Map();

    for (const [id, item] of this.groundTruthData) {
      // Check for missing required fields
      const requiredFields = ['articletype', 'gender', 'mastercategory'];
      for (const field of requiredFields) {
        if (!this.getFieldValue(item, field)) {
          issues.push({
            type: 'missing_field',
            item_id: id,
            field,
            message: `Missing required field: ${field}`
          });
        }
      }

      // Track field value consistency
      for (const field of Object.keys(item.metadata || item)) {
        const value = this.getFieldValue(item, field);
        if (!fieldConsistency.has(field)) {
          fieldConsistency.set(field, new Set());
        }
        fieldConsistency.get(field).add(value);
      }
    }

    // Check for potential data quality issues
    for (const [field, values] of fieldConsistency) {
      if (values.size > 100) {
        issues.push({
          type: 'high_cardinality',
          field,
          unique_values: values.size,
          message: `Field ${field} has very high cardinality (${values.size} unique values)`
        });
      }
    }

    return {
      total_items: this.groundTruthData.size,
      issues,
      field_stats: Object.fromEntries(
        Array.from(fieldConsistency.entries()).map(([field, values]) => [
          field,
          { unique_values: values.size, values: Array.from(values).slice(0, 10) }
        ])
      )
    };
  }

  /**
   * Export ground truth
   */
  async exportGroundTruth(filePath, format = 'json') {
    const data = Object.fromEntries(this.groundTruthData);
    
    if (format === 'json') {
      await fs.writeJSON(filePath, data, { spaces: 2 });
    } else if (format === 'csv') {
      // TODO: Implement CSV export
      throw new Error('CSV export not yet implemented');
    }
    
    console.log(`Ground truth exported to ${filePath}`);
  }

  getFieldValue(item, field) {
    return item.metadata ? item.metadata[field] : item[field];
  }
}

/**
 * Cross-validation utilities
 */
export class CrossValidator {
  constructor(config = {}) {
    this.config = {
      k: 5,
      stratify: true,
      random_seed: 42,
      ...config
    };
    this.splitter = new DataSplitter(this.config.random_seed);
  }

  /**
   * Perform k-fold cross-validation
   */
  async performCrossValidation(data, evaluationFunction, stratifyField = null) {
    const stratify = this.config.stratify ? (stratifyField || 'articletype') : null;
    const splits = this.splitter.kFoldSplit(data, this.config.k, true, stratify);
    
    const results = [];
    
    for (let i = 0; i < splits.folds.length; i++) {
      const fold = splits.folds[i];
      console.log(`Running cross-validation fold ${fold.fold}/${this.config.k}...`);
      
      try {
        const foldResult = await evaluationFunction(fold.train, fold.test, i);
        results.push({
          fold: fold.fold,
          ...foldResult,
          train_size: fold.train_size,
          test_size: fold.test_size
        });
      } catch (error) {
        console.error(`Error in fold ${fold.fold}:`, error);
        results.push({
          fold: fold.fold,
          error: error.message,
          train_size: fold.train_size,
          test_size: fold.test_size
        });
      }
    }

    return this.aggregateCrossValidationResults(results, splits.fold_info);
  }

  /**
   * Aggregate cross-validation results
   */
  aggregateCrossValidationResults(foldResults, foldInfo) {
    const validResults = foldResults.filter(r => !r.error);
    
    if (validResults.length === 0) {
      throw new Error('All cross-validation folds failed');
    }

    // Extract metric names from first successful fold
    const sampleResult = validResults[0];
    const metricKeys = Object.keys(sampleResult).filter(
      key => !['fold', 'train_size', 'test_size', 'error'].includes(key) && 
             typeof sampleResult[key] === 'number'
    );

    const aggregated = {
      cv_info: foldInfo,
      successful_folds: validResults.length,
      failed_folds: foldResults.length - validResults.length,
      metrics: {}
    };

    // Compute statistics for each metric
    for (const metric of metricKeys) {
      const values = validResults.map(r => r[metric]).filter(v => !isNaN(v));
      
      if (values.length > 0) {
        aggregated.metrics[metric] = {
          mean: this.mean(values),
          std: this.std(values),
          min: Math.min(...values),
          max: Math.max(...values),
          values: values
        };
      }
    }

    // Include individual fold results
    aggregated.fold_results = foldResults;

    return aggregated;
  }

  // Statistical helper methods
  mean(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  std(arr) {
    const m = this.mean(arr);
    const variance = this.mean(arr.map(x => (x - m) ** 2));
    return Math.sqrt(variance);
  }
}

/**
 * Test suite manager
 */
export class TestSuiteManager {
  constructor() {
    this.testSuites = new Map();
    this.results = new Map();
  }

  /**
   * Register a test suite
   */
  registerTestSuite(name, config) {
    this.testSuites.set(name, {
      name,
      ...config,
      registered_at: new Date().toISOString()
    });
  }

  /**
   * Run specific test suite
   */
  async runTestSuite(name, data, evaluationFunction) {
    const suite = this.testSuites.get(name);
    if (!suite) {
      throw new Error(`Test suite '${name}' not found`);
    }

    console.log(`Running test suite: ${name}`);
    const startTime = Date.now();
    
    try {
      let results;
      
      if (suite.type === 'cross_validation') {
        const cv = new CrossValidator(suite.cv_config);
        results = await cv.performCrossValidation(data, evaluationFunction, suite.stratify_field);
      } else if (suite.type === 'bootstrap') {
        // TODO: Implement bootstrap evaluation
        throw new Error('Bootstrap evaluation not yet implemented');
      } else {
        // Simple train/test split
        const splitter = new DataSplitter(suite.random_seed);
        const split = splitter.stratifiedSplit(data, suite.test_ratio, suite.stratify_field);
        results = await evaluationFunction(split.train, split.test, 0);
      }
      
      const endTime = Date.now();
      
      const suiteResult = {
        suite_name: name,
        success: true,
        duration_ms: endTime - startTime,
        timestamp: new Date().toISOString(),
        config: suite,
        results
      };
      
      this.results.set(name, suiteResult);
      return suiteResult;
      
    } catch (error) {
      const errorResult = {
        suite_name: name,
        success: false,
        error: error.message,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        config: suite
      };
      
      this.results.set(name, errorResult);
      throw error;
    }
  }

  /**
   * Get test suite results
   */
  getResults(suiteName = null) {
    if (suiteName) {
      return this.results.get(suiteName);
    }
    return Object.fromEntries(this.results);
  }

  /**
   * List available test suites
   */
  listTestSuites() {
    return Array.from(this.testSuites.values());
  }

  /**
   * Save results to file
   */
  async saveResults(filePath) {
    const allResults = this.getResults();
    await fs.writeJSON(filePath, allResults, { spaces: 2 });
    console.log(`Test results saved to ${filePath}`);
  }
}

// Create default test suites
export const createDefaultTestSuites = () => {
  const manager = new TestSuiteManager();
  
  manager.registerTestSuite('quick_test', {
    type: 'simple_split',
    test_ratio: 0.2,
    stratify_field: 'articletype',
    random_seed: 42
  });
  
  manager.registerTestSuite('cross_validation', {
    type: 'cross_validation',
    cv_config: { k: 5, stratify: true },
    stratify_field: 'articletype'
  });
  
  manager.registerTestSuite('comprehensive', {
    type: 'cross_validation',
    cv_config: { k: 10, stratify: true },
    stratify_field: 'articletype'
  });
  
  return manager;
};

// Export utilities
export { DataSplitter, GroundTruthManager, CrossValidator, TestSuiteManager };