import { Route, Routes, useLocation } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Landing } from './pages/Landing';
import { Docs } from './pages/Docs';
import { Setu } from './pages/Setu';

export function App() {
	const location = useLocation();
	const isDocs = location.pathname.startsWith('/docs');

	return (
		<div className="min-h-screen bg-otto-bg font-mono">
			<Nav />
			<Routes>
				<Route path="/" element={<Landing />} />
				<Route path="/setu" element={<Setu />} />
				<Route path="/docs/*" element={<Docs />} />
			</Routes>
			<div className={isDocs ? 'lg:ml-64' : ''}>
				<Footer />
			</div>
		</div>
	);
}
