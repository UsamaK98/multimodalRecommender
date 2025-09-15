import React from 'react';

interface ProductCardProps {
  id: number;
  name: string;
}

const ProductCard: React.FC<ProductCardProps> = ({ id, name }) => {
  const imageUrl = `/extractedData/balanced_sample_images/${id}.jpg`;

  return (
    <div style={styles.card}>
      <img src={imageUrl} alt={name} style={styles.image} />
      <p style={styles.name}>{name}</p>
    </div>
  );
};

const styles = {
  card: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '10px',
    margin: '10px',
    textAlign: 'center',
    width: '200px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  image: {
    width: '100%',
    height: '150px',
    objectFit: 'cover',
    borderRadius: '4px',
  },
  name: {
    marginTop: '10px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
};

export default ProductCard;
