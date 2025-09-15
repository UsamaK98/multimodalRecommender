// report-generator.js - Comprehensive reporting system for evaluation results

import fs from 'fs-extra';
import path from 'path';

/**
 * Report generator for evaluation results
 */
export class ReportGenerator {
  constructor(config = {}) {
    this.config = {
      include_plots: true,
      include_detailed_errors: true,
      include_recommendations: true,
      max_categories_in_tables: 20,
      decimal_precision: 3,
      ...config
    };
  }

  /**
   * Generate comprehensive HTML report
   */
  async generateHTMLReport(evaluationResults, outputPath = 'evaluation_report.html') {
    const html = this.createHTMLReport(evaluationResults);
    await fs.writeFile(outputPath, html);
    console.log(`HTML report generated: ${outputPath}`);
    return outputPath;
  }

  /**
   * Generate markdown report
   */
  async generateMarkdownReport(evaluationResults, outputPath = 'evaluation_report.md') {
    const markdown = this.createMarkdownReport(evaluationResults);
    await fs.writeFile(outputPath, markdown);
    console.log(`Markdown report generated: ${outputPath}`);
    return outputPath;
  }

  /**
   * Generate JSON summary report
   */
  async generateJSONSummary(evaluationResults, outputPath = 'evaluation_summary.json') {
    const summary = this.createSummaryReport(evaluationResults);
    await fs.writeJSON(outputPath, summary, { spaces: 2 });
    console.log(`JSON summary generated: ${outputPath}`);
    return outputPath;
  }

