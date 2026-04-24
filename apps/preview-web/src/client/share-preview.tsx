import { createRoot } from 'react-dom/client';
import ChatPreviewWrapper from '../components/ChatPreviewWrapper';

const root = document.getElementById('share-preview-root');
const data = document.getElementById('share-preview-data');

if (root && data?.textContent) {
	createRoot(root).render(
		<ChatPreviewWrapper data={JSON.parse(data.textContent)} />,
	);
}
