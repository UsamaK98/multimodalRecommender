#!/usr/bin/env node

// run-evaluation.js - Complete example of running the evaluation system

import { ModelEvaluator } from './evaluator.js';
import { ReportGenerator } from './report-generator.js';
import { EvaluationVisualizer } from './visualizer.js';
import { PerformanceBenchmark } from './benchmark.js';
import { configManager } from './eval-config.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Complete evaluation pipeline demonstration
 */
async function runComprehensiveEvaluation() {
  console.log('🚀 Starting Comprehensive Model Evaluation\n');
  
  const outputDir = 'evaluation_output';
  await fs.ensureDir(outputDir);
  
  try {
    // 1. Configure Evaluation
    console.log('📋 Step 1: Configuring evaluation...');
    const config = configManager.loadConfig('standard');
    console.log(`Using configuration: ${config.name}`);
    console.log(`Target fields: ${config.target_fields.join(', ')}`);
    console.log(`K values: ${config.k_values.join(', ')}`);
    console.log(`Test split ratio: ${config.test_split_ratio}\n`);
    
    // 2. Run Main Evaluation
    console.log('🔬 Step 2: Running main evaluation...');
    const evaluator = new ModelEvaluator(config);
    await evaluator.initialize('embeddings.json');
    
    const evaluationResults = await evaluator.evaluate();
    
    // Save detailed results
    const resultsPath = path.join(outputDir, 'evaluation_results.json');
    await evaluator.saveResults(resultsPath);
    console.log(`✅ Evaluation completed! Results saved to ${resultsPath}`);
    
    // Display summary
    console.log('\n📊 EVALUATION SUMMARY:');
    console.log(evaluator.generateSummaryReport());
    
    // 3. Performance Benchmark
    console.log('⚡ Step 3: Running performance benchmark...');
    const benchmark = new PerformanceBenchmark({
      benchmark_iterations: 50,
      include_memory_profiling: true
    });
    
    const benchmarkResults = await benchmark.runBenchmark('embeddings.json', 50);
    const benchmarkPath = path.join(outputDir, 'benchmark_results.json');
    await benchmark.saveBenchmarkResults(benchmarkPath);
    
    console.log('\n🔥 PERFORMANCE SUMMARY:');
    console.log(benchmark.generateBenchmarkReport());
    
    // 4. Generate Reports
    console.log('\n📝 Step 4: Generating reports...');
    const reportGen = new ReportGenerator();
    
    // HTML Report
    const htmlPath = path.join(outputDir, 'evaluation_report.html');
    await reportGen.generateHTMLReport(evaluationResults, htmlPath);
    console.log(`✅ HTML report generated: ${htmlPath}`);
    
    // Markdown Report
    const mdPath = path.join(outputDir, 'evaluation_report.md');
    await reportGen.generateMarkdownReport(evaluationResults, mdPath);
    console.log(`✅ Markdown report generated: ${mdPath}`);
    
    // JSON Summary
    const summaryPath = path.join(outputDir, 'evaluation_summary.json');
    await reportGen.generateJSONSummary(evaluationResults, summaryPath);
    console.log(`✅ JSON summary generated: ${summaryPath}`);
    
    // 5. Export Visualization Data
    console.log('\n📈 Step 5: Exporting visualization data...');
    const visualizer = new EvaluationVisualizer();
    const vizDir = path.join(outputDir, 'visualization_data');
    await visualizer.exportForVisualization(evaluationResults, vizDir);
    console.log(`✅ Visualization data exported to: ${vizDir}`);
    
    // 6. Final Summary
    console.log('\n🎉 EVALUATION COMPLETE!');
    console.log('=' * 50);
    console.log(`\n📁 All results saved to: ${outputDir}/`);
    console.log('\n📋 Generated files:');
    console.log(`  • ${resultsPath} - Detailed evaluation results`);
    console.log(`  • ${benchmarkPath} - Performance benchmark results`);
    console.log(`  • ${htmlPath} - Interactive HTML report`);
    console.log(`  • ${mdPath} - Markdown documentation report`);
    console.log(`  • ${summaryPath} - JSON summary for integration`);
    console.log(`  • ${vizDir}/ - Visualization data and examples`);
    
    // Show key insights
    const summary = reportGen.createSummaryReport(evaluationResults);
    console.log('\n🎯 KEY INSIGHTS:');
    console.log(`  • Overall Performance Grade: ${summary.overall_performance.grade}`);
    console.log(`  • Overall Score: ${(summary.overall_performance.score * 100).toFixed(1)}%`);
    console.log(`  • ${summary.overall_performance.interpretation}`);
    
    if (summary.recommendations && summary.recommendations.length > 0) {
      console.log('\n💡 TOP RECOMMENDATIONS:');
      for (const rec of summary.recommendations.slice(0, 3)) {
        console.log(`  • ${rec.title} (${rec.priority.toUpperCase()})`);
      }
    }
    
    console.log('\n🚀 Next Steps:');
    console.log('  1. Review the HTML report for detailed insights');
    console.log('  2. Check visualization_data/ for plotting examples');
    console.log('  3. Implement recommended improvements');
    console.log('  4. Re-run evaluation to track progress');
    
  } catch (error) {
    console.error('❌ Evaluation failed:', error);
    console.error('\n🔍 Troubleshooting:');
    console.error('  • Ensure embeddings.json exists and is valid');
    console.error('  • Check that all dependencies are installed');
    console.error('  • Verify sufficient memory and disk space');
    process.exit(1);
  }
}