  /**
   * Create HTML report
   */
  createHTMLReport(results) {
    const { metrics, detailed_results, performance, config, timestamp } = results;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Model Evaluation Report</title>
    <style>
        ${this.getCSS()}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>🤖 Multimodal Recommender Model Evaluation</h1>
            <div class="meta-info">
                <p><strong>Generated:</strong> ${new Date(timestamp).toLocaleString()}</p>
                <p><strong>Configuration:</strong> ${config.name || 'Custom'}</p>
            </div>
        </header>

        <!-- Executive Summary -->
        <section class="section">
            <h2>📊 Executive Summary</h2>
            ${this.generateExecutiveSummaryHTML(metrics)}
        </section>

        <!-- Classification Metrics -->
        <section class="section">
            <h2>🎯 Classification Performance</h2>
            ${this.generateClassificationTableHTML(metrics.classification)}
        </section>

        <!-- Ranking Metrics -->
        <section class="section">
            <h2>📈 Ranking Performance</h2>
            ${this.generateRankingTableHTML(metrics.ranking)}
        </section>

        <!-- Recommendation Quality -->
        <section class="section">
            <h2>⭐ Recommendation Quality</h2>
            ${this.generateRecommendationQualityHTML(metrics.recommendation_quality)}
        </section>

        <!-- Diversity Analysis -->
        <section class="section">
            <h2>🌈 Diversity & Coverage</h2>
            ${this.generateDiversityTableHTML(metrics.diversity)}
        </section>

        <!-- Performance Metrics -->
        <section class="section">
            <h2>⚡ Performance Metrics</h2>
            ${this.generatePerformanceHTML(performance)}
        </section>

        <!-- Category Analysis -->
        <section class="section">
            <h2>🔍 Category-wise Analysis</h2>
            ${this.generateCategoryAnalysisHTML(detailed_results.category_analysis)}
        </section>

        <!-- Error Analysis -->
        <section class="section">
            <h2>🚨 Error Analysis</h2>
            ${this.generateErrorAnalysisHTML(detailed_results.error_analysis)}
        </section>

        <!-- Recommendations -->
        <section class="section">
            <h2>💡 Recommendations</h2>
            ${this.generateRecommendationsHTML(results)}
        </section>
    </div>

    <script>
        ${this.getJavaScript()}
    </script>
</body>
</html>`;
  }

  /**
   * Create Markdown report
   */
  createMarkdownReport(results) {
    const { metrics, detailed_results, performance, config, timestamp } = results;
    
    let markdown = `# 🤖 Multimodal Recommender Model Evaluation

**Generated:** ${new Date(timestamp).toLocaleString()}  
**Configuration:** ${config.name || 'Custom'}

---

## 📊 Executive Summary

${this.generateExecutiveSummaryMarkdown(metrics)}

## 🎯 Classification Performance

${this.generateClassificationTableMarkdown(metrics.classification)}

## 📈 Ranking Performance

${this.generateRankingTableMarkdown(metrics.ranking)}

## ⭐ Recommendation Quality

${this.generateRecommendationQualityMarkdown(metrics.recommendation_quality)}

## 🌈 Diversity & Coverage

${this.generateDiversityTableMarkdown(metrics.diversity)}

## ⚡ Performance Metrics

${this.generatePerformanceMarkdown(performance)}

## 🔍 Category-wise Analysis

${this.generateCategoryAnalysisMarkdown(detailed_results.category_analysis)}

## 🚨 Error Analysis

${this.generateErrorAnalysisMarkdown(detailed_results.error_analysis)}

## 💡 Recommendations

${this.generateRecommendationsMarkdown(results)}

---
*Report generated by Multimodal Recommender Evaluator*`;

    return markdown;
  }

  /**
   * Create summary report
   */
  createSummaryReport(results) {
    const { metrics, performance, config } = results;
    
    const summary = {
      timestamp: new Date().toISOString(),
      config_name: config.name || 'Custom',
      overall_performance: {},
      key_metrics: {},
      performance_summary: {
        avg_prediction_time_ms: performance.avg_prediction_time_ms,
        throughput_per_second: performance.throughput_per_second,
        memory_usage_mb: performance.memory_usage_mb.heapUsed
      },
      recommendations: this.generateRecommendationsList(results)
    };

    // Extract key metrics for each field
    for (const field of config.target_fields) {
      if (metrics.classification[field] && metrics.ranking[field]) {
        summary.key_metrics[field] = {
          accuracy_k5: metrics.classification[field].k5?.accuracy || 0,
          f1_k5: metrics.classification[field].k5?.macro_f1 || 0,
          ndcg_k5: metrics.ranking[field].k5?.ndcg || 0,
          mrr_k5: metrics.ranking[field].k5?.mrr || 0
        };
      }
    }

    // Overall performance score (weighted average of primary fields)
    const primaryFields = ['articletype', 'gender', 'mastercategory'];
    let totalScore = 0;
    let validFields = 0;

    for (const field of primaryFields) {
      if (summary.key_metrics[field]) {
        const fieldScore = (
          summary.key_metrics[field].accuracy_k5 * 0.4 +
          summary.key_metrics[field].f1_k5 * 0.3 +
          summary.key_metrics[field].ndcg_k5 * 0.3
        );
        totalScore += fieldScore;
        validFields++;
      }
    }

    summary.overall_performance = {
      score: validFields > 0 ? totalScore / validFields : 0,
      grade: this.getPerformanceGrade(totalScore / validFields),
      interpretation: this.interpretOverallScore(totalScore / validFields)
    };

    return summary;
  }

  // HTML Generation Methods
  generateExecutiveSummaryHTML(metrics) {
    const primaryFields = ['articletype', 'gender', 'mastercategory'];
    let summaryCards = '';
    
    for (const field of primaryFields) {
      if (metrics.classification[field] && metrics.ranking[field]) {
        const accuracy = (metrics.classification[field].k5?.accuracy || 0) * 100;
        const ndcg = metrics.ranking[field].k5?.ndcg || 0;
        
        summaryCards += `
          <div class="summary-card">
            <h3>${field.toUpperCase()}</h3>
            <div class="metric">
              <span class="metric-value">${accuracy.toFixed(1)}%</span>
              <span class="metric-label">Accuracy@5</span>
            </div>
            <div class="metric">
              <span class="metric-value">${ndcg.toFixed(3)}</span>
              <span class="metric-label">NDCG@5</span>
            </div>
          </div>`;
      }
    }
    
    return `<div class="summary-cards">${summaryCards}</div>`;
  }

  generateClassificationTableHTML(classificationMetrics) {
    let html = '<div class="table-container">';
    
    for (const [field, metrics] of Object.entries(classificationMetrics)) {
      html += `<h3>${field.toUpperCase()}</h3>`;
      html += `<table class="metrics-table">
        <thead>
          <tr>
            <th>k</th>
            <th>Accuracy</th>
            <th>Precision</th>
            <th>Recall</th>
            <th>F1 Score</th>
          </tr>
        </thead>
        <tbody>`;
      
      for (const [k, values] of Object.entries(metrics)) {
        const kValue = k.replace('k', '');
        html += `
          <tr>
            <td>${kValue}</td>
            <td>${(values.accuracy * 100).toFixed(2)}%</td>
            <td>${(values.macro_precision * 100).toFixed(2)}%</td>
            <td>${(values.macro_recall * 100).toFixed(2)}%</td>
            <td>${(values.macro_f1 * 100).toFixed(2)}%</td>
          </tr>`;
      }
      
      html += '</tbody></table>';
    }
    
    html += '</div>';
    return html;
  }

  generateRankingTableHTML(rankingMetrics) {
    let html = '<div class="table-container">';
    
    for (const [field, metrics] of Object.entries(rankingMetrics)) {
      html += `<h3>${field.toUpperCase()}</h3>`;
      html += `<table class="metrics-table">
        <thead>
          <tr>
            <th>k</th>
            <th>NDCG</th>
            <th>MRR</th>
            <th>MAP</th>
          </tr>
        </thead>
        <tbody>`;
      
      for (const [k, values] of Object.entries(metrics)) {
        const kValue = k.replace('k', '');
        html += `
          <tr>
            <td>${kValue}</td>
            <td>${values.ndcg.toFixed(4)}</td>
            <td>${values.mrr.toFixed(4)}</td>
            <td>${values.map.toFixed(4)}</td>
          </tr>`;
      }
      
      html += '</tbody></table>';
    }
    
    html += '</div>';
    return html;
  }

  generateRecommendationQualityHTML(qualityMetrics) {
    const { similarity_distribution, recommendation_confidence } = qualityMetrics;
    
    return `
      <div class="quality-metrics">
        <div class="quality-card">
          <h4>Similarity Distribution</h4>
          <p><strong>Mean:</strong> ${similarity_distribution.mean.toFixed(4)}</p>
          <p><strong>Std:</strong> ${similarity_distribution.std.toFixed(4)}</p>
          <p><strong>Range:</strong> ${similarity_distribution.min.toFixed(4)} - ${similarity_distribution.max.toFixed(4)}</p>
        </div>
        <div class="quality-card">
          <h4>Recommendation Confidence</h4>
          <p><strong>Mean:</strong> ${recommendation_confidence.mean.toFixed(4)}</p>
          <p><strong>Std:</strong> ${recommendation_confidence.std.toFixed(4)}</p>
        </div>
      </div>`;
  }

  generateDiversityTableHTML(diversityMetrics) {
    let html = '<table class="metrics-table"><thead><tr><th>Field</th><th>Coverage</th><th>Avg Diversity</th></tr></thead><tbody>';
    
    for (const [field, metrics] of Object.entries(diversityMetrics)) {
      html += `
        <tr>
          <td>${field.toUpperCase()}</td>
          <td>${(metrics.catalog_coverage * 100).toFixed(1)}%</td>
          <td>${(metrics.avg_intra_list_diversity * 100).toFixed(1)}%</td>
        </tr>`;
    }
    
    html += '</tbody></table>';
    return html;
  }

  generatePerformanceHTML(performance) {
    return `
      <div class="performance-metrics">
        <div class="perf-card">
          <span class="perf-value">${performance.avg_prediction_time_ms.toFixed(2)}ms</span>
          <span class="perf-label">Avg Prediction Time</span>
        </div>
        <div class="perf-card">
          <span class="perf-value">${performance.throughput_per_second.toFixed(1)}</span>
          <span class="perf-label">Predictions/sec</span>
        </div>
        <div class="perf-card">
          <span class="perf-value">${performance.memory_usage_mb.heapUsed}MB</span>
          <span class="perf-label">Memory Usage</span>
        </div>
      </div>`;
  }

  generateCategoryAnalysisHTML(categoryAnalysis) {
    let html = '';
    
    for (const [field, categories] of Object.entries(categoryAnalysis)) {
      html += `<h3>${field.toUpperCase()}</h3>`;
      html += '<table class="metrics-table"><thead><tr><th>Category</th><th>Samples</th><th>Accuracy</th><th>Avg Similarity</th></tr></thead><tbody>';
      
      const sortedCategories = Object.entries(categories)
        .sort(([,a], [,b]) => b.accuracy - a.accuracy)
        .slice(0, this.config.max_categories_in_tables);
      
      for (const [category, stats] of sortedCategories) {
        html += `
          <tr>
            <td>${category}</td>
            <td>${stats.sample_count}</td>
            <td>${(stats.accuracy * 100).toFixed(1)}%</td>
            <td>${stats.avg_similarity.toFixed(3)}</td>
          </tr>`;
      }
      
      html += '</tbody></table><br>';
    }
    
    return html;
  }

  generateErrorAnalysisHTML(errorAnalysis) {
    let html = '';
    
    for (const [field, errors] of Object.entries(errorAnalysis.common_errors)) {
      if (errors.length > 0) {
        html += `<h4>${field.toUpperCase()} - Common Error Patterns</h4>`;
        html += '<table class="metrics-table"><thead><tr><th>Error Pattern</th><th>Count</th></tr></thead><tbody>';
        
        for (const error of errors.slice(0, 10)) {
          html += `<tr><td>${error.error}</td><td>${error.count}</td></tr>`;
        }
        
        html += '</tbody></table><br>';
      }
    }
    
    return html || '<p>No significant error patterns detected.</p>';
  }

  generateRecommendationsHTML(results) {
    const recommendations = this.generateRecommendationsList(results);
    let html = '<div class="recommendations">';
    
    for (const rec of recommendations) {
      const iconMap = {
        'improve': '🔧',
        'optimize': '⚡',
        'investigate': '🔍',
        'consider': '💡'
      };
      
      html += `
        <div class="recommendation ${rec.priority}">
          <span class="rec-icon">${iconMap[rec.type] || '💡'}</span>
          <div class="rec-content">
            <h4>${rec.title}</h4>
            <p>${rec.description}</p>
            ${rec.action ? `<p class="rec-action"><strong>Action:</strong> ${rec.action}</p>` : ''}
          </div>
        </div>`;
    }
    
    html += '</div>';
    return html;
  }

  // Markdown Generation Methods
  generateExecutiveSummaryMarkdown(metrics) {
    const primaryFields = ['articletype', 'gender', 'mastercategory'];
    let summary = '';
    
    for (const field of primaryFields) {
      if (metrics.classification[field] && metrics.ranking[field]) {
        const accuracy = (metrics.classification[field].k5?.accuracy || 0) * 100;
        const ndcg = metrics.ranking[field].k5?.ndcg || 0;
        
        summary += `- **${field.toUpperCase()}:** Accuracy@5: ${accuracy.toFixed(1)}%, NDCG@5: ${ndcg.toFixed(3)}\n`;
      }
    }
    
    return summary;
  }

  generateClassificationTableMarkdown(classificationMetrics) {
    let markdown = '';
    
    for (const [field, metrics] of Object.entries(classificationMetrics)) {
      markdown += `\n### ${field.toUpperCase()}\n\n`;
      markdown += '| k | Accuracy | Precision | Recall | F1 Score |\n';
      markdown += '|---|----------|-----------|--------|----------|\n';
      
      for (const [k, values] of Object.entries(metrics)) {
        const kValue = k.replace('k', '');
        markdown += `| ${kValue} | ${(values.accuracy * 100).toFixed(2)}% | ${(values.macro_precision * 100).toFixed(2)}% | ${(values.macro_recall * 100).toFixed(2)}% | ${(values.macro_f1 * 100).toFixed(2)}% |\n`;
      }
      
      markdown += '\n';
    }
    
