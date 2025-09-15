// visualizer.js - Visualization utilities for evaluation results

import fs from 'fs-extra';
import path from 'path';

/**
 * Data visualization utilities for evaluation results
 * Exports data in formats suitable for plotting libraries and creates simple ASCII charts
 */
export class EvaluationVisualizer {
  constructor(config = {}) {
    this.config = {
      chart_width: 60,
      chart_height: 15,
      export_formats: ['json', 'csv', 'ascii'],
      include_ascii_charts: true,
      decimal_precision: 3,
      ...config
    };
  }

  /**
   * Export evaluation results for external visualization tools
   */
  async exportForVisualization(evaluationResults, outputDir = 'visualization_data') {
    await fs.ensureDir(outputDir);
    
    const exports = {};
    
    // 1. Classification metrics data
    exports.classification = await this.exportClassificationMetrics(
      evaluationResults.metrics.classification,
      path.join(outputDir, 'classification_metrics')
    );
    
    // 2. Ranking metrics data
    exports.ranking = await this.exportRankingMetrics(
      evaluationResults.metrics.ranking,
      path.join(outputDir, 'ranking_metrics')
    );
    
    // 3. Performance over time data
    exports.performance = await this.exportPerformanceMetrics(
      evaluationResults.performance,
      path.join(outputDir, 'performance_metrics')
    );
    
    // 4. Category analysis data
    exports.categories = await this.exportCategoryAnalysis(
      evaluationResults.detailed_results.category_analysis,
      path.join(outputDir, 'category_analysis')
    );
    
    // 5. Error analysis data
    exports.errors = await this.exportErrorAnalysis(
      evaluationResults.detailed_results.error_analysis,
      path.join(outputDir, 'error_analysis')
    );
    
    // 6. Diversity metrics data
    exports.diversity = await this.exportDiversityMetrics(
      evaluationResults.metrics.diversity,
      path.join(outputDir, 'diversity_metrics')
    );
    
    // 7. Create visualization index
    await this.createVisualizationIndex(exports, outputDir);
    
    console.log(`Visualization data exported to: ${outputDir}`);
    return exports;
  }

  /**
   * Export classification metrics in various formats
   */
  async exportClassificationMetrics(classificationMetrics, outputPath) {
    const data = {
      chart_data: [],
      table_data: [],
      comparison_data: {}
    };
    
    // Prepare data for line charts (metrics vs k)
    const fields = Object.keys(classificationMetrics);
    
    for (const field of fields) {
      const fieldData = classificationMetrics[field];
      const series = {
        field: field,
        accuracy: [],
        precision: [],
        recall: [],
        f1_score: []
      };
      
      for (const [kKey, metrics] of Object.entries(fieldData)) {
        const k = parseInt(kKey.replace('k', ''));
        series.accuracy.push({ x: k, y: metrics.accuracy });
        series.precision.push({ x: k, y: metrics.macro_precision });
        series.recall.push({ x: k, y: metrics.macro_recall });
        series.f1_score.push({ x: k, y: metrics.macro_f1 });
      }
      
      data.chart_data.push(series);
    }
    
    // Prepare data for comparison tables
    for (const field of fields) {
      const fieldMetrics = classificationMetrics[field];
      for (const [kKey, metrics] of Object.entries(fieldMetrics)) {
        data.table_data.push({
          field: field,
          k: parseInt(kKey.replace('k', '')),
          accuracy: metrics.accuracy,
          precision: metrics.macro_precision,
          recall: metrics.macro_recall,
          f1_score: metrics.macro_f1
        });
      }
    }
    
    // Comparison across fields at k=5
    data.comparison_data = fields.map(field => {
      const k5Data = classificationMetrics[field].k5;
      return {
        field: field,
        accuracy: k5Data?.accuracy || 0,
        precision: k5Data?.macro_precision || 0,
        recall: k5Data?.macro_recall || 0,
        f1_score: k5Data?.macro_f1 || 0
      };
    });
    
    // Export data
    const exports = {};
    
    if (this.config.export_formats.includes('json')) {
      exports.json = `${outputPath}.json`;
      await fs.writeJSON(exports.json, data, { spaces: 2 });
    }
    
    if (this.config.export_formats.includes('csv')) {
      exports.csv = `${outputPath}.csv`;
      await this.exportToCSV(data.table_data, exports.csv);
    }
    
    if (this.config.export_formats.includes('ascii') && this.config.include_ascii_charts) {
      exports.ascii = `${outputPath}_charts.txt`;
      const asciiCharts = this.generateClassificationASCIICharts(data);
      await fs.writeFile(exports.ascii, asciiCharts);
    }
    
    return exports;
  }

