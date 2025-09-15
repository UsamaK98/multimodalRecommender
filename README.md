Pre-reqs to run this project
1. Install Python 3.12 
2. Install UV 
3. Install node 18+

Steps to run this repo

1. Clone the repo
2. Download and store dataset archive zip file within the main directory of the repo https://www.kaggle.com/datasets/paramaggarwal/fashion-product-images-small/data
3. uv venv .venv --python=python3.12 && source .venv/bin/activate
4. Run uv pip install -r requirements.txt
5. Run preprocessing notebook cells
6. cd model && npm init -y
7. npm install @huggingface/transformers csv-parser fs-extra
8. node embedder.js ../extractedData/balanced_styles_sample.csv ../extractedData/balanced_sample_images embeddings.json

To-Do: Create frontend