    return markdown;
  }

  generateRankingTableMarkdown(rankingMetrics) {
    let markdown = '';
    
    for (const [field, metrics] of Object.entries(rankingMetrics)) {
      markdown += `\n### ${field.toUpperCase()}\n\n`;
      markdown += '| k | NDCG | MRR | MAP |\n';
      markdown += '|---|------|-----|-----|\n';
      
      for (const [k, values] of Object.entries(metrics)) {
        const kValue = k.replace('k', '');
        markdown += `| ${kValue} | ${values.ndcg.toFixed(4)} | ${values.mrr.toFixed(4)} | ${values.map.toFixed(4)} |\n`;
      }
      
      markdown += '\n';
    }
    
    return markdown;
  }

  generateRecommendationQualityMarkdown(qualityMetrics) {
    const { similarity_distribution, recommendation_confidence } = qualityMetrics;
    
    return `
**Similarity Distribution:**
- Mean: ${similarity_distribution.mean.toFixed(4)}
- Std: ${similarity_distribution.std.toFixed(4)}
- Range: ${similarity_distribution.min.toFixed(4)} - ${similarity_distribution.max.toFixed(4)}

**Recommendation Confidence:**
- Mean: ${recommendation_confidence.mean.toFixed(4)}
- Std: ${recommendation_confidence.std.toFixed(4)}
`;
  }

  generateDiversityTableMarkdown(diversityMetrics) {
    let markdown = '\n| Field | Coverage | Avg Diversity |\n|-------|----------|---------------|\n';
    
    for (const [field, metrics] of Object.entries(diversityMetrics)) {
      markdown += `| ${field.toUpperCase()} | ${(metrics.catalog_coverage * 100).toFixed(1)}% | ${(metrics.avg_intra_list_diversity * 100).toFixed(1)}% |\n`;
    }
    
    return markdown;
  }

  generatePerformanceMarkdown(performance) {
    return `
- **Average Prediction Time:** ${performance.avg_prediction_time_ms.toFixed(2)}ms
- **Throughput:** ${performance.throughput_per_second.toFixed(1)} predictions/sec
- **Memory Usage:** ${performance.memory_usage_mb.heapUsed}MB
`;
  }

  generateCategoryAnalysisMarkdown(categoryAnalysis) {
    let markdown = '';
    
    for (const [field, categories] of Object.entries(categoryAnalysis)) {
      markdown += `\n### ${field.toUpperCase()}\n\n`;
      markdown += '| Category | Samples | Accuracy | Avg Similarity |\n|----------|---------|----------|----------------|\n';
      
      const sortedCategories = Object.entries(categories)
        .sort(([,a], [,b]) => b.accuracy - a.accuracy)
        .slice(0, this.config.max_categories_in_tables);
      
      for (const [category, stats] of sortedCategories) {
        markdown += `| ${category} | ${stats.sample_count} | ${(stats.accuracy * 100).toFixed(1)}% | ${stats.avg_similarity.toFixed(3)} |\n`;
      }
      
      markdown += '\n';
    }
    
    return markdown;
  }

  generateErrorAnalysisMarkdown(errorAnalysis) {
    let markdown = '';
    
    for (const [field, errors] of Object.entries(errorAnalysis.common_errors)) {
      if (errors.length > 0) {
        markdown += `\n### ${field.toUpperCase()} - Common Error Patterns\n\n`;
        markdown += '| Error Pattern | Count |\n|---------------|-------|\n';
        
        for (const error of errors.slice(0, 10)) {
          markdown += `| ${error.error} | ${error.count} |\n`;
        }
        
        markdown += '\n';
      }
    }
    
    return markdown || '\nNo significant error patterns detected.\n';
  }

  generateRecommendationsMarkdown(results) {
    const recommendations = this.generateRecommendationsList(results);
    let markdown = '';
    
    for (const rec of recommendations) {
      const iconMap = {
        'improve': '🔧',
        'optimize': '⚡',
        'investigate': '🔍',
        'consider': '💡'
      };
      
      markdown += `\n${iconMap[rec.type] || '💡'} **${rec.title}**\n\n${rec.description}\n`;
      
      if (rec.action) {
        markdown += `\n*Action:* ${rec.action}\n`;
      }
      
      markdown += '\n---\n';
    }
    
    return markdown;
  }

  // Recommendation Generation
  generateRecommendationsList(results) {
    const recommendations = [];
    const { metrics, performance, detailed_results } = results;

    // Performance recommendations
    if (performance.avg_prediction_time_ms > 100) {
      recommendations.push({
        type: 'optimize',
        priority: 'high',
        title: 'Optimize Prediction Speed',
        description: `Average prediction time of ${performance.avg_prediction_time_ms.toFixed(2)}ms is above optimal threshold.`,
        action: 'Consider optimizing similarity computation or using approximate nearest neighbor methods.'
      });
    }

    // Accuracy recommendations
    for (const [field, classMetrics] of Object.entries(metrics.classification)) {
      const accuracy = classMetrics.k5?.accuracy || 0;
      
      if (accuracy < 0.6) {
        recommendations.push({
          type: 'improve',
          priority: 'high',
          title: `Improve ${field} Classification`,
          description: `Accuracy of ${(accuracy * 100).toFixed(1)}% for ${field} is below acceptable threshold.`,
          action: 'Consider collecting more training data or using domain-specific features for this category.'
        });
      }
    }

    // Diversity recommendations
    for (const [field, divMetrics] of Object.entries(metrics.diversity)) {
      if (divMetrics.catalog_coverage < 0.5) {
        recommendations.push({
          type: 'investigate',
          priority: 'medium',
          title: `Low Coverage for ${field}`,
          description: `Only ${(divMetrics.catalog_coverage * 100).toFixed(1)}% of available ${field} categories are being recommended.`,
          action: 'Investigate if model is biased towards popular categories and consider diversity-enhancing techniques.'
        });
      }
    }

    // Error pattern recommendations
    if (detailed_results.error_analysis) {
      for (const [field, errors] of Object.entries(detailed_results.error_analysis.common_errors)) {
        if (errors.length > 0) {
          const topError = errors[0];
          recommendations.push({
            type: 'investigate',
            priority: 'medium',
            title: `Address ${field} Confusion Pattern`,
            description: `Most common error: ${topError.error} (${topError.count} occurrences)`,
            action: 'Review these specific cases to understand if additional features or training data could help distinguish these categories.'
          });
        }
      }
    }

    // General recommendations
    recommendations.push({
      type: 'consider',
      priority: 'low',
      title: 'Monitor Performance Over Time',
      description: 'Implement regular evaluation to track model performance degradation.',
      action: 'Set up automated evaluation pipeline to monitor key metrics and alert on significant changes.'
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Utility methods
  getPerformanceGrade(score) {
    if (score >= 0.9) return 'A';
    if (score >= 0.8) return 'B';
    if (score >= 0.7) return 'C';
    if (score >= 0.6) return 'D';
    return 'F';
  }

  interpretOverallScore(score) {
    if (score >= 0.9) return 'Excellent performance across all metrics';
    if (score >= 0.8) return 'Good performance with room for minor improvements';
    if (score >= 0.7) return 'Acceptable performance with some areas needing attention';
    if (score >= 0.6) return 'Below average performance, significant improvements needed';
    return 'Poor performance, major improvements required';
  }

  // CSS Styles
  getCSS() {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f8f9fa; }
      .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; text-align: center; }
      .header h1 { margin-bottom: 10px; font-size: 2.5rem; }
      .meta-info { opacity: 0.9; }
      .section { background: white; padding: 25px; margin: 20px 0; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
      .section h2 { margin-bottom: 20px; color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
      .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
      .summary-card { background: linear-gradient(135deg, #74b9ff, #0984e3); color: white; padding: 20px; border-radius: 10px; text-align: center; }
      .summary-card h3 { margin-bottom: 15px; opacity: 0.9; }
      .metric { margin: 10px 0; }
      .metric-value { display: block; font-size: 2rem; font-weight: bold; }
      .metric-label { opacity: 0.8; font-size: 0.9rem; }
      .metrics-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      .metrics-table th, .metrics-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
      .metrics-table th { background: #f8f9fa; font-weight: 600; color: #2c3e50; }
      .metrics-table tr:hover { background: #f1f3f4; }
      .quality-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
      .quality-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #e74c3c; }
      .quality-card h4 { margin-bottom: 15px; color: #2c3e50; }
      .performance-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
      .perf-card { background: linear-gradient(135deg, #00b894, #00a085); color: white; padding: 20px; border-radius: 10px; text-align: center; }
      .perf-value { display: block; font-size: 2rem; font-weight: bold; margin-bottom: 5px; }
      .perf-label { font-size: 0.9rem; opacity: 0.8; }
      .recommendations { }
      .recommendation { display: flex; align-items: flex-start; padding: 20px; margin: 15px 0; border-radius: 10px; border-left: 4px solid #3498db; }
      .recommendation.high { background: #ffeaa7; border-left-color: #e17055; }
      .recommendation.medium { background: #81ecec; border-left-color: #00cec9; }
      .recommendation.low { background: #a29bfe; border-left-color: #6c5ce7; }
      .rec-icon { font-size: 1.5rem; margin-right: 15px; }
      .rec-content h4 { margin-bottom: 10px; color: #2c3e50; }
      .rec-action { margin-top: 10px; font-style: italic; color: #636e72; }
      .table-container { overflow-x: auto; }
      @media (max-width: 768px) {
        .container { padding: 10px; }
        .header h1 { font-size: 2rem; }
        .section { padding: 20px; }
        .summary-cards, .quality-metrics, .performance-metrics { grid-template-columns: 1fr; }
      }
    `;
  }

  // JavaScript for interactivity
  getJavaScript() {
    return `
      document.addEventListener('DOMContentLoaded', function() {
        // Add click-to-expand functionality for large tables
        const tables = document.querySelectorAll('.metrics-table');
        tables.forEach(table => {
          if (table.rows.length > 10) {
            const showMore = document.createElement('button');
            showMore.textContent = 'Show More';
            showMore.style.cssText = 'margin: 10px 0; padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;';
            
            // Hide extra rows initially
            for (let i = 10; i < table.rows.length; i++) {
              table.rows[i].style.display = 'none';
            }
            
            showMore.onclick = function() {
              const hidden = table.querySelectorAll('tr[style*="display: none"]');
              if (hidden.length > 0) {
                hidden.forEach(row => row.style.display = '');
                showMore.textContent = 'Show Less';
              } else {
                for (let i = 10; i < table.rows.length; i++) {
                  table.rows[i].style.display = 'none';
                }
                showMore.textContent = 'Show More';
              }
            };
            
            table.parentNode.insertBefore(showMore, table.nextSibling);
          }
        });

        // Add smooth scrolling to section links
        const sections = document.querySelectorAll('.section');
        sections.forEach((section, index) => {
          section.style.opacity = '0';
          section.style.transform = 'translateY(20px)';
          section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
          
          setTimeout(() => {
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
          }, index * 100);
        });
      });
    `;
  }
}

// Export default instance
export default new ReportGenerator();