  /**
   * Export ranking metrics in various formats
   */
  async exportRankingMetrics(rankingMetrics, outputPath) {
    const data = {
      chart_data: [],
      table_data: [],
      heatmap_data: []
    };
    
    const fields = Object.keys(rankingMetrics);
    
    // Prepare line chart data
    for (const field of fields) {
      const fieldData = rankingMetrics[field];
      const series = {
        field: field,
        ndcg: [],
        mrr: [],
        map: []
      };
      
      for (const [kKey, metrics] of Object.entries(fieldData)) {
        const k = parseInt(kKey.replace('k', ''));
        series.ndcg.push({ x: k, y: metrics.ndcg });
        series.mrr.push({ x: k, y: metrics.mrr });
        series.map.push({ x: k, y: metrics.map });
      }
      
      data.chart_data.push(series);
    }
    
    // Prepare table data
    for (const field of fields) {
      const fieldMetrics = rankingMetrics[field];
      for (const [kKey, metrics] of Object.entries(fieldMetrics)) {
        data.table_data.push({
          field: field,
          k: parseInt(kKey.replace('k', '')),
          ndcg: metrics.ndcg,
          mrr: metrics.mrr,
          map: metrics.map
        });
      }
    }
    
    // Prepare heatmap data (fields vs k values)
    const kValues = [...new Set(data.table_data.map(d => d.k))].sort((a, b) => a - b);
    data.heatmap_data = {
      fields: fields,
      k_values: kValues,
      ndcg_matrix: this.createMatrix(fields, kValues, data.table_data, 'ndcg'),
      mrr_matrix: this.createMatrix(fields, kValues, data.table_data, 'mrr'),
      map_matrix: this.createMatrix(fields, kValues, data.table_data, 'map')
    };
    
    const exports = {};
    
    if (this.config.export_formats.includes('json')) {
      exports.json = `${outputPath}.json`;
      await fs.writeJSON(exports.json, data, { spaces: 2 });
    }
    
    if (this.config.export_formats.includes('csv')) {
      exports.csv = `${outputPath}.csv`;
      await this.exportToCSV(data.table_data, exports.csv);
    }
    
    if (this.config.export_formats.includes('ascii') && this.config.include_ascii_charts) {
      exports.ascii = `${outputPath}_charts.txt`;
      const asciiCharts = this.generateRankingASCIICharts(data);
      await fs.writeFile(exports.ascii, asciiCharts);
    }
    
    return exports;
  }

  /**
   * Export performance metrics
   */
  async exportPerformanceMetrics(performanceMetrics, outputPath) {
    const data = {
      summary: performanceMetrics,
      gauge_data: [
        {
          name: 'Prediction Time',
          value: performanceMetrics.avg_prediction_time_ms,
          max: 100,
          unit: 'ms',
          thresholds: { good: 10, warning: 50, critical: 100 }
        },
        {
          name: 'Throughput',
          value: performanceMetrics.throughput_per_second,
          max: 1000,
          unit: 'req/sec',
          thresholds: { good: 100, warning: 50, critical: 10 }
        },
        {
          name: 'Memory Usage',
          value: performanceMetrics.memory_usage_mb.heapUsed,
          max: 1000,
          unit: 'MB',
          thresholds: { good: 100, warning: 500, critical: 1000 }
        }
      ]
    };
    
    const exports = {};
    
    if (this.config.export_formats.includes('json')) {
      exports.json = `${outputPath}.json`;
      await fs.writeJSON(exports.json, data, { spaces: 2 });
    }
    
    if (this.config.export_formats.includes('ascii') && this.config.include_ascii_charts) {
      exports.ascii = `${outputPath}_gauges.txt`;
      const asciiGauges = this.generatePerformanceASCIIGauges(data.gauge_data);
      await fs.writeFile(exports.ascii, asciiGauges);
    }
    
    return exports;
  }

