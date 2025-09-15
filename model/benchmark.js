// benchmark.js - Performance benchmarking utilities for model evaluation

import fs from 'fs-extra';
import path from 'path';
import { loadEmbeddings, predictFromId, predictFromImage } from './predictor.js';
import { performance } from 'perf_hooks';

/**
 * Performance benchmarking suite for the multimodal recommender
 */
export class PerformanceBenchmark {
  constructor(config = {}) {
    this.config = {
      warmup_iterations: 10,
      benchmark_iterations: 100,
      memory_sample_interval: 100, // ms
      include_memory_profiling: true,
      include_cpu_profiling: false,
      detailed_timing: true,
      ...config
    };
    
    this.results = {
      system_info: this.getSystemInfo(),
      benchmarks: [],
      memory_profile: [],
      detailed_timings: [],
      summary: {}
    };
  }

  /**
   * Run comprehensive performance benchmark
   */
  async runBenchmark(embeddingsPath = 'embeddings.json', sampleSize = 100) {
    console.log('🔥 Starting Performance Benchmark Suite...');
    
    // Load embeddings
    console.log('Loading embeddings...');
    const startLoad = performance.now();
    const embeddings = await loadEmbeddings(embeddingsPath);
    const loadTime = performance.now() - startLoad;
    
    console.log(`Loaded ${embeddings.rows.length} embeddings in ${loadTime.toFixed(2)}ms`);
    
    // Select sample for benchmarking
    const sampleItems = this.selectBenchmarkSample(embeddings.rows, sampleSize);
    
    this.results.dataset_info = {
      total_items: embeddings.rows.length,
      sample_size: sampleItems.length,
      load_time_ms: loadTime
    };

    // 1. Prediction Speed Benchmark
    await this.benchmarkPredictionSpeed(embeddings, sampleItems);
    
    // 2. Memory Usage Benchmark
    await this.benchmarkMemoryUsage(embeddings, sampleItems);
    
    // 3. Scalability Benchmark
    await this.benchmarkScalability(embeddings, sampleItems);
    
    // 4. Cold vs Warm Performance
    await this.benchmarkColdWarmPerformance(embeddings, sampleItems);
    
    // 5. K-value Performance Impact
    await this.benchmarkKValueImpact(embeddings, sampleItems);
    
    // 6. Concurrent Performance
    await this.benchmarkConcurrentPerformance(embeddings, sampleItems);
    
    // Generate summary
    this.generateBenchmarkSummary();
    
    console.log('✅ Performance benchmark completed!');
    return this.results;
  }

  /**
   * Benchmark prediction speed with different configurations
   */
  async benchmarkPredictionSpeed(embeddings, sampleItems) {
    console.log('📊 Benchmarking prediction speed...');
    
    const kValues = [1, 3, 5, 10, 20];
    const fields = ['articletype', 'gender', 'mastercategory'];
    
    const speedResults = [];
    
    for (const k of kValues) {
      for (const field of fields) {
        const benchmarkName = `prediction_k${k}_${field}`;
        
        // Warmup
        for (let i = 0; i < this.config.warmup_iterations; i++) {
          const randomItem = sampleItems[i % sampleItems.length];
          predictFromId(randomItem.id, embeddings, k, field);
        }
        
        // Actual benchmark
        const times = [];
        const startTime = performance.now();
        
        for (let i = 0; i < this.config.benchmark_iterations; i++) {
          const randomItem = sampleItems[i % sampleItems.length];
          
          const iterStart = performance.now();
          predictFromId(randomItem.id, embeddings, k, field);
          const iterEnd = performance.now();
          
          times.push(iterEnd - iterStart);
        }
        
        const totalTime = performance.now() - startTime;
        
        speedResults.push({
          name: benchmarkName,
          k_value: k,
          field: field,
          iterations: this.config.benchmark_iterations,
          total_time_ms: totalTime,
          avg_time_ms: this.mean(times),
          median_time_ms: this.median(times),
          min_time_ms: Math.min(...times),
          max_time_ms: Math.max(...times),
          std_time_ms: this.std(times),
          throughput_per_sec: 1000 / this.mean(times),
          times_distribution: this.analyzeDistribution(times)
        });
        
        if (this.config.detailed_timing) {
          this.results.detailed_timings.push({
            benchmark: benchmarkName,
            individual_times: times
          });
        }
      }
    }
    
    this.results.benchmarks.push({
      category: 'prediction_speed',
      results: speedResults
    });
  }

