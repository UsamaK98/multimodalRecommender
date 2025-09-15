# Multimodal Recommender Model Evaluation System

A comprehensive evaluation framework for the multimodal fashion recommender model, providing detailed analysis of recommendation quality, performance metrics, and actionable insights.

## 🚀 Quick Start

Run a basic evaluation on your model:

```bash
node evaluator.js embeddings.json evaluation_results.json
```

This will generate:
- Detailed metrics across all target fields
- Performance analysis
- HTML and Markdown reports
- Actionable recommendations for improvement

## 📊 What's Included

### Core Components

1. **[evaluator.js](./evaluator.js)** - Main evaluation framework
   - Classification metrics (accuracy, precision, recall, F1)
   - Ranking metrics (NDCG, MRR, MAP)
   - Recommendation quality analysis
   - Diversity and coverage metrics
   - Category-wise performance analysis
   - Error analysis and confusion matrices

2. **[eval-config.js](./eval-config.js)** - Configuration management
   - Predefined evaluation scenarios (quick, standard, comprehensive)
   - Field-specific settings and thresholds
   - Custom configuration support

3. **[test-utils.js](./test-utils.js)** - Data splitting and validation utilities
   - Stratified train/test splits
   - K-fold cross-validation
   - Bootstrap sampling
   - Ground truth management

4. **[report-generator.js](./report-generator.js)** - Comprehensive reporting
   - HTML reports with interactive elements
   - Markdown reports for documentation
   - JSON summaries for programmatic access
   - Performance recommendations

5. **[benchmark.js](./benchmark.js)** - Performance benchmarking
   - Speed and throughput analysis
   - Memory usage profiling
   - Scalability testing
   - Concurrent performance evaluation

6. **[visualizer.js](./visualizer.js)** - Data visualization utilities
   - Export data for plotting libraries (Plotly, D3, ggplot)
   - ASCII charts for terminal viewing
   - Multiple format support (JSON, CSV)

## 🎯 Evaluation Metrics

### Classification Performance
- **Accuracy**: Percentage of correct predictions
- **Precision**: True positives / (True positives + False positives)
- **Recall**: True positives / (True positives + False negatives)
- **F1-Score**: Harmonic mean of precision and recall

### Ranking Quality
- **NDCG** (Normalized Discounted Cumulative Gain): Ranking quality with position discount
- **MRR** (Mean Reciprocal Rank): Average of reciprocal ranks of first correct answer
- **MAP** (Mean Average Precision): Average precision across different recall levels

### Recommendation Quality
- **Similarity Distribution**: Statistics on similarity scores
- **Confidence Analysis**: Prediction confidence levels
- **Category Consistency**: Cross-category recommendation patterns

### Diversity & Coverage
- **Catalog Coverage**: Percentage of available categories recommended
- **Intra-list Diversity**: Variety within recommendation lists
- **Novelty**: Uniqueness of recommendations

## 🔧 Usage Examples

### Basic Evaluation

```javascript
import { ModelEvaluator } from './evaluator.js';

const evaluator = new ModelEvaluator();
await evaluator.initialize('embeddings.json');

const results = await evaluator.evaluate();
await evaluator.saveResults('evaluation_results.json');

console.log(evaluator.generateSummaryReport());
```

### Custom Configuration

```javascript
import { ModelEvaluator } from './evaluator.js';
import { configManager } from './eval-config.js';

// Use predefined configuration
const config = configManager.loadConfig('comprehensive');

// Or create custom configuration
const customConfig = configManager.createCustomConfig('my_eval', 'standard', {
  k_values: [1, 5, 10],
  target_fields: ['articletype', 'gender'],
  test_split_ratio: 0.3
});

const evaluator = new ModelEvaluator(customConfig);
await evaluator.initialize('embeddings.json');
const results = await evaluator.evaluate();
```

### Cross-Validation

```javascript
import { CrossValidator } from './test-utils.js';
import { loadEmbeddings, predictFromId } from './predictor.js';

const embeddings = await loadEmbeddings('embeddings.json');
const cv = new CrossValidator({ k: 5, stratify: true });

const evaluationFunction = async (trainData, testData, foldIndex) => {
  // Your evaluation logic here
  let correct = 0;
  for (const testItem of testData) {
    const prediction = predictFromId(testItem.id, embeddings, 5, 'articletype');
    if (prediction.prediction.label === testItem.metadata.articletype) {
      correct++;
    }
  }
  return { accuracy: correct / testData.length };
};

const cvResults = await cv.performCrossValidation(
  embeddings.rows, 
  evaluationFunction, 
  'articletype'
);
```

### Performance Benchmarking

```javascript
import { PerformanceBenchmark } from './benchmark.js';

const benchmark = new PerformanceBenchmark({
  benchmark_iterations: 200,
  include_memory_profiling: true
});

const results = await benchmark.runBenchmark('embeddings.json');
await benchmark.saveBenchmarkResults('benchmark_results.json');

console.log(benchmark.generateBenchmarkReport());
```

### Generate Reports