  /**
   * Export category analysis data
   */
  async exportCategoryAnalysis(categoryAnalysis, outputPath) {
    const data = {
      scatter_data: [],
      bar_data: [],
      bubble_data: []
    };
    
    for (const [field, categories] of Object.entries(categoryAnalysis)) {
      for (const [category, stats] of Object.entries(categories)) {
        // Scatter plot data (accuracy vs avg_similarity)
        data.scatter_data.push({
          field: field,
          category: category,
          x: stats.avg_similarity,
          y: stats.accuracy,
          size: stats.sample_count
        });
        
        // Bar chart data (accuracy by category)
        data.bar_data.push({
          field: field,
          category: category,
          accuracy: stats.accuracy,
          sample_count: stats.sample_count
        });
        
        // Bubble chart data (3D visualization)
        data.bubble_data.push({
          field: field,
          category: category,
          x: stats.avg_similarity,
          y: stats.accuracy,
          z: stats.avg_confidence,
          size: stats.sample_count
        });
      }
    }
    
    const exports = {};
    
    if (this.config.export_formats.includes('json')) {
      exports.json = `${outputPath}.json`;
      await fs.writeJSON(exports.json, data, { spaces: 2 });
    }
    
    if (this.config.export_formats.includes('csv')) {
      exports.csv = `${outputPath}.csv`;
      await this.exportToCSV(data.scatter_data, exports.csv);
    }
    
    return exports;
  }

  /**
   * Export error analysis data
   */
  async exportErrorAnalysis(errorAnalysis, outputPath) {
    const data = {
      error_patterns: [],
      confusion_data: []
    };
    
    if (errorAnalysis.common_errors) {
      for (const [field, errors] of Object.entries(errorAnalysis.common_errors)) {
        for (const error of errors) {
          const [actual, predicted] = error.error.split(' -> ');
          data.error_patterns.push({
            field: field,
            actual: actual,
            predicted: predicted,
            count: error.count,
            error_type: 'classification'
          });
        }
      }
    }
    
    // Process confusion matrices if available
    if (errorAnalysis.confusion_matrices) {
      for (const [field, confusionData] of Object.entries(errorAnalysis.confusion_matrices)) {
        for (const [key, count] of confusionData.matrix.entries()) {
          const [actual, predicted] = key.split('_');
          data.confusion_data.push({
            field: field,
            actual: actual,
            predicted: predicted,
            count: count
          });
        }
      }
    }
    
    const exports = {};
    
    if (this.config.export_formats.includes('json')) {
      exports.json = `${outputPath}.json`;
      await fs.writeJSON(exports.json, data, { spaces: 2 });
    }
    
    if (this.config.export_formats.includes('csv')) {
      exports.error_patterns_csv = `${outputPath}_patterns.csv`;
      await this.exportToCSV(data.error_patterns, exports.error_patterns_csv);
      
      exports.confusion_csv = `${outputPath}_confusion.csv`;
      await this.exportToCSV(data.confusion_data, exports.confusion_csv);
    }
    
    return exports;
  }

  /**
   * Export diversity metrics
   */
  async exportDiversityMetrics(diversityMetrics, outputPath) {
    const data = {
      radar_data: [],
      bar_data: []
    };
    
    for (const [field, metrics] of Object.entries(diversityMetrics)) {
      data.radar_data.push({
        field: field,
        coverage: metrics.catalog_coverage,
        diversity: metrics.avg_intra_list_diversity,
        uniqueness: metrics.unique_recommendations / 100 // Normalize
      });
      
      data.bar_data.push({
        field: field,
        catalog_coverage: metrics.catalog_coverage,
        avg_intra_list_diversity: metrics.avg_intra_list_diversity
      });
    }
    
    const exports = {};
    
    if (this.config.export_formats.includes('json')) {
      exports.json = `${outputPath}.json`;
      await fs.writeJSON(exports.json, data, { spaces: 2 });
    }
    
    if (this.config.export_formats.includes('csv')) {
      exports.csv = `${outputPath}.csv`;
      await this.exportToCSV(data.bar_data, exports.csv);
    }
    
    return exports;
  }