  /**
   * Benchmark memory usage patterns
   */
  async benchmarkMemoryUsage(embeddings, sampleItems) {
    console.log('💾 Benchmarking memory usage...');
    
    if (!this.config.include_memory_profiling) {
      return;
    }

    const memoryProfile = [];
    let isMonitoring = true;
    
    // Start memory monitoring
    const memoryMonitor = setInterval(() => {
      if (isMonitoring) {
        const usage = process.memoryUsage();
        memoryProfile.push({
          timestamp: Date.now(),
          rss: usage.rss,
          heapTotal: usage.heapTotal,
          heapUsed: usage.heapUsed,
          external: usage.external
        });
      }
    }, this.config.memory_sample_interval);

    // Baseline memory usage
    const baselineMemory = process.memoryUsage();
    
    // Run memory-intensive operations
    const memoryTests = [
      {
        name: 'large_batch_predictions',
        operation: async () => {
          for (let i = 0; i < 1000; i++) {
            const randomItem = sampleItems[i % sampleItems.length];
            predictFromId(randomItem.id, embeddings, 10, 'articletype');
          }
        }
      },
      {
        name: 'high_k_predictions',
        operation: async () => {
          for (let i = 0; i < 100; i++) {
            const randomItem = sampleItems[i % sampleItems.length];
            predictFromId(randomItem.id, embeddings, 50, 'articletype');
          }
        }
      }
    ];

    const memoryResults = [];
    
    for (const test of memoryTests) {
      const startMemory = process.memoryUsage();
      const startTime = performance.now();
      
      await test.operation();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      memoryResults.push({
        test_name: test.name,
        duration_ms: endTime - startTime,
        memory_delta: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external
        },
        peak_memory: {
          rss: Math.max(...memoryProfile.slice(-50).map(m => m.rss)),
          heapUsed: Math.max(...memoryProfile.slice(-50).map(m => m.heapUsed))
        }
      });
    }
    
    // Stop memory monitoring
    isMonitoring = false;
    clearInterval(memoryMonitor);
    
