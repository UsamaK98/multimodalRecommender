// eval-config.js - Configuration management for evaluation scenarios

/**
 * Default evaluation configurations for different scenarios
 */
export const EvaluationConfigs = {
  // Quick evaluation for development/debugging
  quick: {
    k_values: [3, 5],
    target_fields: ['articletype', 'gender'],
    test_split_ratio: 0.1,
    min_category_samples: 3,
    max_test_samples: 100, // Limit test set size
    performance_sample_size: 20
  },

  // Standard evaluation for regular assessment
  standard: {
    k_values: [1, 3, 5, 10],
    target_fields: ['articletype', 'gender', 'mastercategory', 'subcategory'],
    test_split_ratio: 0.2,
    min_category_samples: 5,
    diversity_threshold: 0.7,
    random_seed: 42
  },

  // Comprehensive evaluation for thorough analysis
  comprehensive: {
    k_values: [1, 3, 5, 10, 20],
    target_fields: ['articletype', 'gender', 'mastercategory', 'subcategory', 'basecolour'],
    test_split_ratio: 0.25,
    min_category_samples: 3,
    diversity_threshold: 0.7,
    random_seed: 42,
    enable_cross_validation: true,
    cv_folds: 5,
    performance_sample_size: 100
  },

  // Performance-focused evaluation
  performance: {
    k_values: [5],
    target_fields: ['articletype'],
    test_split_ratio: 0.1,
    min_category_samples: 5,
    focus_on_performance: true,
    performance_sample_size: 200,
    measure_memory_usage: true,
    profile_predictions: true
  },

  // Diversity and recommendation quality focused
  diversity: {
    k_values: [5, 10, 15],
    target_fields: ['articletype', 'gender', 'mastercategory'],
    test_split_ratio: 0.2,
    min_category_samples: 5,
    diversity_threshold: 0.7,
    focus_on_diversity: true,
    analyze_category_distribution: true,
    compute_novelty_metrics: true
  }
};

/**
 * Field-specific evaluation settings
 */
export const FieldConfigs = {
  articletype: {
    weight: 1.0,
    primary: true,
    min_samples_per_category: 10,
    expected_accuracy_threshold: 0.6
  },
  gender: {
    weight: 0.8,
    primary: true,
    min_samples_per_category: 20,
    expected_accuracy_threshold: 0.8
  },
  mastercategory: {
    weight: 0.9,
    primary: true,
    min_samples_per_category: 15,
    expected_accuracy_threshold: 0.7
  },
  subcategory: {
    weight: 0.7,
    primary: false,
    min_samples_per_category: 5,
    expected_accuracy_threshold: 0.5
  },
  basecolour: {
    weight: 0.6,
    primary: false,
    min_samples_per_category: 3,
    expected_accuracy_threshold: 0.4
  },
  season: {
    weight: 0.5,
    primary: false,
    min_samples_per_category: 8,
    expected_accuracy_threshold: 0.5
  },
  usage: {
    weight: 0.5,
    primary: false,
    min_samples_per_category: 5,
    expected_accuracy_threshold: 0.5
  }
};

/**
 * Configuration manager class
 */
export class EvaluationConfigManager {
  constructor() {
    this.currentConfig = null;
    this.customConfigs = new Map();
  }

  /**
   * Load a predefined configuration
   */
  loadConfig(configName) {
    if (!EvaluationConfigs[configName]) {
      throw new Error(`Unknown configuration: ${configName}. Available: ${Object.keys(EvaluationConfigs).join(', ')}`);
    }

    this.currentConfig = {
      name: configName,
      ...EvaluationConfigs[configName]
    };

    return this.currentConfig;
  }

  /**
   * Load configuration from file
   */
  async loadConfigFromFile(filePath) {
    const fs = await import('fs-extra');
    const config = await fs.readJSON(filePath);
    
    this.currentConfig = {
      name: 'custom',
      ...config
    };

    return this.currentConfig;
  }

  /**
   * Create a custom configuration
   */
  createCustomConfig(name, baseConfig = 'standard', overrides = {}) {
    const base = EvaluationConfigs[baseConfig] || EvaluationConfigs.standard;
    
    const customConfig = {
      name,
      ...base,
      ...overrides
    };

    this.customConfigs.set(name, customConfig);
    return customConfig;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.currentConfig || this.loadConfig('standard');
  }