  /**
   * Create visualization index with recommendations for plotting
   */
  async createVisualizationIndex(exports, outputDir) {
    const index = {
      description: "Evaluation Results Visualization Data",
      generated: new Date().toISOString(),
      recommended_charts: {
        classification: [
          {
            type: "line",
            title: "Classification Accuracy vs K",
            data_file: "classification_metrics.json",
            description: "Shows how accuracy changes with different k values for each field",
            x_axis: "k",
            y_axis: "accuracy",
            series: "field"
          },
          {
            type: "bar",
            title: "Classification Metrics Comparison",
            data_file: "classification_metrics.json",
            description: "Compare precision, recall, and F1-score across fields",
            x_axis: "field",
            y_axis: "metric_value",
            series: "metric_type"
          }
        ],
        ranking: [
          {
            type: "heatmap",
            title: "NDCG Heatmap",
            data_file: "ranking_metrics.json",
            description: "NDCG scores across fields and k values",
            x_axis: "k_values",
            y_axis: "fields",
            values: "ndcg_matrix"
          },
          {
            type: "line",
            title: "Ranking Metrics vs K",
            data_file: "ranking_metrics.json",
            description: "How ranking metrics change with k",
            x_axis: "k",
            y_axis: "metric_value",
            series: "metric_type"
          }
        ],
        performance: [
          {
            type: "gauge",
            title: "Performance Dashboard",
            data_file: "performance_metrics.json",
            description: "Key performance indicators",
            metrics: ["prediction_time", "throughput", "memory_usage"]
          }
        ],
        categories: [
          {
            type: "scatter",
            title: "Accuracy vs Similarity by Category",
            data_file: "category_analysis.json",
            description: "Relationship between similarity scores and accuracy",
            x_axis: "avg_similarity",
            y_axis: "accuracy",
            size: "sample_count"
          },
          {
            type: "bubble",
            title: "Category Performance 3D View",
            data_file: "category_analysis.json",
            description: "3D view of category performance",
            x_axis: "avg_similarity",
            y_axis: "accuracy",
            z_axis: "avg_confidence",
            size: "sample_count"
          }
        ],
        errors: [
          {
            type: "sankey",
            title: "Error Flow Diagram",
            data_file: "error_analysis.json",
            description: "Common classification errors",
            source: "actual",
            target: "predicted",
            value: "count"
          }
        ],
        diversity: [
          {
            type: "radar",
            title: "Diversity Radar Chart",
            data_file: "diversity_metrics.json",
            description: "Multi-dimensional diversity analysis",
            axes: ["coverage", "diversity", "uniqueness"],
            series: "field"
          }
        ]
      },
      plotting_examples: {
        python_plotly: this.generatePlotlyExamples(),
        javascript_d3: this.generateD3Examples(),
        r_ggplot: this.generateGgplotExamples()
      },
      files: exports
    };
    
    const indexPath = path.join(outputDir, 'visualization_index.json');
    await fs.writeJSON(indexPath, index, { spaces: 2 });
    
    // Create README
    const readmePath = path.join(outputDir, 'README.md');
    const readme = this.generateVisualizationREADME(index);
    await fs.writeFile(readmePath, readme);
    
    return indexPath;
  }