```javascript
import { ReportGenerator } from './report-generator.js';

const reportGen = new ReportGenerator();
const evaluationResults = await fs.readJSON('evaluation_results.json');

// Generate HTML report
await reportGen.generateHTMLReport(evaluationResults, 'evaluation_report.html');

// Generate Markdown report
await reportGen.generateMarkdownReport(evaluationResults, 'evaluation_report.md');

// Generate JSON summary
await reportGen.generateJSONSummary(evaluationResults, 'evaluation_summary.json');
```

### Export Visualization Data

```javascript
import { EvaluationVisualizer } from './visualizer.js';

const visualizer = new EvaluationVisualizer();
const evaluationResults = await fs.readJSON('evaluation_results.json');

await visualizer.exportForVisualization(evaluationResults, 'visualization_data');
```

## 📋 Configuration Options

### Predefined Configurations

| Config | Description | Use Case |
|--------|-------------|----------|
| `quick` | Fast evaluation with minimal metrics | Development/debugging |
| `standard` | Balanced evaluation for regular use | Standard model assessment |
| `comprehensive` | Complete evaluation with all metrics | Thorough analysis |
| `performance` | Focus on speed and efficiency | Performance optimization |
| `diversity` | Focus on recommendation diversity | Diversity analysis |

### Field Configuration

Each target field can be configured with:
- **Weight**: Importance in overall scoring
- **Primary**: Whether it's a key field for evaluation
- **Min samples**: Minimum samples needed per category
- **Expected accuracy**: Baseline accuracy threshold

### Example Custom Config

```javascript
{
  k_values: [1, 3, 5, 10, 20],
  target_fields: ['articletype', 'gender', 'mastercategory'],
  test_split_ratio: 0.25,
  min_category_samples: 5,
  diversity_threshold: 0.7,
  random_seed: 42,
  enable_cross_validation: true,
  cv_folds: 5
}
```

## 📈 Interpreting Results

### Classification Metrics
- **Accuracy > 0.8**: Excellent performance
- **Accuracy 0.6-0.8**: Good performance
- **Accuracy < 0.6**: Needs improvement

### Ranking Metrics
- **NDCG > 0.7**: Strong ranking quality
- **MRR > 0.5**: Good first-relevant-item ranking
- **MAP > 0.4**: Reasonable precision across recalls

### Performance Benchmarks
- **Prediction time < 10ms**: Excellent
- **Prediction time 10-50ms**: Good
- **Prediction time > 50ms**: Consider optimization

### Diversity Metrics
- **Coverage > 0.8**: Good catalog representation
- **Intra-list diversity > 0.5**: Reasonable variety

## 🚀 Advanced Features

### Error Analysis
- Confusion matrix generation
- Common error pattern identification
- Category-specific performance analysis

### Performance Profiling
- Memory usage tracking
- Concurrent performance testing
- Scalability analysis across dataset sizes

### Visualization Export
- Multiple format support (JSON, CSV, ASCII)
- Ready-to-use code examples for popular plotting libraries
- Interactive HTML reports with charts

### Recommendation System
- Automated performance recommendations
- Prioritized improvement suggestions
- Actionable optimization guidance

## 🛠️ Command Line Interface

### Run Full Evaluation
```bash
node evaluator.js [embeddings.json] [output.json] [config.json]
```

### Benchmark Performance
```bash
node benchmark.js [embeddings.json] [benchmark_results.json]
```

### Export Visualization Data
```bash
node visualizer.js [evaluation_results.json] [output_dir]
```

### Generate Reports
```bash
node report-generator.js [evaluation_results.json] [output_dir]
```

## 📊 Sample Output

```
=== MODEL EVALUATION SUMMARY ===

📊 CLASSIFICATION METRICS
--------------------------------------------------

ARTICLETYPE:
  k=1: Accuracy=72.3%, Precision=68.5%, Recall=71.2%, F1=69.8%
  k=3: Accuracy=78.9%, Precision=75.1%, Recall=77.8%, F1=76.4%
  k=5: Accuracy=82.1%, Precision=78.9%, Recall=81.3%, F1=80.1%
  k=10: Accuracy=85.7%, Precision=82.4%, Recall=84.9%, F1=83.6%

📈 RANKING METRICS
--------------------------------------------------

ARTICLETYPE:
  k=1: NDCG=0.7230, MRR=0.7230, MAP=0.7230
  k=3: NDCG=0.7891, MRR=0.7456, MAP=0.7623
  k=5: NDCG=0.8214, MRR=0.7456, MAP=0.7889
  k=10: NDCG=0.8571, MRR=0.7456, MAP=0.8124

🌈 DIVERSITY & COVERAGE
--------------------------------------------------
ARTICLETYPE: Coverage=87.3%, Avg Diversity=73.2%
GENDER: Coverage=95.1%, Avg Diversity=45.6%

⚡ PERFORMANCE METRICS
--------------------------------------------------
Average Prediction Time: 8.45ms
Throughput: 118.3 predictions/sec
Memory Usage: 156MB
```

## 🤝 Contributing

When extending the evaluation system:

1. Follow the existing pattern for metric calculation
2. Add comprehensive tests for new metrics
3. Update configuration options appropriately
4. Include documentation and examples
5. Consider backward compatibility

## 📝 License

This evaluation system is part of the multimodal recommender project.

---

*For more detailed information about specific components, refer to the individual source files and their inline documentation.*