    this.results.benchmarks.push({
      category: 'memory_usage',
      baseline_memory: baselineMemory,
      results: memoryResults,
      memory_profile: memoryProfile
    });
  }

  /**
   * Benchmark scalability with different dataset sizes
   */
  async benchmarkScalability(embeddings, sampleItems) {
    console.log('📈 Benchmarking scalability...');
    
    const scaleSizes = [100, 500, 1000, Math.min(5000, embeddings.rows.length)];
    const scalabilityResults = [];
    
    for (const size of scaleSizes) {
      console.log(`  Testing with ${size} embeddings...`);
      
      // Create subset of embeddings
      const subsetEmbeddings = {
        rows: embeddings.rows.slice(0, size),
        byId: new Map(Array.from(embeddings.byId.entries()).slice(0, size))
      };
      
      // Benchmark with this subset
      const testItems = sampleItems.slice(0, Math.min(50, size / 10));
      const times = [];
      
      for (const item of testItems) {
        if (subsetEmbeddings.byId.has(item.id)) {
          const start = performance.now();
          predictFromId(item.id, subsetEmbeddings, 5, 'articletype');
          const end = performance.now();
          times.push(end - start);
        }
      }
      
      if (times.length > 0) {
        scalabilityResults.push({
          dataset_size: size,
          test_samples: times.length,
          avg_time_ms: this.mean(times),
          median_time_ms: this.median(times),
          throughput_per_sec: 1000 / this.mean(times),
          time_complexity_factor: size > 100 ? this.mean(times) / (scalabilityResults[0]?.avg_time_ms || 1) : 1
        });
      }
    }
    
    this.results.benchmarks.push({
      category: 'scalability',
      results: scalabilityResults
    });
  }

  /**
   * Compare cold vs warm performance
   */
  async benchmarkColdWarmPerformance(embeddings, sampleItems) {
    console.log('🆚 Benchmarking cold vs warm performance...');
    
    const testItem = sampleItems[0];
    const iterations = 50;
    
    // Cold start (first prediction)
    const coldStart = performance.now();
    predictFromId(testItem.id, embeddings, 5, 'articletype');
    const coldTime = performance.now() - coldStart;
    
    // Warm up
    for (let i = 0; i < 10; i++) {
      predictFromId(testItem.id, embeddings, 5, 'articletype');
    }
    
    // Warm predictions
    const warmTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      predictFromId(testItem.id, embeddings, 5, 'articletype');
      const end = performance.now();
      warmTimes.push(end - start);
    }
    
    this.results.benchmarks.push({
      category: 'cold_vs_warm',
      results: {
        cold_start_ms: coldTime,
        warm_avg_ms: this.mean(warmTimes),
        warm_median_ms: this.median(warmTimes),
        performance_improvement: coldTime / this.mean(warmTimes),
        warm_std_ms: this.std(warmTimes)
      }
    });
  }

  /**
   * Benchmark impact of different k values
   */
  async benchmarkKValueImpact(embeddings, sampleItems) {
    console.log('🎯 Benchmarking k-value impact...');
    
    const kValues = [1, 5, 10, 20, 50, 100];
    const kResults = [];
    const testItem = sampleItems[0];
    
    for (const k of kValues) {
      const times = [];
      const iterations = 30;
      
      // Warmup
      for (let i = 0; i < 5; i++) {
        predictFromId(testItem.id, embeddings, k, 'articletype');
      }
      
      // Benchmark
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        predictFromId(testItem.id, embeddings, k, 'articletype');
        const end = performance.now();
        times.push(end - start);
      }
      
      kResults.push({
        k_value: k,
        avg_time_ms: this.mean(times),
        median_time_ms: this.median(times),
        min_time_ms: Math.min(...times),
        max_time_ms: Math.max(...times),
        throughput_per_sec: 1000 / this.mean(times),
        scaling_factor: k > 1 ? this.mean(times) / (kResults[0]?.avg_time_ms || 1) : 1
      });
    }
    
    this.results.benchmarks.push({
      category: 'k_value_impact',
      results: kResults
    });
  }

  /**
   * Benchmark concurrent performance
   */
  async benchmarkConcurrentPerformance(embeddings, sampleItems) {
    console.log('🔄 Benchmarking concurrent performance...');
    
    const concurrencyLevels = [1, 2, 4, 8];
    const concurrencyResults = [];
    
    for (const concurrency of concurrencyLevels) {
      console.log(`  Testing ${concurrency} concurrent requests...`);
      
      const promises = [];
      const operationsPerThread = 25;
      
      const start = performance.now();
      
      for (let thread = 0; thread < concurrency; thread++) {
        const promise = (async () => {
          const threadTimes = [];
          
          for (let i = 0; i < operationsPerThread; i++) {
            const testItem = sampleItems[(thread * operationsPerThread + i) % sampleItems.length];
            
            const opStart = performance.now();
            predictFromId(testItem.id, embeddings, 5, 'articletype');
            const opEnd = performance.now();
            
            threadTimes.push(opEnd - opStart);
          }
          
          return threadTimes;
        })();
        
        promises.push(promise);
      }
      
      const allThreadTimes = await Promise.all(promises);
      const end = performance.now();
      
      const flatTimes = allThreadTimes.flat();
      const totalOperations = concurrency * operationsPerThread;
      const totalTime = end - start;
      
      concurrencyResults.push({
        concurrency_level: concurrency,
        total_operations: totalOperations,
        total_time_ms: totalTime,
        avg_time_per_op_ms: this.mean(flatTimes),
        overall_throughput_per_sec: (totalOperations / totalTime) * 1000,
        efficiency: ((totalOperations / totalTime) * 1000) / (concurrencyResults[0]?.overall_throughput_per_sec || 1),
        contention_overhead: this.mean(flatTimes) / (concurrencyResults[0]?.avg_time_per_op_ms || 1)
      });
    }
    
    this.results.benchmarks.push({
      category: 'concurrent_performance',
      results: concurrencyResults
    });
  }

  /**
   * Generate benchmark summary
   */
  generateBenchmarkSummary() {
    const summary = {
      system_info: this.results.system_info,
      key_metrics: {},
      performance_grades: {},
      bottlenecks: [],
      recommendations: []
    };

    // Extract key metrics from each benchmark category
    for (const benchmark of this.results.benchmarks) {
      switch (benchmark.category) {
        case 'prediction_speed':
          const baselineSpeed = benchmark.results.find(r => r.k_value === 5 && r.field === 'articletype');
          if (baselineSpeed) {
            summary.key_metrics.avg_prediction_time_ms = baselineSpeed.avg_time_ms;
            summary.key_metrics.throughput_per_sec = baselineSpeed.throughput_per_sec;
            summary.performance_grades.speed = this.gradePerformance('speed', baselineSpeed.avg_time_ms);
          }
          break;
          
        case 'memory_usage':
          const memoryTest = benchmark.results.find(r => r.test_name === 'large_batch_predictions');
          if (memoryTest) {
            summary.key_metrics.memory_delta_mb = memoryTest.memory_delta.heapUsed / (1024 * 1024);
            summary.performance_grades.memory = this.gradePerformance('memory', summary.key_metrics.memory_delta_mb);
          }
          break;
          
        case 'scalability':
          const scalabilityData = benchmark.results;
          if (scalabilityData.length > 1) {
            const scalingFactor = scalabilityData[scalabilityData.length - 1].time_complexity_factor;
            summary.key_metrics.scalability_factor = scalingFactor;
            summary.performance_grades.scalability = this.gradePerformance('scalability', scalingFactor);
          }
          break;
      }
    }

    // Identify bottlenecks
    if (summary.key_metrics.avg_prediction_time_ms > 50) {
      summary.bottlenecks.push('High prediction latency');
    }
    
    if (summary.key_metrics.memory_delta_mb > 100) {
      summary.bottlenecks.push('Excessive memory usage');
    }
    
    if (summary.key_metrics.scalability_factor > 2) {
      summary.bottlenecks.push('Poor scalability with dataset size');
    }

    // Generate recommendations
    summary.recommendations = this.generatePerformanceRecommendations(summary);
    
    this.results.summary = summary;
  }

  /**
   * Generate performance recommendations
   */
  generatePerformanceRecommendations(summary) {
    const recommendations = [];
    
    if (summary.key_metrics.avg_prediction_time_ms > 10) {
      recommendations.push({
        type: 'optimization',
        priority: 'high',
        title: 'Optimize Similarity Computation',
        description: `Average prediction time of ${summary.key_metrics.avg_prediction_time_ms.toFixed(2)}ms could be improved.`,
        actions: [
          'Consider using approximate nearest neighbor algorithms (e.g., Annoy, Faiss)',
          'Implement caching for frequently requested predictions',
          'Use SIMD optimizations for vector operations'
        ]
      });
    }
    
    if (summary.key_metrics.memory_delta_mb > 50) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        title: 'Reduce Memory Footprint',
        description: `Memory usage increases by ${summary.key_metrics.memory_delta_mb.toFixed(1)}MB during intensive operations.`,
        actions: [
          'Implement streaming for large batch operations',
          'Use memory-efficient data structures',
          'Add garbage collection triggers after batch operations'
        ]
      });
    }
    
    if (summary.key_metrics.scalability_factor > 1.5) {
      recommendations.push({
        type: 'scalability',
        priority: 'high',
        title: 'Improve Scalability',
        description: `Performance degrades by ${summary.key_metrics.scalability_factor}x with larger datasets.`,
        actions: [
          'Implement hierarchical clustering for faster search',
          'Use indexing strategies to reduce search space',
          'Consider distributed computing for very large datasets'
        ]
      });
    }
    
    // Always include monitoring recommendation
    recommendations.push({
      type: 'monitoring',
      priority: 'low',
      title: 'Implement Performance Monitoring',
      description: 'Set up continuous performance monitoring in production.',
      actions: [
        'Add performance metrics to production logs',
        'Set up alerting for performance degradation',
        'Implement A/B testing for performance optimizations'
      ]
    });
    
    return recommendations;
  }

  /**
   * Grade performance in different categories
   */
  gradePerformance(category, value) {
    const thresholds = {
      speed: { // avg prediction time in ms
        A: 5, B: 10, C: 25, D: 50
      },
      memory: { // memory delta in MB
        A: 20, B: 50, C: 100, D: 200
      },
      scalability: { // scaling factor
        A: 1.2, B: 1.5, C: 2.0, D: 3.0
      }
    };
    
    const categoryThresholds = thresholds[category];
    if (!categoryThresholds) return 'N/A';
    
    if (value <= categoryThresholds.A) return 'A';
    if (value <= categoryThresholds.B) return 'B';
    if (value <= categoryThresholds.C) return 'C';
    if (value <= categoryThresholds.D) return 'D';
    return 'F';
  }

  /**
   * Select representative sample for benchmarking
   */
  selectBenchmarkSample(items, sampleSize) {
    // Use stratified sampling to ensure representative sample
    const shuffle = array => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };
    
    return shuffle([...items]).slice(0, sampleSize);
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      memory_total_mb: Math.round(require('os').totalmem() / (1024 * 1024)),
      cpu_cores: require('os').cpus().length,
      cpu_model: require('os').cpus()[0]?.model || 'Unknown',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Save benchmark results
   */
  async saveBenchmarkResults(outputPath = 'benchmark_results.json') {
    await fs.writeJSON(outputPath, this.results, { spaces: 2 });
    console.log(`Benchmark results saved to ${outputPath}`);
    return outputPath;
  }

  /**
   * Generate benchmark report
   */
  generateBenchmarkReport() {
    const { summary, system_info, benchmarks } = this.results;
    
    let report = '# 🔥 Performance Benchmark Report\n\n';
    
    // System Info
    report += '## System Information\n\n';
    report += `- **Node.js:** ${system_info.node_version}\n`;
    report += `- **Platform:** ${system_info.platform} (${system_info.arch})\n`;
    report += `- **Memory:** ${system_info.memory_total_mb}MB\n`;
    report += `- **CPU:** ${system_info.cpu_model} (${system_info.cpu_cores} cores)\n`;
    report += `- **Timestamp:** ${system_info.timestamp}\n\n`;
    
    // Key Metrics
    report += '## 📊 Key Performance Metrics\n\n';
    report += `- **Average Prediction Time:** ${summary.key_metrics.avg_prediction_time_ms?.toFixed(2) || 'N/A'}ms\n`;
    report += `- **Throughput:** ${summary.key_metrics.throughput_per_sec?.toFixed(1) || 'N/A'} predictions/sec\n`;
    report += `- **Memory Delta:** ${summary.key_metrics.memory_delta_mb?.toFixed(1) || 'N/A'}MB\n`;
    report += `- **Scalability Factor:** ${summary.key_metrics.scalability_factor?.toFixed(2) || 'N/A'}x\n\n`;
    
    // Performance Grades
    report += '## 🎯 Performance Grades\n\n';
    for (const [category, grade] of Object.entries(summary.performance_grades)) {
      report += `- **${category.charAt(0).toUpperCase() + category.slice(1)}:** ${grade}\n`;
    }
    report += '\n';
    
    // Bottlenecks
    if (summary.bottlenecks.length > 0) {
      report += '## 🚨 Identified Bottlenecks\n\n';
      for (const bottleneck of summary.bottlenecks) {
        report += `- ${bottleneck}\n`;
      }
      report += '\n';
    }
    
    // Recommendations
    report += '## 💡 Performance Recommendations\n\n';
    for (const rec of summary.recommendations) {
      report += `### ${rec.title}\n\n`;
      report += `**Priority:** ${rec.priority.toUpperCase()}\n\n`;
      report += `${rec.description}\n\n`;
      report += '**Actions:**\n';
      for (const action of rec.actions) {
        report += `- ${action}\n`;
      }
      report += '\n';
    }
    
    return report;
  }

  // Statistical utility methods
  mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  std(arr) {
    const avg = this.mean(arr);
    return Math.sqrt(this.mean(arr.map(x => (x - avg) ** 2)));
  }

  analyzeDistribution(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    return {
      p25: this.percentile(sorted, 25),
      p75: this.percentile(sorted, 75),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    };
  }

  percentile(sortedArr, p) {
    const index = (p / 100) * (sortedArr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArr[lower];
    }
    
    const weight = index - lower;
    return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
  }
}

