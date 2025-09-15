import Papa from 'papaparse';

export interface Product {
  id: number;
  gender: string;
  masterCategory: string;
  subCategory: string;
  articleType: string;
  baseColour: string;
  season: string;
  year: number;
  usage: string;
  productDisplayName: string;
}

export const parseProductData = async (): Promise<Product[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse('/extractedData/balanced_styles_sample.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        const products: Product[] = results.data.map((row: any) => ({
          id: row.id,
          gender: row.gender,
          masterCategory: row.mastercategory,
          subCategory: row.subcategory,
          articleType: row.articletype,
          baseColour: row.basecolour,
          season: row.season,
          year: row.year,
          usage: row.usage,
          productDisplayName: row.productdisplayname,
        }));
        resolve(products);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};
