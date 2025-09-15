import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import SearchPage from './pages/SearchPage';
import CategoryPage from './pages/CategoryPage';

function App() {
  return (
    <Router>
      <div className="App">
        <header style={styles.header}>
          <h1 style={styles.title}>Fashion Recommender</h1>
          <nav style={styles.nav}>
            <Link to="/" style={styles.navLink}>Home</Link>
            <Link to="/search" style={styles.navLink}>Search</Link>
            <Link to="/categories" style={styles.navLink}>Categories</Link>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/categories" element={<CategoryPage />} />
        </Routes>
      </div>
    </Router>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: '#333',
    color: '#fff',
  },
  title: {
    margin: 0,
  },
  nav: {
    display: 'flex',
    gap: '1rem',
  },
  navLink: {
    color: '#fff',
    textDecoration: 'none',
    fontSize: '1.1rem',
  },
};

export default App;