  // ASCII Chart Generation Methods
  generateClassificationASCIICharts(data) {
    let output = "CLASSIFICATION METRICS - ASCII CHARTS\n";
    output += "=" * 50 + "\n\n";
    
    for (const fieldData of data.chart_data) {
      output += `Field: ${fieldData.field.toUpperCase()}\n`;
      output += "-".repeat(30) + "\n";
      
      // Accuracy chart
      output += "Accuracy vs K:\n";
      output += this.createASCIILineChart(
        fieldData.accuracy,
        "Accuracy",
        this.config.chart_width,
        this.config.chart_height
      );
      output += "\n";
      
      // F1 Score chart
      output += "F1-Score vs K:\n";
      output += this.createASCIILineChart(
        fieldData.f1_score,
        "F1-Score",
        this.config.chart_width,
        this.config.chart_height
      );
      output += "\n\n";
    }
    
    return output;
  }

  generateRankingASCIICharts(data) {
    let output = "RANKING METRICS - ASCII CHARTS\n";
    output += "=" * 50 + "\n\n";
    
    for (const fieldData of data.chart_data) {
      output += `Field: ${fieldData.field.toUpperCase()}\n`;
      output += "-".repeat(30) + "\n";
      
      // NDCG chart
      output += "NDCG vs K:\n";
      output += this.createASCIILineChart(
        fieldData.ndcg,
        "NDCG",
        this.config.chart_width,
        this.config.chart_height
      );
      output += "\n";
      
      // MRR chart
      output += "MRR vs K:\n";
      output += this.createASCIILineChart(
        fieldData.mrr,
        "MRR",
        this.config.chart_width,
        this.config.chart_height
      );
      output += "\n\n";
    }
    
    return output;
  }

  generatePerformanceASCIIGauges(gaugeData) {
    let output = "PERFORMANCE METRICS - ASCII GAUGES\n";
    output += "=" * 50 + "\n\n";
    
    for (const gauge of gaugeData) {
      output += `${gauge.name}:\n`;
      output += this.createASCIIGauge(
        gauge.value,
        gauge.max,
        gauge.unit,
        gauge.thresholds
      );
      output += "\n\n";
    }
    
    return output;
  }

  // ASCII Chart Utilities
  createASCIILineChart(data, title, width = 60, height = 15) {
    if (!data || data.length === 0) return "No data available\n";
    
    const values = data.map(d => d.y);
    const xValues = data.map(d => d.x);
    const minY = Math.min(...values);
    const maxY = Math.max(...values);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    
    let chart = "";
    
    // Create the chart grid
    for (let row = 0; row < height; row++) {
      let line = "";
      const currentY = maxY - (row / (height - 1)) * (maxY - minY);
      
      for (let col = 0; col < width; col++) {
        const currentX = minX + (col / (width - 1)) * (maxX - minX);
        
        // Find closest data point
        let closestPoint = null;
        let minDistance = Infinity;
        
        for (const point of data) {
          const distance = Math.abs(point.x - currentX);
          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
          }
        }
        
        // Check if this position should have a point
        if (closestPoint && Math.abs(closestPoint.y - currentY) < (maxY - minY) / height) {
          line += "*";
        } else if (col === 0) {
          // Y-axis
          line += "|";
        } else if (row === height - 1) {
          // X-axis
          line += "-";
        } else {
          line += " ";
        }
      }
      
      // Add Y-axis labels
      if (row === 0) {
        line += ` ${maxY.toFixed(this.config.decimal_precision)}`;
      } else if (row === height - 1) {
        line += ` ${minY.toFixed(this.config.decimal_precision)}`;
      }
      
      chart += line + "\n";
    }
    
    // Add X-axis labels
    chart += ` ${minX}`;
    chart += " ".repeat(width - minX.toString().length - maxX.toString().length);
    chart += `${maxX}\n`;
    
