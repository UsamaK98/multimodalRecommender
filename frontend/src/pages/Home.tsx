import React, { useEffect, useState } from 'react';
import Slider from 'react-slick';
import { parseProductData, Product } from '../utils/dataParser';
import ProductCard from '../components/ProductCard';

interface ProductGroup {
  category: string;
  products: Product[];
}

function Home() {
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const products = await parseProductData();
        const groupedProducts = products.reduce<Record<string, Product[]>>((acc, product) => {
          if (!acc[product.masterCategory]) {
            acc[product.masterCategory] = [];
          }
          acc[product.masterCategory].push(product);
          return acc;
        }, {});

        const groups: ProductGroup[] = Object.entries(groupedProducts).map(([category, products]) => ({
          category,
          products,
        }));
        setProductGroups(groups);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };

    fetchProducts();
  }, []);

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 4,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1,
          infinite: true,
          dots: true
        }
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
          initialSlide: 2
        }
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1
        }
      }
    ]
  };

  return (
    <div style={styles.container}>
      {productGroups.map((group) => (
        <div key={group.category} style={styles.carouselSection}>
          <h3 style={styles.carouselTitle}>{group.category}</h3>
          <Slider {...settings}>
            {group.products.map((product) => (
              <ProductCard key={product.id} id={product.id} name={product.productDisplayName} />
            ))}
          </Slider>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
  },
  carouselSection: {
    marginBottom: '3rem',
  },
  carouselTitle: {
    fontSize: '1.8rem',
    marginBottom: '1.5rem',
    textAlign: 'center',
    color: '#333',
  },
};

export default Home;