  /**
   * Validate configuration
   */
  validateConfig(config = null) {
    config = config || this.getConfig();
    const errors = [];

    // Validate required fields
    if (!config.k_values || !Array.isArray(config.k_values) || config.k_values.length === 0) {
      errors.push('k_values must be a non-empty array');
    }

    if (!config.target_fields || !Array.isArray(config.target_fields) || config.target_fields.length === 0) {
      errors.push('target_fields must be a non-empty array');
    }

    if (config.test_split_ratio <= 0 || config.test_split_ratio >= 1) {
      errors.push('test_split_ratio must be between 0 and 1');
    }

    if (config.min_category_samples < 1) {
      errors.push('min_category_samples must be at least 1');
    }

    // Validate target fields
    for (const field of config.target_fields) {
      if (!FieldConfigs[field]) {
        console.warn(`Unknown field in target_fields: ${field}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    return true;
  }

  /**
   * Save configuration to file
   */
  async saveConfig(filePath, config = null) {
    const fs = await import('fs-extra');
    config = config || this.getConfig();
    
    await fs.writeJSON(filePath, config, { spaces: 2 });
    console.log(`Configuration saved to ${filePath}`);
  }

  /**
   * Get optimized configuration based on dataset size
   */
  getOptimizedConfig(datasetSize) {
    let baseConfig;

    if (datasetSize < 1000) {
      baseConfig = 'quick';
    } else if (datasetSize < 10000) {
      baseConfig = 'standard';
    } else {
      baseConfig = 'comprehensive';
    }

    const config = { ...EvaluationConfigs[baseConfig] };

    // Adjust parameters based on dataset size
    if (datasetSize > 50000) {
      config.test_split_ratio = 0.1; // Use smaller test split for very large datasets
      config.performance_sample_size = Math.min(500, config.performance_sample_size || 100);
    }

    return config;
  }

  /**
   * Generate A/B testing configuration
   */
  generateABTestConfig(configA = 'standard', configB = 'comprehensive') {
    return {
      name: 'ab_test',
      mode: 'comparison',
      configurations: {
        A: EvaluationConfigs[configA],
        B: EvaluationConfigs[configB]
      },
      statistical_tests: {
        significance_level: 0.05,
        min_effect_size: 0.02,
        power: 0.8
      }
    };
  }

  /**
   * List available configurations
   */
  listConfigs() {
    const predefined = Object.keys(EvaluationConfigs);
    const custom = Array.from(this.customConfigs.keys());

    return {
      predefined,
      custom,
      current: this.currentConfig?.name || null
    };
  }
}

/**
 * Utility functions for configuration management
 */
export const ConfigUtils = {
  /**
   * Merge multiple configurations
   */
  mergeConfigs(...configs) {
    return configs.reduce((merged, config) => ({ ...merged, ...config }), {});
  },

  /**
   * Create configuration for specific field focus
   */
  createFieldFocusedConfig(field, baseConfig = 'standard') {
    const base = EvaluationConfigs[baseConfig];
    return {
      ...base,
      name: `${field}_focused`,
      target_fields: [field],
      field_specific_analysis: true,
      primary_field: field
    };
  },

  /**
   * Create cross-validation configuration
   */
  createCrossValidationConfig(folds = 5, baseConfig = 'standard') {
    const base = EvaluationConfigs[baseConfig];
    return {
      ...base,
      name: `cv_${folds}fold`,
      enable_cross_validation: true,
      cv_folds: folds,
      test_split_ratio: 1.0 / folds // Each fold will be test set
    };
  },

  /**
   * Create bootstrap sampling configuration
   */
  createBootstrapConfig(samples = 100, baseConfig = 'standard') {
    const base = EvaluationConfigs[baseConfig];
    return {
      ...base,
      name: `bootstrap_${samples}`,
      enable_bootstrap: true,
      bootstrap_samples: samples,
      confidence_intervals: [0.05, 0.95]
    };
  }
};

// Export singleton instance for convenience
export const configManager = new EvaluationConfigManager();

// Default export
export default configManager;