    return chart;
  }

  createASCIIGauge(value, max, unit, thresholds) {
    const width = 40;
    const percentage = Math.min(value / max, 1);
    const filled = Math.round(width * percentage);
    
    let gauge = "[";
    let color = "normal";
    
    if (thresholds) {
      if (value <= thresholds.good) color = "good";
      else if (value <= thresholds.warning) color = "warning";
      else color = "critical";
    }
    
    // Fill the gauge
    for (let i = 0; i < width; i++) {
      if (i < filled) {
        gauge += color === "good" ? "=" : color === "warning" ? "#" : "!";
      } else {
        gauge += " ";
      }
    }
    
    gauge += `] ${value.toFixed(1)}${unit} (${(percentage * 100).toFixed(1)}%)`;
    
    return gauge;
  }

  // Data Export Utilities
  async exportToCSV(data, filePath) {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      });
      csv += values.join(',') + '\n';
    }
    
    await fs.writeFile(filePath, csv);
  }

  createMatrix(fields, kValues, data, metricName) {
    const matrix = [];
    
    for (const field of fields) {
      const row = [];
      for (const k of kValues) {
        const point = data.find(d => d.field === field && d.k === k);
        row.push(point ? point[metricName] : 0);
      }
      matrix.push(row);
    }
    
    return matrix;
  }

  // Code Examples Generation
  generatePlotlyExamples() {
    return {
      line_chart: `
import plotly.graph_objects as go
import json

# Load data
with open('classification_metrics.json', 'r') as f:
    data = json.load(f)

fig = go.Figure()

for series in data['chart_data']:
    k_values = [point['x'] for point in series['accuracy']]
    accuracy_values = [point['y'] for point in series['accuracy']]
    
    fig.add_trace(go.Scatter(
        x=k_values,
        y=accuracy_values,
        mode='lines+markers',
        name=series['field'],
        line=dict(width=2)
    ))

fig.update_layout(
    title='Classification Accuracy vs K',
    xaxis_title='K Value',
    yaxis_title='Accuracy',
    hovermode='x unified'
)

fig.show()
      `,
      heatmap: `
import plotly.graph_objects as go
import json

# Load data
with open('ranking_metrics.json', 'r') as f:
    data = json.load(f)

heatmap_data = data['heatmap_data']

fig = go.Figure(data=go.Heatmap(
    z=heatmap_data['ndcg_matrix'],
    x=heatmap_data['k_values'],
    y=heatmap_data['fields'],
    colorscale='Viridis',
    showscale=True
))

fig.update_layout(
    title='NDCG Heatmap: Fields vs K Values',
    xaxis_title='K Value',
    yaxis_title='Field'
)

fig.show()
      `
    };
  }

  generateD3Examples() {
    return {
      line_chart: `
// Load data and create line chart
d3.json("classification_metrics.json").then(data => {
    const margin = {top: 20, right: 80, bottom: 30, left: 50};
    const width = 960 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    const svg = d3.select("body").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    
    const g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    // Process data and create scales
    const xScale = d3.scaleLinear().range([0, width]);
    const yScale = d3.scaleLinear().range([height, 0]);
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    
    // Create line generator
    const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveMonotoneX);
    
    // Draw lines for each field
    data.chart_data.forEach((series, i) => {
        g.append("path")
            .datum(series.accuracy)
            .attr("fill", "none")
            .attr("stroke", colorScale(i))
            .attr("stroke-width", 2)
            .attr("d", line);
    });
});
      `
    };
  }

  generateGgplotExamples() {
    return {
      line_chart: `
library(ggplot2)
library(jsonlite)

# Load data
data <- fromJSON("classification_metrics.json")

# Convert to data frame
plot_data <- do.call(rbind, lapply(names(data$chart_data), function(i) {
  series <- data$chart_data[[i]]
  accuracy_df <- do.call(rbind, series$accuracy)
  accuracy_df$field <- series$field
  accuracy_df$metric <- "accuracy"
  return(accuracy_df)
}))

# Create plot
ggplot(plot_data, aes(x = x, y = y, color = field)) +
  geom_line(size = 1) +
  geom_point() +
  labs(title = "Classification Accuracy vs K",
       x = "K Value",
       y = "Accuracy",
       color = "Field") +
  theme_minimal()
      `
    };
  }

  generateVisualizationREADME(index) {
    return `# Evaluation Results Visualization

This directory contains visualization data exported from the multimodal recommender evaluation.

## Generated Files

${Object.entries(index.files).map(([category, files]) => 
  `### ${category.charAt(0).toUpperCase() + category.slice(1)}
${Object.entries(files).map(([format, file]) => 
  `- \`${path.basename(file)}\` - ${format.toUpperCase()} format`
).join('\n')}`
).join('\n\n')}

## Recommended Charts

${index.recommended_charts ? Object.entries(index.recommended_charts).map(([category, charts]) =>
  `### ${category.charAt(0).toUpperCase() + category.slice(1)}
${charts.map(chart => 
  `- **${chart.title}** (${chart.type}): ${chart.description}`
).join('\n')}`
).join('\n\n') : ''}

## Usage Examples

The visualization data is provided in multiple formats:

- **JSON**: For programmatic access and web-based visualizations
- **CSV**: For spreadsheet applications and statistical software
- **ASCII**: For quick terminal-based viewing

### Python (Plotly)

\`\`\`python
import plotly.graph_objects as go
import json

# Example: Load and plot classification metrics
with open('classification_metrics.json', 'r') as f:
    data = json.load(f)

# Your plotting code here...
\`\`\`

### JavaScript (D3.js)

\`\`\`javascript
d3.json("ranking_metrics.json").then(data => {
    // Your D3 visualization code here...
});
\`\`\`

### R (ggplot2)

\`\`\`r
library(ggplot2)
library(jsonlite)

data <- fromJSON("diversity_metrics.json")
# Your ggplot code here...
\`\`\`

## Data Structure

Each JSON file contains structured data optimized for different chart types:

- **Line charts**: Data with x/y coordinates and series information
- **Bar charts**: Categorical data with values
- **Heatmaps**: Matrix data with row/column labels
- **Scatter plots**: Point data with optional size/color dimensions
- **Gauges**: Single values with thresholds and ranges

## Notes

- All numeric values are rounded to ${this.config.decimal_precision} decimal places
- ASCII charts are provided for quick terminal viewing
- Refer to \`visualization_index.json\` for detailed metadata and plotting suggestions
`;
  }
}

