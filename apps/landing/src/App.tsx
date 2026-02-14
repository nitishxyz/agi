import { Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { useEffect } from 'react';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Landing } from './pages/Landing';
import { Docs } from './pages/Docs';
import { Setu } from './pages/Setu';

export function App() {
	const location = useLocation();
	const navigationType = useNavigationType();
	const isDocs = location.pathname.startsWith('/docs');

	useEffect(() => {
		if (navigationType === 'PUSH') {
			window.scrollTo(0, 0);
		}
	}, [location.pathname, navigationType]);

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
