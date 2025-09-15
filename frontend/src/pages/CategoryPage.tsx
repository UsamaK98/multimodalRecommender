function CategoryPage() {
  return (
    <div style={styles.container}>
      <h2>Category Page</h2>
      <p>This page will display products based on masterCategory and subCategory.</p>
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    textAlign: 'center',
  },
};

export default CategoryPage;