// Quick visualization utility for single charts
export class QuickVisualizer {
  static createASCIIBarChart(data, title, maxWidth = 50) {
    let chart = `${title}\n${"=".repeat(title.length)}\n\n`;
    
    const maxValue = Math.max(...Object.values(data));
    const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));
    
    for (const [key, value] of Object.entries(data)) {
      const barLength = Math.round((value / maxValue) * maxWidth);
      const bar = "█".repeat(barLength) + "▒".repeat(maxWidth - barLength);
      chart += `${key.padEnd(maxKeyLength)} │${bar}│ ${value.toFixed(2)}\n`;
    }
    
    return chart;
  }
  
  static createASCIIHistogram(values, bins = 10, title = "Histogram") {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = (max - min) / bins;
    const binCounts = new Array(bins).fill(0);
    
    for (const value of values) {
      const binIndex = Math.min(Math.floor((value - min) / binSize), bins - 1);
      binCounts[binIndex]++;
    }
    
    let chart = `${title}\n${"=".repeat(title.length)}\n\n`;
    const maxCount = Math.max(...binCounts);
    
    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binSize;
      const binEnd = binStart + binSize;
      const height = Math.round((binCounts[i] / maxCount) * 20);
      const bar = "█".repeat(height);
      
      chart += `${binStart.toFixed(1)}-${binEnd.toFixed(1)} │${bar.padEnd(20)}│ ${binCounts[i]}\n`;
    }
    
    return chart;
  }
}

// CLI interface
if (process.argv[1].endsWith('visualizer.js')) {
  (async () => {
    const [, , resultsPath, outputDir] = process.argv;
    
    if (!resultsPath) {
      console.error('Usage: node visualizer.js <evaluation_results.json> [output_dir]');
      process.exit(1);
    }
    
    const evaluationResults = await fs.readJSON(resultsPath);
    const visualizer = new EvaluationVisualizer();
    
    await visualizer.exportForVisualization(
      evaluationResults, 
      outputDir || 'visualization_data'
    );
    
    console.log('✅ Visualization data export completed!');
  })().catch(error => {
    console.error('Visualization export failed:', error);
    process.exit(1);
  });
}

export { EvaluationVisualizer, QuickVisualizer };