/**
 * Quick benchmark utility for single operations
 */
export class QuickBenchmark {
  static async time(operation, iterations = 1) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await operation();
      const end = performance.now();
      times.push(end - start);
    }
    
    return {
      iterations,
      total_time_ms: times.reduce((a, b) => a + b, 0),
      avg_time_ms: times.reduce((a, b) => a + b, 0) / times.length,
      min_time_ms: Math.min(...times),
      max_time_ms: Math.max(...times),
      times
    };
  }
  
  static memoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss_mb: Math.round(usage.rss / 1024 / 1024),
      heap_total_mb: Math.round(usage.heapTotal / 1024 / 1024),
      heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
      external_mb: Math.round(usage.external / 1024 / 1024)
    };
  }
}

// CLI interface
if (process.argv[1].endsWith('benchmark.js')) {
  (async () => {
    const [, , embeddingsPath, outputPath] = process.argv;
    
    const benchmark = new PerformanceBenchmark();
    const results = await benchmark.runBenchmark(embeddingsPath || 'embeddings.json');
    
    // Save results
    await benchmark.saveBenchmarkResults(outputPath || 'benchmark_results.json');
    
    // Generate and display report
    const report = benchmark.generateBenchmarkReport();
    console.log('\n' + report);
    
    // Save report
    const reportPath = (outputPath || 'benchmark_results.json').replace('.json', '_report.md');
    await fs.writeFile(reportPath, report);
    console.log(`\nBenchmark report saved to: ${reportPath}`);
    
  })().catch(error => {
    console.error('Benchmark failed:', error);
    process.exit(1);
  });
}

export { PerformanceBenchmark, QuickBenchmark };