/**
 * Quick evaluation for development/testing
 */
async function runQuickEvaluation() {
  console.log('⚡ Starting Quick Evaluation\n');
  
  try {
    const config = configManager.loadConfig('quick');
    const evaluator = new ModelEvaluator(config);
    
    await evaluator.initialize('embeddings.json');
    const results = await evaluator.evaluate();
    
    console.log(evaluator.generateSummaryReport());
    
    await evaluator.saveResults('quick_evaluation_results.json');
    console.log('\n✅ Quick evaluation completed! Results saved to quick_evaluation_results.json');
    
  } catch (error) {
    console.error('❌ Quick evaluation failed:', error);
    process.exit(1);
  }
}

/**
 * Benchmark-only run
 */
async function runBenchmarkOnly() {
  console.log('🔥 Starting Performance Benchmark Only\n');
  
  try {
    const benchmark = new PerformanceBenchmark();
    const results = await benchmark.runBenchmark('embeddings.json', 100);
    
    await benchmark.saveBenchmarkResults('benchmark_results.json');
    console.log(benchmark.generateBenchmarkReport());
    
    console.log('\n✅ Benchmark completed! Results saved to benchmark_results.json');
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// CLI Interface
const command = process.argv[2] || 'comprehensive';

switch (command.toLowerCase()) {
  case 'comprehensive':
  case 'full':
    runComprehensiveEvaluation();
    break;
    
  case 'quick':
  case 'fast':
    runQuickEvaluation();
    break;
    
  case 'benchmark':
  case 'perf':
    runBenchmarkOnly();
    break;
    
  case 'help':
  case '--help':
  case '-h':
    console.log(`
🤖 Multimodal Recommender Evaluation Tool

Usage: node run-evaluation.js [command]

Commands:
  comprehensive    Run complete evaluation with all metrics (default)
  quick           Run fast evaluation with essential metrics only
  benchmark       Run performance benchmark only
  help            Show this help message

Examples:
  node run-evaluation.js comprehensive
  node run-evaluation.js quick
  node run-evaluation.js benchmark

Output:
  All results are saved to ./evaluation_output/ directory
  HTML reports are generated for easy viewing
  Visualization data is exported for plotting
    `);
    break;
    
  default:
    console.error(`❌ Unknown command: ${command}`);
    console.error('Run "node run-evaluation.js help" for usage information');
    process.exit(1);
}